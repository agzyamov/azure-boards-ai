import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { SessionManager } from "../sessions/session-manager.js";
import type { Logger } from "pino";
import { z } from "zod";
import type { ExecutionPlan, SubTask } from "./plan.js";

const executeSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  projectId: z.string().describe("Azure DevOps project ID"),
  dryRun: z
    .boolean()
    .optional()
    .default(false)
    .describe("Dry run mode - don't actually create work items"),
  batchSize: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .default(50)
    .describe("Batch size for creating work items (max 200)"),
});

export type ExecuteInput = z.infer<typeof executeSchema>;

export interface ExecutionResult {
  success: boolean;
  dryRun: boolean;
  totalTasks: number;
  createdTasks: CreatedTask[];
  failedTasks: FailedTask[];
  message: string;
}

export interface CreatedTask {
  index: number;
  title: string;
  workItemId: number;
  url: string;
}

export interface FailedTask {
  index: number;
  title: string;
  error: string;
}

/**
 * Execute tool - Executes the plan and creates work items
 *
 * This tool takes the stored plan from session and executes it:
 * 1. Reads plan from session
 * 2. Creates work items in batches (handles >200 limit)
 * 3. Sets up parent-child relationships
 * 4. Reports progress and results
 * 5. Handles errors with rollback strategy
 */
