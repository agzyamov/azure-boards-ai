import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { searchWorkItemsSchema, type SearchWorkItemsInput } from "./schemas.js";

/**
 * Build WIQL (Work Item Query Language) query from search parameters
 */
function buildWiqlQuery(input: SearchWorkItemsInput): string {
  const conditions: string[] = [];

  // Filter by work item type
  if (input.workItemType) {
    conditions.push(`[System.WorkItemType] = '${input.workItemType}'`);
  }

  // Filter by state
  if (input.state) {
    conditions.push(`[System.State] = '${input.state}'`);
  }

  // Filter by assigned user
  if (input.assignedTo) {
    conditions.push(`[System.AssignedTo] CONTAINS '${input.assignedTo}'`);
  }

  // Search in title/description
  if (input.query) {
    conditions.push(
      `([System.Title] CONTAINS '${input.query}' OR [System.Description] CONTAINS '${input.query}')`
    );
  }

  // Filter by tags
  if (input.tags && input.tags.length > 0) {
    const tagConditions = input.tags.map((tag) => `[System.Tags] CONTAINS '${tag}'`).join(" AND ");
    conditions.push(`(${tagConditions})`);
  }

  // Build full query
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return `SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], [System.AssignedTo] FROM WorkItems ${whereClause} ORDER BY [System.ChangedDate] DESC`;
}

/**
 * Search work items tool
 * Searches work items using WIQL query
 */
export async function searchWorkItems(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  logger?: Logger
): Promise<unknown[]> {
  // Validate input
  const validated = searchWorkItemsSchema.parse(input);
  const { projectId, limit } = validated;

  logger?.info({ projectId, filters: validated }, "Searching work items");

  try {
    // Build WIQL query
    const wiql = buildWiqlQuery(validated);

    logger?.debug({ wiql }, "Generated WIQL query");

    // Execute search
    const workItems = await azureDevOps.searchWorkItems(projectId, wiql);

    // Apply limit
    const limitedResults = workItems.slice(0, limit);

    logger?.info(
      {
        projectId,
        totalFound: workItems.length,
        returned: limitedResults.length,
      },
      "Search completed"
    );

    return limitedResults;
  } catch (error) {
    logger?.error({ error, projectId }, "Failed to search work items");
    throw new Error(
      `Failed to search work items: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
