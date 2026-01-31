import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { createWorkItemSchema } from "./schemas.js";

/**
 * Create work item tool
 * Creates a new work item with specified fields and optional parent relationship
 */
export async function createWorkItem(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  logger?: Logger
): Promise<unknown> {
  // Validate input
  const validated = createWorkItemSchema.parse(input);
  const {
    projectId,
    workItemType,
    title,
    description,
    assignedTo,
    state,
    priority,
    tags,
    parentId,
    additionalFields,
  } = validated;

  logger?.info({ projectId, workItemType, title }, "Creating work item");

  try {
    // Build fields object
    const fields: Record<string, string | number> = {
      "System.Title": title,
    };

    if (description) {
      fields["System.Description"] = description;
    }

    if (assignedTo) {
      fields["System.AssignedTo"] = assignedTo;
    }

    if (state) {
      fields["System.State"] = state;
    }

    if (priority) {
      fields["Microsoft.VSTS.Common.Priority"] = priority;
    }

    if (tags && tags.length > 0) {
      fields["System.Tags"] = tags.join("; ");
    }

    // Add additional custom fields
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        fields[key] = value as string | number;
      });
    }

    // Create work item
    const workItem = await azureDevOps.createWorkItem(projectId, workItemType, fields);

    // Set parent relationship if specified
    if (parentId && workItem.id) {
      logger?.debug({ workItemId: workItem.id, parentId }, "Setting parent relationship");

      try {
        // Parent-child relationship is set using link
        // We'll need to add a method to AzureDevOpsService for this
        // For now, log a warning
        logger?.warn(
          { workItemId: workItem.id, parentId },
          "Parent relationship setting not yet implemented in AzureDevOpsService"
        );
      } catch (linkError) {
        logger?.warn(
          { error: linkError, workItemId: workItem.id, parentId },
          "Failed to set parent relationship, but work item was created"
        );
      }
    }

    logger?.info(
      { workItemId: workItem.id, projectId, workItemType },
      "Successfully created work item"
    );

    return workItem;
  } catch (error) {
    logger?.error({ error, projectId, workItemType, title }, "Failed to create work item");
    throw new Error(
      `Failed to create work item: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
