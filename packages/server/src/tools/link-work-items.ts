import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { linkWorkItemsSchema } from "./schemas.js";

/**
 * Map link type to Azure DevOps relation type
 */
function getLinkRelationType(linkType: string): string {
  switch (linkType) {
    case "parent-child":
      return "System.LinkTypes.Hierarchy-Forward";
    case "related":
      return "System.LinkTypes.Related";
    case "predecessor":
      return "System.LinkTypes.Dependency-Predecessor";
    case "successor":
      return "System.LinkTypes.Dependency-Successor";
    default:
      throw new Error(`Unknown link type: ${linkType}`);
  }
}

/**
 * Link work items tool
 * Creates a link between two work items
 *
 * NOTE: This requires adding a linkWorkItems method to AzureDevOpsService
 * For now, this is a placeholder implementation
 */
export async function linkWorkItems(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  logger?: Logger
): Promise<{ success: boolean; message: string }> {
  // Validate input
  const validated = linkWorkItemsSchema.parse(input);
  const { projectId, sourceWorkItemId, targetWorkItemId, linkType } = validated;

  logger?.info({ projectId, sourceWorkItemId, targetWorkItemId, linkType }, "Linking work items");

  try {
    const relationType = getLinkRelationType(linkType);

    logger?.debug({ relationType }, "Using Azure DevOps relation type");

    // NOTE: Link creation requires extending AzureDevOpsService with linkWorkItems method
    logger?.warn(
      { sourceWorkItemId, targetWorkItemId, linkType },
      "Link creation not yet fully implemented - requires AzureDevOpsService.linkWorkItems method"
    );

    return {
      success: false,
      message:
        "Link work items functionality is not yet fully implemented. Need to add linkWorkItems method to AzureDevOpsService.",
    };
  } catch (error) {
    logger?.error(
      { error, projectId, sourceWorkItemId, targetWorkItemId },
      "Failed to link work items"
    );
    throw new Error(
      `Failed to link work items: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
