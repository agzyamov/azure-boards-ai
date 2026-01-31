import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { sessionRoutes } from "./sessions.js";
import { SessionManager } from "../sessions/session-manager.js";
import type { WorkItem } from "@azure-boards-ai/shared";

const API_SESSIONS_PREFIX = "/api/sessions";
const TEST_ORG_URL = "https://dev.azure.com/test";
const TEST_PROJECT = "TestProject";

// Mock Azure DevOps Service
const mockAzureDevOps = {
  getWorkItem: vi.fn(),
  getRelatedWorkItems: vi.fn(),
  getChildWorkItems: vi.fn(),
  createWorkItem: vi.fn(),
  updateWorkItem: vi.fn(),
};

describe("sessionRoutes", () => {
  let app: ReturnType<typeof Fastify>;
  let sessionManager: SessionManager;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockWorkItem: WorkItem = {
      id: 123,
      fields: {
        "System.Title": "Test Work Item",
        "System.Description": "Test description",
        "System.State": "New",
        "System.WorkItemType": "User Story",
      },
    };

    mockAzureDevOps.getWorkItem.mockResolvedValue(mockWorkItem);
    mockAzureDevOps.getRelatedWorkItems.mockResolvedValue([]);
    mockAzureDevOps.getChildWorkItems.mockResolvedValue([]);

    sessionManager = new SessionManager(mockAzureDevOps as never);

    app = Fastify();
    await app.register(sessionRoutes, {
      prefix: API_SESSIONS_PREFIX,
      sessionManager,
    });
  });

  it("should create a session", async () => {
    const response = await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 123,
        projectId: TEST_PROJECT,
        organizationUrl: TEST_ORG_URL,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.workItemId).toBe(123);
    expect(body.state).toBe("idle");
  });

  it("should get session by id", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 123,
        projectId: TEST_PROJECT,
        organizationUrl: TEST_ORG_URL,
      },
    });

    const session = JSON.parse(createResponse.body);

    const getResponse = await app.inject({
      method: "GET",
      url: `${API_SESSIONS_PREFIX}/${session.id}`,
    });

    expect(getResponse.statusCode).toBe(200);
    const body = JSON.parse(getResponse.body);
    expect(body.id).toBe(session.id);
  });

  it("should return 404 for non-existent session", async () => {
    const response = await app.inject({
      method: "GET",
      url: `${API_SESSIONS_PREFIX}/non-existent`,
    });

    expect(response.statusCode).toBe(404);
  });

  it("should get session by work item ID", async () => {
    const mockWorkItem456: WorkItem = {
      id: 456,
      fields: {
        "System.Title": "Another Work Item",
        "System.State": "New",
      },
    };

    mockAzureDevOps.getWorkItem.mockResolvedValueOnce(mockWorkItem456);

    const createResponse = await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 456,
        projectId: TEST_PROJECT,
        organizationUrl: TEST_ORG_URL,
      },
    });

    const session = JSON.parse(createResponse.body);

    const getResponse = await app.inject({
      method: "GET",
      url: `${API_SESSIONS_PREFIX}/by-work-item`,
      query: {
        workItemId: "456",
        organizationUrl: TEST_ORG_URL,
      },
    });

    expect(getResponse.statusCode).toBe(200);
    const body = JSON.parse(getResponse.body);
    expect(body.id).toBe(session.id);
    expect(body.workItemId).toBe(456);
  });

  it("should return null for non-existent work item", async () => {
    const response = await app.inject({
      method: "GET",
      url: `${API_SESSIONS_PREFIX}/by-work-item`,
      query: {
        workItemId: "999",
        organizationUrl: "https://dev.azure.com/nonexistent",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("null");
  });

  it("should list all sessions", async () => {
    const mockWorkItem101: WorkItem = {
      id: 101,
      fields: { "System.Title": "Work Item 101" },
    };

    const mockWorkItem102: WorkItem = {
      id: 102,
      fields: { "System.Title": "Work Item 102" },
    };

    mockAzureDevOps.getWorkItem
      .mockResolvedValueOnce(mockWorkItem101)
      .mockResolvedValueOnce(mockWorkItem102);

    await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 101,
        projectId: "Project1",
        organizationUrl: TEST_ORG_URL,
      },
    });

    await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 102,
        projectId: "Project2",
        organizationUrl: TEST_ORG_URL,
      },
    });

    const response = await app.inject({
      method: "GET",
      url: API_SESSIONS_PREFIX,
    });

    expect(response.statusCode).toBe(200);
    const sessions = JSON.parse(response.body);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it("should delete a session", async () => {
    const mockWorkItem789: WorkItem = {
      id: 789,
      fields: { "System.Title": "Work Item to Delete" },
    };

    mockAzureDevOps.getWorkItem.mockResolvedValueOnce(mockWorkItem789);

    const createResponse = await app.inject({
      method: "POST",
      url: API_SESSIONS_PREFIX,
      payload: {
        workItemId: 789,
        projectId: TEST_PROJECT,
        organizationUrl: TEST_ORG_URL,
      },
    });

    const session = JSON.parse(createResponse.body);

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `${API_SESSIONS_PREFIX}/${session.id}`,
    });

    expect(deleteResponse.statusCode).toBe(200);
    const body = JSON.parse(deleteResponse.body);
    expect(body.success).toBe(true);

    // Verify session is deleted
    const getResponse = await app.inject({
      method: "GET",
      url: `${API_SESSIONS_PREFIX}/${session.id}`,
    });

    expect(getResponse.statusCode).toBe(404);
  });
});
