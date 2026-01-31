import { describe, it, expect, vi, beforeEach } from "vitest";
import { AzureDevOpsService, AzureDevOpsError, RateLimitError } from "./azure-devops.js";
import type { AuthService } from "./auth.js";
import type { WorkItem } from "@azure-boards-ai/shared";

// Mock fetch globally
global.fetch = vi.fn();

const TEST_ORG_URL = "https://dev.azure.com/test";
const TEST_PROJECT = "TestProject";

// Mock AuthService
const createMockAuthService = (): AuthService =>
  ({
    getAccessToken: vi.fn().mockResolvedValue("test-token"),
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: "Basic dGVzdA==" }),
    invalidateToken: vi.fn(),
  }) as unknown as AuthService;

describe("AzureDevOpsService", () => {
  let service: AzureDevOpsService;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockAuthService: AuthService;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    mockAuthService = createMockAuthService();

    service = new AzureDevOpsService(TEST_ORG_URL, mockAuthService);
  });

  describe("getWorkItem", () => {
    it("should fetch work item by id", async () => {
      const mockWorkItem: WorkItem = {
        id: 123,
        fields: {
          "System.Title": "Test Work Item",
          "System.State": "New",
          "System.WorkItemType": "User Story",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWorkItem,
      });

      const workItem = await service.getWorkItem(TEST_PROJECT, 123);

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_ORG_URL}/${TEST_PROJECT}/_apis/wit/workitems/123?api-version=7.1`,
        expect.objectContaining({
          method: "GET",
        })
      );
      expect(workItem).toEqual(mockWorkItem);
    });

    it("should throw AzureDevOpsError on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "Work item not found",
      });

      await expect(service.getWorkItem(TEST_PROJECT, 999)).rejects.toThrow(AzureDevOpsError);
    });

    it("should retry on 5xx errors", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: async () => "Server error",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 123 }),
        });

      const workItem = await service.getWorkItem(TEST_PROJECT, 123);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(workItem.id).toBe(123);
    });

    it("should handle rate limiting (429)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: "Too Many Requests",
          headers: {
            get: (name: string) => (name === "Retry-After" ? "1" : null),
          },
          text: async () => "Rate limited",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 123 }),
        });

      const workItem = await service.getWorkItem(TEST_PROJECT, 123);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(workItem.id).toBe(123);
    });

    it("should throw RateLimitError after max retries", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          get: (name: string) => (name === "Retry-After" ? "1" : null),
        },
        text: async () => "Rate limited",
      });

      await expect(service.getWorkItem(TEST_PROJECT, 123)).rejects.toThrow(RateLimitError);

      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it("should invalidate token on 401 and retry", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          text: async () => "Token expired",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 123 }),
        });

      const workItem = await service.getWorkItem(TEST_PROJECT, 123);

      expect(mockAuthService.invalidateToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(workItem.id).toBe(123);
    });
  });

  describe("getWorkItemsBatch", () => {
    it("should fetch multiple work items", async () => {
      const mockResponse = {
        value: [
          { id: 1, fields: { "System.Title": "Item 1" } },
          { id: 2, fields: { "System.Title": "Item 2" } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const workItems = await service.getWorkItemsBatch(TEST_PROJECT, [1, 2]);

      expect(workItems).toHaveLength(2);
      expect(workItems[0].id).toBe(1);
      expect(workItems[1].id).toBe(2);
    });

    it("should return empty array for empty input", async () => {
      const workItems = await service.getWorkItemsBatch(TEST_PROJECT, []);

      expect(workItems).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should chunk requests for >200 items", async () => {
      const ids = Array.from({ length: 250 }, (_, i) => i + 1);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: ids.slice(0, 200).map((id) => ({ id, fields: {} })),
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: ids.slice(200).map((id) => ({ id, fields: {} })),
          }),
        });

      const workItems = await service.getWorkItemsBatch(TEST_PROJECT, ids);

      expect(workItems).toHaveLength(250);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("createWorkItem", () => {
    it("should create a new work item", async () => {
      const fields = {
        "System.Title": "New Task",
        "System.Description": "Task description",
      };

      const mockResponse: WorkItem = {
        id: 456,
        fields: {
          ...fields,
          "System.State": "New",
          "System.WorkItemType": "Task",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const workItem = await service.createWorkItem(TEST_PROJECT, "Task", fields);

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_ORG_URL}/${TEST_PROJECT}/_apis/wit/workitems/$Task?api-version=7.1`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json-patch+json",
          }),
        })
      );
      expect(workItem.id).toBe(456);
    });
  });

  describe("updateWorkItem", () => {
    it("should update work item fields", async () => {
      const updates = {
        "System.State": "Active",
        "System.AssignedTo": "user@example.com",
      };

      const mockResponse: WorkItem = {
        id: 123,
        fields: {
          "System.Title": "Existing Item",
          ...updates,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const workItem = await service.updateWorkItem(TEST_PROJECT, 123, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_ORG_URL}/${TEST_PROJECT}/_apis/wit/workitems/123?api-version=7.1`,
        expect.objectContaining({
          method: "PATCH",
        })
      );
      expect(workItem.fields["System.State"]).toBe("Active");
    });
  });

  describe("searchWorkItems", () => {
    it("should execute WIQL query and fetch results", async () => {
      const wiql = "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'Active'";

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            workItems: [{ id: 1 }, { id: 2 }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 1, fields: { "System.Title": "Item 1" } },
              { id: 2, fields: { "System.Title": "Item 2" } },
            ],
          }),
        });

      const workItems = await service.searchWorkItems(TEST_PROJECT, wiql);

      expect(workItems).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2); // WIQL + batch fetch
    });

    it("should return empty array for no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          workItems: [],
        }),
      });

      const workItems = await service.searchWorkItems(
        TEST_PROJECT,
        "SELECT [System.Id] FROM WorkItems"
      );

      expect(workItems).toEqual([]);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only WIQL, no batch fetch
    });
  });

  describe("getRelatedWorkItems", () => {
    it("should fetch related work items", async () => {
      const mockRelations = {
        id: 123,
        relations: [
          {
            rel: "System.LinkTypes.Related",
            url: `${TEST_ORG_URL}/_apis/wit/workitems/124`,
          },
          {
            rel: "System.LinkTypes.Related",
            url: `${TEST_ORG_URL}/_apis/wit/workitems/125`,
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRelations,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 124, fields: { "System.Title": "Related 1" } },
              { id: 125, fields: { "System.Title": "Related 2" } },
            ],
          }),
        });

      const related = await service.getRelatedWorkItems(TEST_PROJECT, 123);

      expect(related).toHaveLength(2);
      expect(related[0].id).toBe(124);
      expect(related[1].id).toBe(125);
    });

    it("should return empty array if no relations", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 }),
      });

      const related = await service.getRelatedWorkItems(TEST_PROJECT, 123);

      expect(related).toEqual([]);
    });
  });

  describe("getChildWorkItems", () => {
    it("should fetch child work items", async () => {
      const mockParent = {
        id: 100,
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: `${TEST_ORG_URL}/_apis/wit/workitems/101`,
          },
          {
            rel: "System.LinkTypes.Hierarchy-Forward",
            url: `${TEST_ORG_URL}/_apis/wit/workitems/102`,
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockParent,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [
              { id: 101, fields: { "System.Title": "Child 1" } },
              { id: 102, fields: { "System.Title": "Child 2" } },
            ],
          }),
        });

      const children = await service.getChildWorkItems(TEST_PROJECT, 100);

      expect(children).toHaveLength(2);
      expect(children[0].id).toBe(101);
      expect(children[1].id).toBe(102);
    });
  });

  describe("getParentWorkItem", () => {
    it("should fetch parent work item", async () => {
      const mockChild = {
        id: 101,
        relations: [
          {
            rel: "System.LinkTypes.Hierarchy-Reverse",
            url: `${TEST_ORG_URL}/_apis/wit/workitems/100`,
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockChild,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            value: [{ id: 100, fields: { "System.Title": "Parent" } }],
          }),
        });

      const parent = await service.getParentWorkItem(TEST_PROJECT, 101);

      expect(parent).not.toBeNull();
      expect(parent?.id).toBe(100);
    });

    it("should return null if no parent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 101 }),
      });

      const parent = await service.getParentWorkItem(TEST_PROJECT, 101);

      expect(parent).toBeNull();
    });
  });
});
