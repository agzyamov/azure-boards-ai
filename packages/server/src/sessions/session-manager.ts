import { nanoid } from "nanoid";
import type { WorkItemSession, SessionCreateRequest } from "@azure-boards-ai/shared";
import type { AzureDevOpsService } from "../services/azure-devops.js";

export class SessionManager {
  private sessions: Map<string, WorkItemSession> = new Map();
  private workItemIndex: Map<string, string> = new Map();
  private azureDevOps?: AzureDevOpsService;

  constructor(azureDevOps?: AzureDevOpsService) {
    this.azureDevOps = azureDevOps;
  }

  async create(request: SessionCreateRequest): Promise<WorkItemSession> {
    const { workItemId, projectId, organizationUrl } = request;

    const key = `${organizationUrl}:${workItemId}`;
    const existingId = this.workItemIndex.get(key);

    if (existingId) {
      const existing = this.sessions.get(existingId);
      if (existing) {
        return existing;
      }
    }

    // Load work item context from Azure DevOps
    // Note: This will fail at runtime - need proper AuthService initialization
    // This is a temporary placeholder until SessionManager is refactored
    if (!this.azureDevOps) {
      throw new Error("AzureDevOpsService not configured in SessionManager");
    }
    const azureDevOps = this.azureDevOps;
    const [workItem, relatedItems, childItems] = await Promise.all([
      azureDevOps.getWorkItem(projectId, workItemId),
      azureDevOps.getRelatedWorkItems(projectId, workItemId),
      azureDevOps.getChildWorkItems(projectId, workItemId),
    ]);

    const session: WorkItemSession = {
      id: nanoid(),
      workItemId,
      projectId,
      organizationUrl,
      state: "idle",
      transcript: [],
      context: {
        workItem,
        relatedItems,
        childItems,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.workItemIndex.set(key, session.id);

    return session;
  }

  async get(id: string): Promise<WorkItemSession | undefined> {
    return this.sessions.get(id);
  }

  async getByWorkItem(
    workItemId: number,
    organizationUrl: string
  ): Promise<WorkItemSession | undefined> {
    const key = `${organizationUrl}:${workItemId}`;
    const sessionId = this.workItemIndex.get(key);
    if (!sessionId) {
      return undefined;
    }
    return this.sessions.get(sessionId);
  }

  async list(): Promise<WorkItemSession[]> {
    return Array.from(this.sessions.values());
  }

  async update(
    id: string,
    updates: Partial<WorkItemSession>
  ): Promise<WorkItemSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }

    const updated = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.sessions.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      const key = `${session.organizationUrl}:${session.workItemId}`;
      this.workItemIndex.delete(key);
      this.sessions.delete(id);
    }
  }
}
