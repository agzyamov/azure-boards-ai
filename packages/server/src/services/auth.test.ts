import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuthService, createAuthServiceFromEnv } from "./auth.js";

// Mock fetch globally
global.fetch = vi.fn();

const TEST_ORG_URL = "https://dev.azure.com/test";
const TEST_PAT = "test-pat-token";
const TEST_TENANT_ID = "test-tenant-id";
const TEST_CLIENT_ID = "test-client-id";
const TEST_CLIENT_SECRET = "test-client-secret";
const TEST_SP_TOKEN = "sp-token-123";

describe("AuthService", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should accept PAT configuration", () => {
      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        pat: TEST_PAT,
      });

      expect(service).toBeDefined();
    });

    it("should accept Service Principal configuration", () => {
      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      expect(service).toBeDefined();
    });

    it("should throw if no credentials provided", () => {
      expect(
        () =>
          new AuthService({
            organizationUrl: TEST_ORG_URL,
          })
      ).toThrow("Either PAT or Service Principal credentials must be provided");
    });

    it("should throw if Service Principal incomplete", () => {
      expect(
        () =>
          new AuthService({
            organizationUrl: TEST_ORG_URL,
            servicePrincipal: {
              tenantId: TEST_TENANT_ID,
              clientId: "",
              clientSecret: TEST_CLIENT_SECRET,
            },
          })
      ).toThrow("Service Principal requires tenantId, clientId, and clientSecret");
    });
  });

  describe("getAccessToken - PAT", () => {
    it("should return PAT token", async () => {
      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        pat: TEST_PAT,
      });

      const token = await service.getAccessToken();

      expect(token).toBe(TEST_PAT);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getAccessToken - Service Principal", () => {
    it("should fetch and cache token", async () => {
      const mockResponse = {
        access_token: TEST_SP_TOKEN,
        expires_in: 3600,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      const token1 = await service.getAccessToken();
      const token2 = await service.getAccessToken();

      expect(token1).toBe(TEST_SP_TOKEN);
      expect(token2).toBe(TEST_SP_TOKEN);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should refresh expired token", async () => {
      const mockResponse1 = {
        access_token: "token-1",
        expires_in: 300, // 5 minutes (will be expired due to 5min buffer)
      };

      const mockResponse2 = {
        access_token: "token-2",
        expires_in: 3600,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      const token1 = await service.getAccessToken();
      expect(token1).toBe("token-1");

      // Advance time to expire token
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes

      const token2 = await service.getAccessToken();
      expect(token2).toBe("token-2");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw on authentication failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid credentials",
      });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      await expect(service.getAccessToken()).rejects.toThrow(
        "Failed to authenticate with Service Principal"
      );
    });

    it("should call correct Microsoft Entra endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "token",
          expires_in: 3600,
        }),
      });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      await service.getAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        `https://login.microsoftonline.com/${TEST_TENANT_ID}/oauth2/v2.0/token`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        })
      );
    });
  });

  describe("getAuthHeaders", () => {
    it("should return Basic auth for PAT", async () => {
      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        pat: TEST_PAT,
      });

      const headers = await service.getAuthHeaders();

      const expectedAuth = Buffer.from(`:${TEST_PAT}`).toString("base64");
      expect(headers.Authorization).toBe(`Basic ${expectedAuth}`);
    });

    it("should return Bearer token for Service Principal", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: TEST_SP_TOKEN,
          expires_in: 3600,
        }),
      });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      const headers = await service.getAuthHeaders();

      expect(headers.Authorization).toBe(`Bearer ${TEST_SP_TOKEN}`);
    });
  });

  describe("invalidateToken", () => {
    it("should force token refresh on next call", async () => {
      const mockResponse1 = {
        access_token: "token-1",
        expires_in: 3600,
      };

      const mockResponse2 = {
        access_token: "token-2",
        expires_in: 3600,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse1,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse2,
        });

      const service = new AuthService({
        organizationUrl: TEST_ORG_URL,
        servicePrincipal: {
          tenantId: TEST_TENANT_ID,
          clientId: TEST_CLIENT_ID,
          clientSecret: TEST_CLIENT_SECRET,
        },
      });

      const token1 = await service.getAccessToken();
      expect(token1).toBe("token-1");

      service.invalidateToken();

      const token2 = await service.getAccessToken();
      expect(token2).toBe("token-2");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe("createAuthServiceFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw if AZURE_DEVOPS_ORG missing", () => {
    delete process.env.AZURE_DEVOPS_ORG;

    expect(() => createAuthServiceFromEnv()).toThrow(
      "AZURE_DEVOPS_ORG environment variable is required"
    );
  });

  it("should create service with PAT", () => {
    process.env.AZURE_DEVOPS_ORG = TEST_ORG_URL;
    process.env.AZURE_DEVOPS_PAT = TEST_PAT;

    const service = createAuthServiceFromEnv();

    expect(service).toBeDefined();
  });

  it("should create service with Service Principal", () => {
    process.env.AZURE_DEVOPS_ORG = TEST_ORG_URL;
    process.env.AZURE_TENANT_ID = TEST_TENANT_ID;
    process.env.AZURE_CLIENT_ID = TEST_CLIENT_ID;
    process.env.AZURE_CLIENT_SECRET = TEST_CLIENT_SECRET;

    const service = createAuthServiceFromEnv();

    expect(service).toBeDefined();
  });

  it("should throw if no credentials provided", () => {
    process.env.AZURE_DEVOPS_ORG = TEST_ORG_URL;

    expect(() => createAuthServiceFromEnv()).toThrow(
      "Either AZURE_DEVOPS_PAT or Service Principal credentials"
    );
  });
});
