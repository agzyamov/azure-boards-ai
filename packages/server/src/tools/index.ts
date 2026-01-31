import type { AzureDevOpsService } from "../services/azure-devops.js";
import type { SessionManager } from "../sessions/session-manager.js";
import type { Logger } from "pino";
import { readWorkItem } from "./read-work-item.js";
import { searchWorkItems } from "./search-work-items.js";
import { createWorkItem } from "./create-work-item.js";
import { updateWorkItem } from "./update-work-item.js";
import { linkWorkItems } from "./link-work-items.js";
import { specify, specifyToolDefinition } from "./specify.js";
import { plan, planToolDefinition } from "./plan.js";
import { execute, executeToolDefinition } from "./execute.js";
import { toolDefinitions } from "./schemas.js";

export type ToolName =
  | "read_work_item"
  | "search_work_items"
  | "create_work_item"
  | "update_work_item"
  | "link_work_items"
  | "specify"
  | "plan"
  | "execute";

export interface ToolExecutionContext {
  azureDevOps: AzureDevOpsService;
  sessionManager: SessionManager;
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
    const { azureDevOps, sessionManager, logger } = this.context;

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

      case "specify":
        return specify(input, azureDevOps, sessionManager, logger);

      case "plan":
        return plan(input, azureDevOps, sessionManager, logger);

      case "execute":
        return execute(input, azureDevOps, sessionManager, logger);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get tool definitions for Claude API
   */
  getToolDefinitions() {
    return [...toolDefinitions, specifyToolDefinition, planToolDefinition, executeToolDefinition];
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
      "specify",
      "plan",
      "execute",
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
  specify,
  plan,
  execute,
  toolDefinitions,
  specifyToolDefinition,
  planToolDefinition,
  executeToolDefinition,
};

// Export schemas
export * from "./schemas.js";
export type { SpecifyInput, SpecificationResult } from "./specify.js";
export type { PlanInput, ExecutionPlan, SubTask } from "./plan.js";
export type { ExecuteInput, ExecutionResult, CreatedTask, FailedTask } from "./execute.js";
