import type { WorkItem } from "@azure-boards-ai/shared";
import type { Logger } from "pino";
import type { AuthService } from "./auth.js";

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class AzureDevOpsError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "AzureDevOpsError";
  }
}

export class RateLimitError extends AzureDevOpsError {
  constructor(
    message: string,
    public retryAfterSeconds?: number
  ) {
    super(message, 429);
    this.name = "RateLimitError";
  }
}

/**
 * Azure DevOps Work Item Tracking REST API client (v7.1)
 *
 * Features:
 * - Service Principal + PAT authentication
 * - Exponential backoff retry logic
 * - Rate limit handling (429 responses)
 * - Batch operations support (max 200 items)
 */
export class AzureDevOpsService {
  private organizationUrl: string;
  private authService: AuthService;
  private logger?: Logger;
  private retryConfig: RetryConfig;

  constructor(
    organizationUrl: string,
    authService: AuthService,
    logger?: Logger,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ) {
    this.organizationUrl = organizationUrl;
    this.authService = authService;
    this.logger = logger;
    this.retryConfig = retryConfig;
  }

  /**
   * Get a single work item by ID
   */
  async getWorkItem(projectId: string, workItemId: number): Promise<WorkItem> {
    const url = `${this.organizationUrl}/${projectId}/_apis/wit/workitems/${workItemId}?api-version=7.1`;

    this.logger?.debug({ projectId, workItemId }, "Fetching work item");

    const response = await this.fetchWithRetry(url, {
      method: "GET",
    });

    return response.json();
  }

  /**
   * Get multiple work items by IDs (max 200 per request)
   */
  async getWorkItemsBatch(projectId: string, workItemIds: number[]): Promise<WorkItem[]> {
    if (workItemIds.length === 0) {
      return [];
    }

    if (workItemIds.length > 200) {
      this.logger?.warn({ count: workItemIds.length }, "Batch size exceeds 200, chunking requests");

      const chunks = this.chunkArray(workItemIds, 200);
      const results = await Promise.all(
        chunks.map((chunk) => this.getWorkItemsBatch(projectId, chunk))
      );

      return results.flat();
    }

    const url = `${this.organizationUrl}/${projectId}/_apis/wit/workitems?ids=${workItemIds.join(",")}&api-version=7.1`;

    this.logger?.debug({ projectId, count: workItemIds.length }, "Fetching work items batch");

    const response = await this.fetchWithRetry(url, {
      method: "GET",
    });

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Create a new work item
   */
  async createWorkItem(
    projectId: string,
    workItemType: string,
    fields: Record<string, string | number>
  ): Promise<WorkItem> {
    const url = `${this.organizationUrl}/${projectId}/_apis/wit/workitems/$${workItemType}?api-version=7.1`;

    const body = Object.entries(fields).map(([field, value]) => ({
      op: "add",
      path: `/fields/${field}`,
      value,
    }));

    this.logger?.debug(
      { projectId, workItemType, fieldCount: Object.keys(fields).length },
      "Creating work item"
    );

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  /**
   * Update an existing work item
   */
  async updateWorkItem(
    projectId: string,
    workItemId: number,
    fields: Record<string, string | number>
  ): Promise<WorkItem> {
    const url = `${this.organizationUrl}/${projectId}/_apis/wit/workitems/${workItemId}?api-version=7.1`;

    const body = Object.entries(fields).map(([field, value]) => ({
      op: "add",
      path: `/fields/${field}`,
      value,
    }));

    this.logger?.debug(
      { projectId, workItemId, fieldCount: Object.keys(fields).length },
      "Updating work item"
    );

    const response = await this.fetchWithRetry(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json-patch+json",
      },
      body: JSON.stringify(body),
    });

    return response.json();
  }

  /**
   * Get related work items (System.LinkTypes.Related)
   */
  async getRelatedWorkItems(projectId: string, workItemId: number): Promise<WorkItem[]> {
    return this.getWorkItemsByRelationType(projectId, workItemId, "System.LinkTypes.Related");
  }

  /**
   * Get child work items (System.LinkTypes.Hierarchy-Forward)
   */
  async getChildWorkItems(projectId: string, workItemId: number): Promise<WorkItem[]> {
    return this.getWorkItemsByRelationType(
      projectId,
      workItemId,
      "System.LinkTypes.Hierarchy-Forward"
    );
  }

