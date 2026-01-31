import type { Logger } from "pino";

export interface AuthConfig {
  organizationUrl: string;
  pat?: string;
  servicePrincipal?: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
  };
}

export interface AccessToken {
  token: string;
  expiresAt: Date;
}

/**
 * Authentication service for Azure DevOps
 * Supports:
 * - PAT (Personal Access Token) for development
 * - Service Principal (Microsoft Entra) for production
 */
export class AuthService {
  private config: AuthConfig;
  private logger?: Logger;
  private cachedToken?: AccessToken;

  constructor(config: AuthConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.pat && !this.config.servicePrincipal) {
      throw new Error("Either PAT or Service Principal credentials must be provided");
    }

    if (
      this.config.servicePrincipal &&
      (!this.config.servicePrincipal.tenantId ||
        !this.config.servicePrincipal.clientId ||
        !this.config.servicePrincipal.clientSecret)
    ) {
      throw new Error("Service Principal requires tenantId, clientId, and clientSecret");
    }
  }

  /**
   * Get access token for Azure DevOps API
   * Uses cached token if valid, otherwise fetches new one
   */
  async getAccessToken(): Promise<string> {
    // Use PAT if configured (development)
    if (this.config.pat) {
      this.logger?.debug("Using PAT authentication");
      return this.config.pat;
    }

    // Use Service Principal (production)
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      this.logger?.debug("Using cached Service Principal token");
      return this.cachedToken.token;
    }

    this.logger?.info("Fetching new Service Principal token");
    this.cachedToken = await this.fetchServicePrincipalToken();
    return this.cachedToken.token;
  }

  /**
   * Get authorization headers for Azure DevOps API
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();

    // PAT uses Basic auth
    if (this.config.pat) {
      const auth = Buffer.from(`:${token}`).toString("base64");
      return {
        Authorization: `Basic ${auth}`,
      };
    }

    // Service Principal uses Bearer token
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Invalidate cached token (e.g., on 401 response)
   */
  invalidateToken(): void {
    this.logger?.info("Invalidating cached token");
    this.cachedToken = undefined;
  }

  private isTokenValid(token: AccessToken): boolean {
    const now = new Date();
    const bufferMinutes = 5; // Refresh 5 minutes before expiry
    const expiryWithBuffer = new Date(token.expiresAt.getTime() - bufferMinutes * 60 * 1000);

    return now < expiryWithBuffer;
  }

  private async fetchServicePrincipalToken(): Promise<AccessToken> {
    if (!this.config.servicePrincipal) {
      throw new Error("Service Principal not configured");
    }

    const { tenantId, clientId, clientSecret } = this.config.servicePrincipal;

    // Microsoft Entra ID token endpoint
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "499b84ac-1321-427f-aa17-267ca6975798/.default", // Azure DevOps scope
      grant_type: "client_credentials",
    });

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error(
          { status: response.status, error: errorText },
          "Failed to fetch Service Principal token"
        );
        throw new Error(`Failed to authenticate with Service Principal: ${response.status}`);
      }

      const data = await response.json();

      const expiresAt = new Date(Date.now() + data.expires_in * 1000);

      this.logger?.info({ expiresAt }, "Successfully fetched Service Principal token");

      return {
        token: data.access_token,
        expiresAt,
      };
    } catch (error) {
      this.logger?.error({ error }, "Error fetching Service Principal token");
      throw new Error("Failed to authenticate with Service Principal", {
        cause: error,
      });
    }
  }
}

/**
 * Create AuthService from environment variables
 */
export function createAuthServiceFromEnv(logger?: Logger): AuthService {
  const organizationUrl = process.env.AZURE_DEVOPS_ORG;
  if (!organizationUrl) {
    throw new Error("AZURE_DEVOPS_ORG environment variable is required");
  }

  const config: AuthConfig = {
    organizationUrl,
  };

  // Check for PAT (development)
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (pat) {
    if (process.env.NODE_ENV === "production") {
      logger?.warn("Using PAT authentication in production is not recommended");
    }
    config.pat = pat;
    return new AuthService(config, logger);
  }

  // Check for Service Principal (production)
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (tenantId && clientId && clientSecret) {
    config.servicePrincipal = {
      tenantId,
      clientId,
      clientSecret,
    };
    return new AuthService(config, logger);
  }

  throw new Error(
    "Either AZURE_DEVOPS_PAT or Service Principal credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) must be provided"
  );
}
