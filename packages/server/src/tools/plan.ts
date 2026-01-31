import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { SessionManager } from "../sessions/session-manager.js";
import type { Logger } from "pino";
import { z } from "zod";

const planSchema = z.object({
  sessionId: z.string().describe("Session ID"),
  workItemId: z.number().int().positive().describe("Work item ID to plan for"),
  projectId: z.string().describe("Azure DevOps project ID"),
  approach: z.string().optional().describe("Preferred approach or methodology for breakdown"),
});

export type PlanInput = z.infer<typeof planSchema>;

export interface SubTask {
  title: string;
  description: string;
  workItemType: string;
  estimatedEffort?: number;
  dependencies?: number[];
  priority?: number;
}

export interface ExecutionPlan {
  parentWorkItemId: number;
  parentTitle: string;
  subtasks: SubTask[];
  totalEstimatedEffort?: number;
  notes?: string;
}

/**
 * Plan tool - Creates execution plan with subtask breakdown
 *
 * This tool analyzes a specified work item and creates a detailed plan:
 * 1. Reads specification from session
 * 2. Breaks down into manageable subtasks
 * 3. Identifies dependencies between tasks
 * 4. Estimates effort (optional)
 * 5. Stores plan in session for execution
 */
export async function plan(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  sessionManager: SessionManager,
  logger?: Logger
): Promise<ExecutionPlan> {
  // Validate input
  const validated = planSchema.parse(input);
  const { sessionId, workItemId, projectId, approach } = validated;

  logger?.info({ sessionId, workItemId }, "Starting plan flow");

  try {
    // Get session
    const session = await sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get specification from session or fetch work item
    const specification =
      (session.context?.specification as string) || "No specification available";

    // Fetch work item details
    const workItem = await azureDevOps.getWorkItem(projectId, workItemId);
    const fields = (workItem as { fields?: Record<string, unknown> }).fields || {};
    const title = fields["System.Title"] as string;
    const description = fields["System.Description"] as string;
    const workItemType = fields["System.WorkItemType"] as string;

    // Get existing children to avoid duplicates
    const existingChildren = await azureDevOps.getChildWorkItems(projectId, workItemId);

    logger?.debug(
      { workItemId, existingChildrenCount: existingChildren.length },
      "Analyzing for plan creation"
    );

    // Generate plan based on work item type and specification
    const executionPlan = generatePlan({
      workItemId,
      title,
      description,
      workItemType,
      specification,
      existingChildren,
      approach,
    });

    // Store plan in session
    session.context = {
      ...session.context,
      executionPlan,
    };
    session.state = "plan";

    logger?.info(
      { sessionId, subtaskCount: executionPlan.subtasks.length },
      "Plan created successfully"
    );

    return executionPlan;
  } catch (error) {
    logger?.error({ error, sessionId, workItemId }, "Failed to create plan");
    throw new Error(
      `Failed to create plan: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generate execution plan with subtask breakdown
 */
function generatePlan(context: {
  workItemId: number;
  title: string;
  description: string;
  workItemType: string;
  specification: string;
  existingChildren: unknown[];
  approach?: string;
}): ExecutionPlan {
  const {
    workItemId,
    title,
    workItemType,
    description,
    specification,
    existingChildren,
    approach,
  } = context;

  const subtasks: SubTask[] = [];

  // Different breakdown strategies based on work item type
  switch (workItemType) {
    case "Feature":
    case "Epic":
      subtasks.push(...breakdownFeature(title, description, specification));
      break;

    case "User Story":
      subtasks.push(...breakdownUserStory(title, description, specification));
      break;

    case "Bug":
      subtasks.push(...breakdownBug(title, description, specification));
      break;

    default:
      subtasks.push(...breakdownGeneric(title, description, specification));
  }

  // Add approach-specific tasks if specified
  if (approach) {
    subtasks.push(...addApproachSpecificTasks(approach));
  }

  // Filter out tasks that might already exist
  const existingTitles = existingChildren.map((child) => {
    const fields = (child as { fields?: Record<string, unknown> }).fields || {};
    return fields["System.Title"] as string;
  });

  const filteredSubtasks = subtasks.filter(
    (task) => !existingTitles.some((existing) => existing === task.title)
  );

  return {
    parentWorkItemId: workItemId,
    parentTitle: title,
    subtasks: filteredSubtasks,
    totalEstimatedEffort: filteredSubtasks.reduce(
      (sum, task) => sum + (task.estimatedEffort || 0),
      0
    ),
    notes:
      existingChildren.length > 0
        ? `Filtered out ${subtasks.length - filteredSubtasks.length} potentially duplicate tasks`
        : undefined,
  };
}

/**
 * Breakdown strategy for Features/Epics
 */
function breakdownFeature(title: string, _description: string, _specification: string): SubTask[] {
  return [
    {
      title: `[Analysis] Research and design for ${title}`,
      description: "Research technical approach, design architecture, and identify dependencies",
      workItemType: "Task",
      estimatedEffort: 5,
      priority: 1,
    },
    {
      title: `[Implementation] Core implementation for ${title}`,
      description: "Implement main functionality based on design",
      workItemType: "Task",
      estimatedEffort: 13,
      dependencies: [0],
      priority: 1,
    },
    {
      title: `[Testing] Test ${title}`,
      description: "Write unit tests, integration tests, and perform QA",
      workItemType: "Task",
      estimatedEffort: 8,
      dependencies: [1],
      priority: 2,
    },
    {
      title: `[Documentation] Document ${title}`,
      description: "Update documentation, write user guides if needed",
      workItemType: "Task",
      estimatedEffort: 3,
      dependencies: [1],
      priority: 3,
    },
  ];
}

/**
 * Breakdown strategy for User Stories
 */
function breakdownUserStory(
  title: string,
  _description: string,
  _specification: string
): SubTask[] {
  return [
    {
      title: `[Design] UI/UX design for ${title}`,
      description: "Create mockups and define user interactions",
      workItemType: "Task",
      estimatedEffort: 3,
      priority: 1,
    },
    {
      title: `[Backend] API implementation for ${title}`,
      description: "Implement backend API endpoints and business logic",
      workItemType: "Task",
      estimatedEffort: 5,
      priority: 1,
    },
    {
      title: `[Frontend] UI implementation for ${title}`,
      description: "Implement frontend components and integration",
      workItemType: "Task",
      estimatedEffort: 5,
      dependencies: [0, 1],
      priority: 2,
    },
    {
      title: `[Testing] Test ${title}`,
      description: "Write tests and validate acceptance criteria",
      workItemType: "Task",
      estimatedEffort: 3,
      dependencies: [2],
      priority: 2,
    },
  ];
}

/**
 * Breakdown strategy for Bugs
 */
function breakdownBug(title: string, _description: string, _specification: string): SubTask[] {
  return [
    {
      title: `[Investigation] Root cause analysis for ${title}`,
      description: "Investigate and identify root cause of the bug",
      workItemType: "Task",
      estimatedEffort: 2,
      priority: 1,
    },
    {
      title: `[Fix] Implement fix for ${title}`,
      description: "Implement and test the fix",
      workItemType: "Task",
      estimatedEffort: 3,
      dependencies: [0],
      priority: 1,
    },
    {
      title: `[Verification] Verify fix for ${title}`,
      description: "Verify fix resolves the issue and doesn't introduce regressions",
      workItemType: "Task",
      estimatedEffort: 2,
      dependencies: [1],
      priority: 2,
    },
  ];
}

/**
 * Generic breakdown strategy
 */
function breakdownGeneric(title: string, _description: string, _specification: string): SubTask[] {
  return [
    {
      title: `[Planning] Plan ${title}`,
      description: "Define scope and approach",
      workItemType: "Task",
      estimatedEffort: 2,
      priority: 1,
    },
    {
      title: `[Implementation] Implement ${title}`,
      description: "Core implementation work",
      workItemType: "Task",
      estimatedEffort: 8,
      dependencies: [0],
      priority: 1,
    },
    {
      title: `[Review] Review ${title}`,
      description: "Code review and testing",
      workItemType: "Task",
      estimatedEffort: 3,
      dependencies: [1],
      priority: 2,
    },
  ];
}

/**
 * Add approach-specific tasks
 */
function addApproachSpecificTasks(approach: string): SubTask[] {
  const tasks: SubTask[] = [];

  if (approach.toLowerCase().includes("tdd")) {
    tasks.push({
      title: "[TDD] Write tests first",
      description: "Write test cases before implementation",
      workItemType: "Task",
      estimatedEffort: 3,
      priority: 1,
    });
  }

  if (approach.toLowerCase().includes("spike")) {
    tasks.push({
      title: "[Spike] Technical investigation",
      description: "Time-boxed technical investigation",
      workItemType: "Task",
      estimatedEffort: 5,
      priority: 1,
    });
  }

  return tasks;
}

// Export schema for tool registry
export const planToolDefinition = {
  name: "plan",
  description:
    "Create an execution plan with subtask breakdown for a work item. Analyzes the specification and generates organized subtasks with dependencies and estimates. Use this after specification is complete.",
  input_schema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string" as const,
        description: "Session ID",
      },
      workItemId: {
        type: "number" as const,
        description: "Work item ID to plan for",
      },
      projectId: {
        type: "string" as const,
        description: "Azure DevOps project ID",
      },
      approach: {
        type: "string" as const,
        description: "Preferred approach or methodology (e.g., TDD, spike)",
      },
    },
    required: ["sessionId", "workItemId", "projectId"],
  },
};
