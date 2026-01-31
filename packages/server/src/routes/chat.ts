import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { Agent } from "../agent/agent.js";
import { SessionManager } from "../sessions/session-manager.js";
import type { ChatRequest, StreamChunk } from "@azure-boards-ai/shared";

const sessionManager = new SessionManager();

export async function chatRoutes(app: FastifyInstance) {
  // WebSocket endpoint for streaming chat
  app.get("/ws", { websocket: true }, (socket: WebSocket) => {
    console.log("Client connected");

    socket.on("message", async (data: Buffer) => {
      try {
        const request: ChatRequest = JSON.parse(data.toString());
        const session = await sessionManager.get(request.sessionId);

        if (!session) {
          const errorChunk: StreamChunk = {
            type: "error",
            error: "Session not found",
          };
          socket.send(JSON.stringify(errorChunk));
          return;
        }

        const agent = new Agent(session);

        // Stream response
        for await (const chunk of agent.chat(request.message)) {
          socket.send(JSON.stringify(chunk));
        }
      } catch (error) {
        const errorChunk: StreamChunk = {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
        socket.send(JSON.stringify(errorChunk));
      }
    });

    socket.on("close", () => {
      console.log("Client disconnected");
    });
  });

  // REST endpoint for non-streaming chat (fallback)
  app.post<{ Body: ChatRequest }>("/", async (request, reply) => {
    const { sessionId, message } = request.body;
    const session = await sessionManager.get(sessionId);

    if (!session) {
      return reply.status(404).send({ error: "Session not found" });
    }

    const agent = new Agent(session);
    const chunks: StreamChunk[] = [];

    for await (const chunk of agent.chat(message)) {
      chunks.push(chunk);
    }

    return { sessionId, chunks };
  });
}
