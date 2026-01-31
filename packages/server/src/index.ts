import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { chatRoutes } from "./routes/chat.js";
import { sessionRoutes } from "./routes/sessions.js";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(websocket);

  // Routes
  await app.register(chatRoutes, { prefix: "/api/chat" });
  await app.register(sessionRoutes, { prefix: "/api/sessions" });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
