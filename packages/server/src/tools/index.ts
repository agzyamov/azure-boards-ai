import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { Logger } from "pino";
import { readWorkItem } from "./read-work-item.js";
import { searchWorkItems } from "./search-work-items.js";
import { createWorkItem } from "./create-work-item.js";
import { updateWorkItem } from "./update-work-item.js";
import { linkWorkItems } from "./link-work-items.js";
import { toolDefinitions } from "./schemas.js";

export type ToolName =
  | "read_work_item"
  | "search_work_items"
  | "create_work_item"
  | "update_work_item"
  | "link_work_items";

export interface ToolExecutionContext {
  azureDevOps: AzureDevOpsService;
  logger?: Logger;
}

/**
 * Tool registry
 * Maps tool names to their implementations
 */
export class ToolRegistry {
  private context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
  }

  /**
   * Execute a tool by name
   */
  async execute(toolName: ToolName, input: unknown): Promise<unknown> {
    const { azureDevOps, logger } = this.context;

    logger?.info({ toolName }, "Executing tool");

    switch (toolName) {
      case "read_work_item":
        return readWorkItem(input, azureDevOps, logger);

      case "search_work_items":
        return searchWorkItems(input, azureDevOps, logger);

      case "create_work_item":
        return createWorkItem(input, azureDevOps, logger);

      case "update_work_item":
        return updateWorkItem(input, azureDevOps, logger);

      case "link_work_items":
        return linkWorkItems(input, azureDevOps, logger);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get tool definitions for Claude API
   */
  getToolDefinitions() {
    return toolDefinitions;
  }

  /**
   * Check if a tool exists
   */
  hasTool(toolName: string): toolName is ToolName {
    return [
      "read_work_item",
      "search_work_items",
      "create_work_item",
      "update_work_item",
      "link_work_items",
    ].includes(toolName);
  }
}

// Export all tool implementations
export {
  readWorkItem,
  searchWorkItems,
  createWorkItem,
  updateWorkItem,
  linkWorkItems,
  toolDefinitions,
};

// Export schemas
export * from "./schemas.js";
