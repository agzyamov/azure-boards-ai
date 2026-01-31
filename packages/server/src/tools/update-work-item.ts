import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { updateWorkItemSchema } from "./schemas.js";

/**
 * Update work item tool
 * Updates an existing work item's fields
 */
export async function updateWorkItem(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  logger?: Logger
): Promise<unknown> {
  // Validate input
  const validated = updateWorkItemSchema.parse(input);
  const {
    projectId,
    workItemId,
    title,
    description,
    assignedTo,
    state,
    priority,
    tags,
    additionalFields,
  } = validated;

  logger?.info({ projectId, workItemId }, "Updating work item");

  try {
    // Build fields object with only provided values
    const fields: Record<string, string | number> = {};

    if (title !== undefined) {
      fields["System.Title"] = title;
    }

    if (description !== undefined) {
      fields["System.Description"] = description;
    }

    if (assignedTo !== undefined) {
      fields["System.AssignedTo"] = assignedTo;
    }

    if (state !== undefined) {
      fields["System.State"] = state;
    }

    if (priority !== undefined) {
      fields["Microsoft.VSTS.Common.Priority"] = priority;
    }

    if (tags !== undefined) {
      fields["System.Tags"] = tags.join("; ");
    }

    // Add additional custom fields
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        fields[key] = value as string | number;
      });
    }

    // Check if there are any fields to update
    if (Object.keys(fields).length === 0) {
      logger?.warn({ workItemId }, "No fields to update");
      throw new Error("No fields provided for update");
    }

    // Update work item
    const workItem = await azureDevOps.updateWorkItem(projectId, workItemId, fields);

    logger?.info(
      { workItemId, projectId, fieldsUpdated: Object.keys(fields).length },
      "Successfully updated work item"
    );

    return workItem;
  } catch (error) {
    logger?.error({ error, projectId, workItemId }, "Failed to update work item");
    throw new Error(
      `Failed to update work item ${workItemId}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