  /**
   * Get parent work item (System.LinkTypes.Hierarchy-Reverse)
   */
  async getParentWorkItem(projectId: string, workItemId: number): Promise<WorkItem | null> {
    const parents = await this.getWorkItemsByRelationType(
      projectId,
      workItemId,
      "System.LinkTypes.Hierarchy-Reverse"
    );

    return parents[0] || null;
  }

  /**
   * Search work items using WIQL (Work Item Query Language)
   */
  async searchWorkItems(projectId: string, wiql: string): Promise<WorkItem[]> {
    const url = `${this.organizationUrl}/${projectId}/_apis/wit/wiql?api-version=7.1`;

    this.logger?.debug({ projectId, wiql }, "Executing WIQL query");

    const response = await this.fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: wiql }),
    });

    const data = await response.json();
    const workItemIds = data.workItems?.map((wi: { id: number }) => wi.id) || [];

    if (workItemIds.length === 0) {
      return [];
    }

    return this.getWorkItemsBatch(projectId, workItemIds);
  }

  /**
   * Get work items by relation type
   */
  private async getWorkItemsByRelationType(
    projectId: string,
    workItemId: number,
    relationType: string
  ): Promise<WorkItem[]> {
    const url = `${this.organizationUrl}/${projectId}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.1`;

    const response = await this.fetchWithRetry(url, {
      method: "GET",
    });

    const workItem = await response.json();

    if (!workItem.relations) {
      return [];
    }

    const links = workItem.relations.filter((rel: { rel: string }) => rel.rel === relationType);

    const relatedIds = links
      .map((link: { url: string }) => {
        const idMatch = link.url.match(/\/workitems\/(\d+)$/);
        return idMatch ? parseInt(idMatch[1]) : null;
      })
      .filter((id: number | null): id is number => id !== null);

    if (relatedIds.length === 0) {
      return [];
    }

    return this.getWorkItemsBatch(projectId, relatedIds);
  }

  /**
   * Fetch with automatic retry and rate limit handling
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempt: number = 0
  ): Promise<Response> {
    try {
      const authHeaders = await this.authService.getAuthHeaders();

      const response = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle successful responses
      if (response.ok) {
        return response;
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = this.getRetryAfterSeconds(response);

        this.logger?.warn({ attempt, retryAfter, url }, "Rate limit exceeded, retrying");

        if (attempt < this.retryConfig.maxRetries) {
          await this.sleep(retryAfter * 1000);
          return this.fetchWithRetry(url, options, attempt + 1);
        }

        throw new RateLimitError(`Rate limit exceeded after ${attempt} retries`, retryAfter);
      }

      // Handle authentication errors (401)
      if (response.status === 401) {
        this.logger?.warn({ attempt, url }, "Authentication failed, invalidating token");
        this.authService.invalidateToken();

        if (attempt < this.retryConfig.maxRetries) {
          await this.sleep(this.retryConfig.initialDelayMs);
          return this.fetchWithRetry(url, options, attempt + 1);
        }
      }

      // Handle transient errors (5xx)
      if (response.status >= 500 && attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt);

        this.logger?.warn(
          { attempt, delay, status: response.status, url },
          "Server error, retrying with backoff"
        );

        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      // Non-retryable error
      const errorText = await response.text();
      this.logger?.error(
        { status: response.status, error: errorText, url },
        "Azure DevOps API error"
      );

      throw new AzureDevOpsError(
        `Azure DevOps API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    } catch (error) {
      if (error instanceof AzureDevOpsError || error instanceof RateLimitError) {
        throw error;
      }

      // Network or other errors - retry if attempts remaining
      if (attempt < this.retryConfig.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt);

        this.logger?.warn({ attempt, delay, error, url }, "Request failed, retrying with backoff");

        await this.sleep(delay);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      this.logger?.error({ error, url }, "Request failed after all retries");
      throw new AzureDevOpsError("Failed to connect to Azure DevOps", undefined, error);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay =
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt);

    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  /**
   * Get retry-after seconds from response headers
   */
  private getRetryAfterSeconds(response: Response): number {
    const retryAfter = response.headers.get("Retry-After");

    if (retryAfter) {
      const seconds = parseInt(retryAfter);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }

    // Default to 60 seconds if no header
    return 60;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Split array into chunks of specified size
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
