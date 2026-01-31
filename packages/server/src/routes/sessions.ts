import type { FastifyInstance } from "fastify";
import { SessionManager } from "../sessions/session-manager.js";
import type { SessionCreateRequest } from "@azure-boards-ai/shared";

const sessionManager = new SessionManager();

export async function sessionRoutes(app: FastifyInstance) {
  // Create new session
  app.post<{ Body: SessionCreateRequest }>("/", async (request) => {
    const session = await sessionManager.create(request.body);
    return session;
  });

  // Get session by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const session = await sessionManager.get(request.params.id);
    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }
    return session;
  });

  // Get session by work item ID
  app.get<{ Querystring: { workItemId: string; organizationUrl: string } }>(
    "/by-work-item",
    async (request) => {
      const { workItemId, organizationUrl } = request.query;
      const session = await sessionManager.getByWorkItem(parseInt(workItemId), organizationUrl);
      return session || null;
    }
  );

  // List sessions
  app.get("/", async () => {
    return sessionManager.list();
  });

  // Delete session
  app.delete<{ Params: { id: string } }>("/:id", async (request) => {
    await sessionManager.delete(request.params.id);
    return { success: true };
  });
}
