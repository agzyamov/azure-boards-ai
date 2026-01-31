import { z } from "zod";

/**
 * Tool schemas for Claude agent
 * All tools use Zod for input validation
 */

// Common descriptions
const PROJECT_ID_DESCRIPTION = "Azure DevOps project ID";

// Read Work Item Tool
export const readWorkItemSchema = z.object({
  projectId: z.string().describe(PROJECT_ID_DESCRIPTION),
  workItemId: z.number().int().positive().describe("Work item ID"),
  includeChildren: z.boolean().optional().default(false).describe("Include child work items"),
  includeParent: z.boolean().optional().default(false).describe("Include parent work item"),
  includeRelated: z.boolean().optional().default(false).describe("Include related work items"),
});

export type ReadWorkItemInput = z.infer<typeof readWorkItemSchema>;

// Search Work Items Tool
export const searchWorkItemsSchema = z.object({
  projectId: z.string().describe(PROJECT_ID_DESCRIPTION),
  query: z.string().optional().describe("Search query for title/description"),
  state: z.string().optional().describe("Work item state (e.g., Active, New)"),
  workItemType: z.string().optional().describe("Work item type (e.g., Task, User Story, Bug)"),
  assignedTo: z.string().optional().describe("Assigned user email or name"),
  tags: z.array(z.string()).optional().describe("Tags to filter by"),
  limit: z
    .number()
    .int()
    .positive()
    .max(200)
    .optional()
    .default(50)
    .describe("Maximum number of results (max 200)"),
});

export type SearchWorkItemsInput = z.infer<typeof searchWorkItemsSchema>;

// Create Work Item Tool
export const createWorkItemSchema = z.object({
  projectId: z.string().describe(PROJECT_ID_DESCRIPTION),
  workItemType: z.string().describe("Work item type (e.g., Task, User Story, Bug, Feature)"),
  title: z.string().min(1).describe("Work item title"),
  description: z.string().optional().describe("Work item description"),
  assignedTo: z.string().optional().describe("Assigned user email"),
  state: z.string().optional().describe("Initial state (default: New)"),
  priority: z.number().int().min(1).max(4).optional().describe("Priority (1=highest, 4=lowest)"),
  tags: z.array(z.string()).optional().describe("Tags for the work item"),
  parentId: z.number().int().positive().optional().describe("Parent work item ID"),
  additionalFields: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .describe("Additional custom fields"),
});

export type CreateWorkItemInput = z.infer<typeof createWorkItemSchema>;

// Update Work Item Tool
export const updateWorkItemSchema = z.object({
  projectId: z.string().describe(PROJECT_ID_DESCRIPTION),
  workItemId: z.number().int().positive().describe("Work item ID to update"),
  title: z.string().optional().describe("New title"),
  description: z.string().optional().describe("New description"),
  assignedTo: z.string().optional().describe("New assigned user"),
  state: z.string().optional().describe("New state"),
  priority: z.number().int().min(1).max(4).optional().describe("New priority"),
  tags: z.array(z.string()).optional().describe("New tags (replaces existing)"),
  additionalFields: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional()
    .describe("Additional fields to update"),
});

export type UpdateWorkItemInput = z.infer<typeof updateWorkItemSchema>;

// Link Work Items Tool
export const linkWorkItemsSchema = z.object({
  projectId: z.string().describe(PROJECT_ID_DESCRIPTION),
  sourceWorkItemId: z.number().int().positive().describe("Source work item ID"),
  targetWorkItemId: z.number().int().positive().describe("Target work item ID"),
  linkType: z
    .enum(["parent-child", "related", "predecessor", "successor"])
    .describe("Link type: parent-child (source is parent), related, predecessor, successor"),
  comment: z.string().optional().describe("Comment for the link"),
});

export type LinkWorkItemsInput = z.infer<typeof linkWorkItemsSchema>;

