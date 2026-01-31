import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { SessionManager } from "../sessions/session-manager.js";
import type { Logger } from "pino";
import { z } from "zod";

const specifySchema = z.object({
  sessionId: z.string().describe("Session ID"),
  workItemId: z.number().int().positive().describe("Work item ID to specify"),
  projectId: z.string().describe("Azure DevOps project ID"),
  userResponses: z
    .record(z.string(), z.string())
    .optional()
    .describe("User responses to clarifying questions"),
});

export type SpecifyInput = z.infer<typeof specifySchema>;

export interface SpecificationResult {
  specification: string;
  clarifyingQuestions?: string[];
  needsMoreInfo: boolean;
  state: "gathering" | "complete";
}

/**
 * Specify tool - Clarifies requirements for a work item
 *
 * This tool helps gather detailed requirements by:
 * 1. Analyzing the work item context
 * 2. Identifying missing or unclear information
 * 3. Generating clarifying questions
 * 4. Building a structured specification
 */
export async function specify(
  input: unknown,
  azureDevOps: AzureDevOpsService,
  sessionManager: SessionManager,
  logger?: Logger
): Promise<SpecificationResult> {
  // Validate input
  const validated = specifySchema.parse(input);
  const { sessionId, workItemId, projectId, userResponses } = validated;

  logger?.info({ sessionId, workItemId }, "Starting specify flow");

  try {
    // Get session
    const session = await sessionManager.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Fetch work item details
    const workItem = await azureDevOps.getWorkItem(projectId, workItemId);

    // Get children and related items for context
    const [children, related] = await Promise.all([
      azureDevOps.getChildWorkItems(projectId, workItemId),
      azureDevOps.getRelatedWorkItems(projectId, workItemId),
    ]);

    // Build context
    const context = {
      workItem,
      children,
      related,
      userResponses: userResponses || {},
    };

    // Store context in session
    session.context = {
      ...session.context,
      specifyContext: context,
    };

    // Analyze and generate specification
    const result = analyzeWorkItem(context);

    // Update session state
    if (result.state === "complete") {
      session.state = "specify";
      session.context.specification = result.specification;
      logger?.info({ sessionId }, "Specification complete");
    } else {
      logger?.info(
        { sessionId, questionsCount: result.clarifyingQuestions?.length },
        "Need more information"
      );
    }

    return result;
  } catch (error) {
    logger?.error({ error, sessionId, workItemId }, "Failed to specify");
    throw new Error(
      `Failed to specify work item: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Analyze work item and generate specification
 */
function analyzeWorkItem(context: {
  workItem: unknown;
  children: unknown[];
  related: unknown[];
  userResponses: Record<string, string>;
}): SpecificationResult {
  const { workItem, children, related, userResponses } = context;

  // Extract work item fields
  const fields = (workItem as { fields?: Record<string, unknown> }).fields || {};
  const title = fields["System.Title"] as string;
  const description = fields["System.Description"] as string;
  const workItemType = fields["System.WorkItemType"] as string;

  // Check what information we have
  const hasDescription = description && description.length > 20;
  const hasChildren = children.length > 0;
  const hasUserInput = Object.keys(userResponses).length > 0;

  // Generate clarifying questions if needed
  const questions: string[] = [];

  if (!hasDescription && !hasUserInput) {
    questions.push(
      "What is the detailed description and goal of this work item?",
      "What are the acceptance criteria?",
      "Are there any technical constraints or dependencies?"
    );
  }

  if (workItemType === "User Story" || workItemType === "Feature") {
    if (!userResponses.scenarios) {
      questions.push("What are the key user scenarios or use cases?");
    }
    if (!userResponses.stakeholders) {
      questions.push("Who are the stakeholders or end users?");
    }
  }

  if (workItemType === "Bug" && !userResponses.reproduction) {
    questions.push(
      "What are the steps to reproduce the issue?",
      "What is the expected vs actual behavior?"
    );
  }

  // If we have enough information, generate specification
  if (questions.length === 0 || hasUserInput) {
    const specification = buildSpecification({
      title,
      description,
      workItemType,
      userResponses,
      hasChildren,
      childrenCount: children.length,
      relatedCount: related.length,
    });

    return {
      specification,
      needsMoreInfo: false,
      state: "complete",
    };
  }

  // Need more information
  return {
    specification: `Analyzing work item: ${title}`,
    clarifyingQuestions: questions,
    needsMoreInfo: true,
    state: "gathering",
  };
}

/**
 * Build structured specification from gathered information
 */
function buildSpecification(info: {
  title: string;
  description: string;
  workItemType: string;
  userResponses: Record<string, string>;
  hasChildren: boolean;
  childrenCount: number;
  relatedCount: number;
}): string {
  const sections: string[] = [];

  // Title and type
  sections.push(`# ${info.title}`);
  sections.push(`**Type:** ${info.workItemType}\n`);

  // Description
  if (info.description) {
    sections.push(`## Description`);
    sections.push(info.description);
    sections.push("");
  }

  // User responses
  if (info.userResponses.scenarios) {
    sections.push(`## User Scenarios`);
    sections.push(info.userResponses.scenarios);
    sections.push("");
  }

  if (info.userResponses.stakeholders) {
    sections.push(`## Stakeholders`);
    sections.push(info.userResponses.stakeholders);
    sections.push("");
  }

  if (info.userResponses.reproduction) {
    sections.push(`## Reproduction Steps`);
    sections.push(info.userResponses.reproduction);
    sections.push("");
  }

  if (info.userResponses.acceptance) {
    sections.push(`## Acceptance Criteria`);
    sections.push(info.userResponses.acceptance);
    sections.push("");
  }

  if (info.userResponses.constraints) {
    sections.push(`## Technical Constraints`);
    sections.push(info.userResponses.constraints);
    sections.push("");
  }

  // Context
  if (info.hasChildren || info.relatedCount > 0) {
    sections.push(`## Context`);
    if (info.hasChildren) {
      sections.push(`- Has ${info.childrenCount} existing subtasks`);
    }
    if (info.relatedCount > 0) {
      sections.push(`- Related to ${info.relatedCount} other work items`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

// Export schema for tool registry
export const specifyToolDefinition = {
  name: "specify",
  description:
    "Clarify and document requirements for a work item by analyzing context and asking clarifying questions. Use this before creating a plan.",
  input_schema: {
    type: "object" as const,
    properties: {
      sessionId: {
        type: "string" as const,
        description: "Session ID",
      },
      workItemId: {
        type: "number" as const,
        description: "Work item ID to specify",
      },
      projectId: {
        type: "string" as const,
        description: "Azure DevOps project ID",
      },
      userResponses: {
        type: "object" as const,
        description: "User responses to clarifying questions",
      },
    },
    required: ["sessionId", "workItemId", "projectId"],
  },
};
