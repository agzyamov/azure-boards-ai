import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { readWorkItemSchema } from "./schemas.js";

export interface ReadWorkItemResult {
  workItem: unknown;
  children?: unknown[];
  parent?: unknown | null;
  related?: unknown[];
}

/**
 * Read work item tool
 * Gets work item details with optional children, parent, and related items
 */
export async function readWorkItem(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  logger?: Logger
): Promise<ReadWorkItemResult> {
  // Validate input
  const validated = readWorkItemSchema.parse(input);
  const { projectId, workItemId, includeChildren, includeParent, includeRelated } = validated;

  logger?.info({ projectId, workItemId }, "Reading work item");

  try {
    // Fetch main work item
    const workItem = await azureDevOps.getWorkItem(projectId, workItemId);

    const result: ReadWorkItemResult = { workItem };

    // Fetch children if requested
    if (includeChildren) {
      logger?.debug({ workItemId }, "Fetching child work items");
      result.children = await azureDevOps.getChildWorkItems(projectId, workItemId);
    }

    // Fetch parent if requested
    if (includeParent) {
      logger?.debug({ workItemId }, "Fetching parent work item");
      result.parent = await azureDevOps.getParentWorkItem(projectId, workItemId);
    }

    // Fetch related items if requested
    if (includeRelated) {
      logger?.debug({ workItemId }, "Fetching related work items");
      result.related = await azureDevOps.getRelatedWorkItems(projectId, workItemId);
    }

    logger?.info(
      {
        workItemId,
        childrenCount: result.children?.length ?? 0,
        hasParent: !!result.parent,
        relatedCount: result.related?.length ?? 0,
      },
      "Successfully read work item"
    );

    return result;
  } catch (error) {
    logger?.error({ error, projectId, workItemId }, "Failed to read work item");
    throw new Error(
      `Failed to read work item ${workItemId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