// Tool definitions for Claude
export const toolDefinitions = [
  {
    name: "read_work_item",
    description:
      "Read a work item from Azure DevOps with all its details, optionally including children, parent, and related items",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string" as const,
          description: PROJECT_ID_DESCRIPTION,
        },
        workItemId: {
          type: "number" as const,
          description: "Work item ID",
        },
        includeChildren: {
          type: "boolean" as const,
          description: "Include child work items",
          default: false,
        },
        includeParent: {
          type: "boolean" as const,
          description: "Include parent work item",
          default: false,
        },
        includeRelated: {
          type: "boolean" as const,
          description: "Include related work items",
          default: false,
        },
      },
      required: ["projectId", "workItemId"],
    },
  },
  {
    name: "search_work_items",
    description:
      "Search work items in Azure DevOps using WIQL query. Filter by title, state, type, assignee, or tags",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string" as const,
          description: PROJECT_ID_DESCRIPTION,
        },
        query: {
          type: "string" as const,
          description: "Search query for title/description",
        },
        state: {
          type: "string" as const,
          description: "Work item state (e.g., Active, New, Closed)",
        },
        workItemType: {
          type: "string" as const,
          description: "Work item type (e.g., Task, User Story, Bug)",
        },
        assignedTo: {
          type: "string" as const,
          description: "Assigned user email or name",
        },
        tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Tags to filter by",
        },
        limit: {
          type: "number" as const,
          description: "Maximum number of results (max 200)",
          default: 50,
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_work_item",
    description:
      "Create a new work item in Azure DevOps with specified fields. Can set parent relationship and custom fields",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string" as const,
          description: PROJECT_ID_DESCRIPTION,
        },
        workItemType: {
          type: "string" as const,
          description: "Work item type (Task, User Story, Bug, Feature, Epic)",
        },
        title: {
          type: "string" as const,
          description: "Work item title",
        },
        description: {
          type: "string" as const,
          description: "Work item description",
        },
        assignedTo: {
          type: "string" as const,
          description: "Assigned user email",
        },
        state: {
          type: "string" as const,
          description: "Initial state (default: New)",
        },
        priority: {
          type: "number" as const,
          description: "Priority (1=highest, 4=lowest)",
        },
        tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Tags for the work item",
        },
        parentId: {
          type: "number" as const,
          description: "Parent work item ID",
        },
        additionalFields: {
          type: "object" as const,
          description: "Additional custom fields",
        },
      },
      required: ["projectId", "workItemType", "title"],
    },
  },
  {
    name: "update_work_item",
    description:
      "Update an existing work item in Azure DevOps. Can modify title, description, state, assignee, priority, tags, and custom fields",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string" as const,
          description: PROJECT_ID_DESCRIPTION,
        },
        workItemId: {
          type: "number" as const,
          description: "Work item ID to update",
        },
        title: {
          type: "string" as const,
          description: "New title",
        },
        description: {
          type: "string" as const,
          description: "New description",
        },
        assignedTo: {
          type: "string" as const,
          description: "New assigned user",
        },
        state: {
          type: "string" as const,
          description: "New state",
        },
        priority: {
          type: "number" as const,
          description: "New priority",
        },
        tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "New tags (replaces existing)",
        },
        additionalFields: {
          type: "object" as const,
          description: "Additional fields to update",
        },
      },
      required: ["projectId", "workItemId"],
    },
  },
  {
    name: "link_work_items",
    description:
      "Create a link between two work items. Supports parent-child, related, predecessor, and successor links",
    input_schema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string" as const,
          description: PROJECT_ID_DESCRIPTION,
        },
        sourceWorkItemId: {
          type: "number" as const,
          description: "Source work item ID",
        },
        targetWorkItemId: {
          type: "number" as const,
          description: "Target work item ID",
        },
        linkType: {
          type: "string" as const,
          enum: ["parent-child", "related", "predecessor", "successor"],
          description:
            "Link type: parent-child (source is parent), related, predecessor, successor",
        },
        comment: {
          type: "string" as const,
          description: "Comment for the link",
        },
      },
      required: ["projectId", "sourceWorkItemId", "targetWorkItemId", "linkType"],
    },
  },
];
