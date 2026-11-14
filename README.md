# Azure Boards AI

An AI assistant for Azure Boards. The design has two parts: a chat panel that runs as an Azure DevOps extension inside the work item view, and a backend server that runs a Claude agent with tools for reading and changing work items. This repository is a work in progress. Today it contains the server foundation (HTTP and WebSocket API, in-memory sessions, a streaming Claude wrapper) and an empty extension package. It does not talk to Azure DevOps yet.

## The idea

Open a work item in Azure DevOps, open a chat panel next to it, and talk to an agent about that item in plain language. The agent knows the work item context and supports three flows:

- **Specify**: ask clarifying questions and tighten the description and acceptance criteria.
- **Plan**: propose a breakdown into subtasks.
- **Execute**: create the approved subtasks as real work items, after confirmation.

Each work item gets its own conversation. The full description is in [docs/SPECIFICATION.md](docs/SPECIFICATION.md).

## Architecture

Target design, from the specification:

```
Azure DevOps work item view            Backend server
+---------------------------+          +--------------------------------+
| Extension (React,         |  WS/REST | Fastify routes                 |
| assistant-ui chat panel)  | <------> | Agent (Claude + tools)         |
+---------------------------+          | Sessions (one per work item)   |
                                       | Azure DevOps API client        |
                                       +--------------------------------+
```

What exists in the code on `main`:

| Component       | Path                                              | What it does                                                                                                                                         |
| --------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server entry    | `packages/server/src/index.ts`                    | Fastify app with CORS and WebSocket plugins. Registers the routes below and `GET /health`.                                                           |
| Session routes  | `packages/server/src/routes/sessions.ts`          | REST under `/api/sessions`: create, get by id, get by work item, list, delete.                                                                       |
| Chat routes     | `packages/server/src/routes/chat.ts`              | `GET /api/chat/ws` (WebSocket, streams chunks) and `POST /api/chat` (returns all chunks at once). Both take `{ sessionId, message }`.                |
| Session manager | `packages/server/src/sessions/session-manager.ts` | In-memory `Map` of sessions, indexed by organization URL and work item id. One session per work item. Lost on restart.                               |
| Agent           | `packages/server/src/agent/`                      | Appends the user message to the session transcript, builds a system prompt from the session's work item fields, and relays the Claude stream.        |
| Claude service  | `packages/server/src/services/claude.ts`          | Wrapper over `@anthropic-ai/sdk` streaming. Emits `text`, `tool_use` and `done` chunks. Reads `ANTHROPIC_API_KEY`. The model id is set in this file. |
| Shared types    | `packages/shared/src/types.ts`                    | `Message`, `WorkItemSession`, `WorkItem`, `ChatRequest`, `StreamChunk`, session request types.                                                       |
| Extension       | `packages/extension/`                             | Vite and React scaffold. `src/index.tsx` is an empty module.                                                                                         |

Messages on the wire are `StreamChunk` objects serialized as JSON: `text`, `tool_call`, `done` or `error`.

## Status

### Works

- The server starts and answers `GET /health`.
- Session CRUD over REST (`/api/sessions`).
- Unit tests for the session manager, session routes, agent and Claude service (Vitest, Claude SDK mocked).
- `pnpm build` and `pnpm lint` pass. CI runs ESLint, Prettier check, Gitleaks, Trivy and the build.

### Does not work yet

- **Chat end to end.** `routes/chat.ts` and `routes/sessions.ts` each create their own `SessionManager`. A session created through `/api/sessions` is not visible to the chat routes, so `POST /api/chat` and the WebSocket endpoint answer `Session not found`. The agent and Claude service are exercised by tests only.
- **Work item context.** New sessions are created with an empty `workItem` object. Nothing loads work item data.
- **Azure DevOps access.** `azure-devops-node-api` is a dependency but no code uses it. `AZURE_DEVOPS_ORG_URL` and `AZURE_DEVOPS_PAT` from `.env.example` are not read anywhere.
- **Tools.** The system prompt lists tools such as `read_work_item` and `create_work_item`. None are implemented and none are passed to the Claude API. `packages/server/src/tools/` is empty.
- **Extension.** No UI, no `vss-extension.json` manifest, no use of the Azure DevOps extension SDK. The `package` script in `packages/extension/package.json` expects a manifest that does not exist.
- **Session persistence.** In memory only.
- **Authentication.** The server has none, and CORS accepts any origin. Do not expose it to a network you do not control.

### Planned

[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) splits the work into five phases:

1. Server foundation. Merged to `main`.
2. Azure DevOps integration: API client and work item tools (read, search, create, update, link).
3. Specify, Plan and Execute flow tools.
4. Extension UI: chat panel, hooks, WebSocket client, manifest.
5. Error handling, logging, security hardening, tests, packaging.

The branch `feat/phase-2-azure-devops-integration` holds unmerged work on phases 2 and 3. It is not part of `main` and is not described here.

## Prerequisites

- Node.js 20 or newer (CI uses 22)
- pnpm 9 or newer
- An Anthropic API key, needed only once chat is wired up. Health check, session routes and tests run without it.

## Running it

Install dependencies:

```bash
pnpm install
```

Start the server in watch mode:

```bash
pnpm dev:server
```

It listens on `http://0.0.0.0:3001` by default. The server does not load `.env` files, so set variables in the shell:

```bash
export ANTHROPIC_API_KEY=...   # your key
export PORT=3001               # optional
export HOST=127.0.0.1          # optional
pnpm dev:server
```

| Variable               | Used by code | Purpose                                       |
| ---------------------- | ------------ | --------------------------------------------- |
| `ANTHROPIC_API_KEY`    | yes          | Claude API key. Required by `ClaudeService`.  |
| `PORT`                 | yes          | Server port. Default `3001`.                  |
| `HOST`                 | yes          | Bind address. Default `0.0.0.0`.              |
| `AZURE_DEVOPS_ORG_URL` | no           | Listed in `.env.example` for the planned API. |
| `AZURE_DEVOPS_PAT`     | no           | Listed in `.env.example` for the planned API. |

Try it:

```bash
curl http://localhost:3001/health

curl -X POST http://localhost:3001/api/sessions \
  -H 'content-type: application/json' \
  -d '{"workItemId": 1, "projectId": "my-project", "organizationUrl": "https://dev.azure.com/your-org"}'

curl http://localhost:3001/api/sessions
```

Other commands:

```bash
pnpm --filter @azure-boards-ai/server test            # unit tests
pnpm --filter @azure-boards-ai/server test:coverage   # with coverage thresholds
pnpm build                                            # build all packages
pnpm lint                                             # ESLint
pnpm format:check                                     # Prettier
pnpm dev:extension                                    # Vite dev server; serves an empty page
```

## Repository layout

```
packages/
  server/      Fastify backend: routes, agent, sessions, Claude service, tests
  extension/   Azure DevOps extension scaffold (empty entry point)
  shared/      TypeScript types shared by server and extension
docs/
  SPECIFICATION.md          What the product should do
  IMPLEMENTATION_PLAN.md    Phases and target file structure
  OPENCLAW_REVERSE_SPEC.md  Notes on OpenClaw, used as a reference for patterns
.github/       CI workflow and Dependabot config
.claude/       Claude Code rules, agents, commands and skills for this repo
CLAUDE.md      Project conventions for Claude Code
CONTRIBUTING.md  Branching, commit format, PR requirements
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits follow Conventional Commits and changes go through pull requests.

## Author

Rustem Agziamov, [LinkedIn](https://www.linkedin.com/in/agziamov)
