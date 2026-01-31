import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager } from "./session-manager.js";

const TEST_ORG_URL = "https://dev.azure.com/test";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe("create", () => {
    it("should create a new session for work item", async () => {
      const session = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      expect(session.id).toBeDefined();
      expect(session.workItemId).toBe(123);
      expect(session.projectId).toBe("TestProject");
      expect(session.organizationUrl).toBe(TEST_ORG_URL);
      expect(session.state).toBe("idle");
      expect(session.transcript).toEqual([]);
    });

    it("should return existing session for same work item", async () => {
      const session1 = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      const session2 = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      expect(session1.id).toBe(session2.id);
    });
  });

  describe("get", () => {
    it("should return session by id", async () => {
      const created = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      const found = await manager.get(created.id);

      expect(found).toEqual(created);
    });

    it("should return undefined for non-existent session", async () => {
      const found = await manager.get("non-existent");

      expect(found).toBeUndefined();
    });
  });

  describe("getByWorkItem", () => {
    it("should return session by work item id", async () => {
      const created = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      const found = await manager.getByWorkItem(123, TEST_ORG_URL);

      expect(found).toEqual(created);
    });

    it("should return undefined for non-existent work item", async () => {
      const found = await manager.getByWorkItem(999, TEST_ORG_URL);

      expect(found).toBeUndefined();
    });
  });

  describe("update", () => {
    it("should update session state", async () => {
      const session = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      const updated = await manager.update(session.id, {
        state: "specify",
      });

      expect(updated?.state).toBe("specify");
      expect(updated?.id).toBe(session.id);
    });

    it("should return undefined for non-existent session", async () => {
      const updated = await manager.update("non-existent", {
        state: "specify",
      });

      expect(updated).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete session", async () => {
      const session = await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      await manager.delete(session.id);

      const found = await manager.get(session.id);
      expect(found).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should return all sessions", async () => {
      await manager.create({
        workItemId: 123,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      await manager.create({
        workItemId: 456,
        projectId: "TestProject",
        organizationUrl: TEST_ORG_URL,
      });

      const sessions = await manager.list();

      expect(sessions).toHaveLength(2);
    });
  });
});