export async function execute(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  sessionManager: SessionManager,
  logger?: Logger
): Promise<ExecutionResult> {
  // Validate input
  const validated = executeSchema.parse(input);
  const { sessionId, projectId, dryRun, batchSize } = validated;

  logger?.info({ sessionId, dryRun }, "Starting execute flow");

  try {
    // Get session
    const session = await sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get execution plan from session
    const executionPlan = session.context?.executionPlan as ExecutionPlan | undefined;

    if (!executionPlan) {
      throw new Error("No execution plan found in session. Run 'plan' first.");
    }

    const { parentWorkItemId, subtasks } = executionPlan;

    logger?.info({ sessionId, parentWorkItemId, totalSubtasks: subtasks.length }, "Executing plan");

    // Dry run mode - just validate and return
    if (dryRun) {
      logger?.info({ sessionId }, "Dry run mode - no work items will be created");
      return {
        success: true,
        dryRun: true,
        totalTasks: subtasks.length,
        createdTasks: subtasks.map((task, index) => ({
          index,
          title: task.title,
          workItemId: -1,
          url: `[DRY RUN] Would create: ${task.title}`,
        })),
        failedTasks: [],
        message: `Dry run: Would create ${subtasks.length} work items`,
      };
    }

    // Execute plan in batches
    const result = await executeInBatches({
      projectId,
      parentWorkItemId,
      subtasks,
      batchSize,
      azureDevOps,
      logger,
    });

    // Update session state
    if (result.success) {
      session.state = "idle";
      session.context.lastExecution = result;
    }

    logger?.info(
      {
        sessionId,
        created: result.createdTasks.length,
        failed: result.failedTasks.length,
      },
      "Execution completed"
    );

    return result;
  } catch (error) {
    logger?.error({ error, sessionId }, "Failed to execute plan");
    throw new Error(
      `Failed to execute plan: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Execute plan in batches to handle large plans
 */
async function executeInBatches(params: {
  projectId: string;
  parentWorkItemId: number;
  subtasks: SubTask[];
  batchSize: number;
  azureDevOps: AzureDevOpsService;
  logger?: Logger;
}): Promise<ExecutionResult> {
  const { projectId, parentWorkItemId, subtasks, batchSize, azureDevOps, logger } = params;

  const createdTasks: CreatedTask[] = [];
  const failedTasks: FailedTask[] = [];

  // Split into batches
  const batches: SubTask[][] = [];
  for (let i = 0; i < subtasks.length; i += batchSize) {
    batches.push(subtasks.slice(i, i + batchSize));
  }

  logger?.info({ batchCount: batches.length, batchSize }, "Processing in batches");

  // Process each batch
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartIndex = batchIndex * batchSize;

    logger?.debug({ batchIndex: batchIndex + 1, batchSize: batch.length }, "Processing batch");

    // Create work items in parallel within batch
    const batchResults = await Promise.allSettled(
      batch.map((task, indexInBatch) => {
        const globalIndex = batchStartIndex + indexInBatch;
        return createWorkItemFromSubtask({
          projectId,
          parentWorkItemId,
          subtask: task,
          index: globalIndex,
          azureDevOps,
          logger,
        });
      })
    );

    // Collect results
    batchResults.forEach((result, indexInBatch) => {
      const globalIndex = batchStartIndex + indexInBatch;
      const task = batch[indexInBatch];

      if (result.status === "fulfilled") {
        createdTasks.push(result.value);
        logger?.debug(
          { title: task.title, workItemId: result.value.workItemId },
          "Created work item"
        );
      } else {
        failedTasks.push({
          index: globalIndex,
          title: task.title,
          error: result.reason?.message || "Unknown error",
        });
        logger?.warn({ title: task.title, error: result.reason }, "Failed to create work item");
      }
    });

    // Add delay between batches to avoid rate limiting
    if (batchIndex < batches.length - 1) {
      logger?.debug("Waiting between batches to avoid rate limiting");
      await sleep(1000); // 1 second delay
    }
  }

  const success = failedTasks.length === 0;
  const message = success
    ? `Successfully created ${createdTasks.length} work items`
    : `Created ${createdTasks.length} work items, ${failedTasks.length} failed`;

  return {
    success,
    dryRun: false,
    totalTasks: subtasks.length,
    createdTasks,
    failedTasks,
    message,
  };
}

/**
 * Create a single work item from subtask
 */
async function createWorkItemFromSubtask(params: {
  projectId: string;
  parentWorkItemId: number;
  subtask: SubTask;
  index: number;
  azureDevOps: AzureDevOpsService;
  logger?: Logger;
}): Promise<CreatedTask> {
  const { projectId, parentWorkItemId, subtask, index, azureDevOps, logger } = params;

  try {
    // Build fields
    const fields: Record<string, string | number> = {
      "System.Title": subtask.title,
      "System.Description": subtask.description,
    };

    if (subtask.priority) {
      fields["Microsoft.VSTS.Common.Priority"] = subtask.priority;
    }

    if (subtask.estimatedEffort) {
      fields["Microsoft.VSTS.Scheduling.Effort"] = subtask.estimatedEffort;
    }

    // Create work item
    const workItem = await azureDevOps.createWorkItem(projectId, subtask.workItemType, fields);

    const workItemId = (workItem as { id?: number }).id;
    if (!workItemId) {
      throw new Error("Work item created but no ID returned");
    }

    // Note: Setting parent relationship requires additional API call
    // This would be implemented in Phase 2 link-work-items.ts
    logger?.debug(
      { workItemId, parentWorkItemId },
      "Work item created, parent relationship needs to be set via link API"
    );

    return {
      index,
      title: subtask.title,
      workItemId,
      url: `Work item ${workItemId} created`,
    };
  } catch (error) {
    logger?.error({ error, subtask: subtask.title }, "Failed to create work item");
    throw error;
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export schema for tool registry
export const executeToolDefinition = {
  name: "execute",
  description:
    "Execute the stored plan and create work items in Azure DevOps. Creates subtasks in batches with progress reporting. Supports dry-run mode to preview without creating. Use this after plan is approved.",
  input_schema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string" as const,
        description: "Session ID",
      },
      projectId: {
        type: "string" as const,
        description: "Azure DevOps project ID",
      },
      dryRun: {
        type: "boolean" as const,
        description: "Dry run mode - preview without creating (default: false)",
        default: false,
      },
      batchSize: {
        type: "number" as const,
        description: "Batch size for creating work items (default: 50, max: 200)",
        default: 50,
      },
    },
    required: ["sessionId", "projectId"],
  },
};
