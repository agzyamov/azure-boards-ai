# Azure Boards AI — Implementation Plan

## Overview

This document describes HOW we will build Azure Boards AI, based on the [Specification](./SPECIFICATION.md) and patterns from [OpenClaw analysis](./OPENCLAW_REVERSE_SPEC.md).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Azure DevOps                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Work Item View                               │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    Extension (React)                         │   │   │
│  │  │  ┌─────────────────────────────────────────────────────┐    │   │   │
│  │  │  │              assistant-ui Chat Panel                 │    │   │   │
│  │  │  │                                                      │    │   │   │
│  │  │  │  - Message history                                   │    │   │   │
│  │  │  │  - Streaming responses                               │    │   │   │
│  │  │  │  - Tool execution display                            │    │   │   │
│  │  │  │  - Action confirmations                              │    │   │   │
│  │  │  │                                                      │    │   │   │
│  │  │  └──────────────────────┬───────────────────────────────┘    │   │   │
│  │  │                         │ WebSocket                          │   │   │
│  │  └─────────────────────────┼────────────────────────────────────┘   │   │
│  └─────────────────────────────┼────────────────────────────────────────┘   │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Server                                         │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │   Routes     │    │    Agent     │    │   Services   │                  │
│  │              │    │              │    │              │                  │
│  │  /api/chat   │───▶│  Claude SDK  │───▶│ AzureDevOps  │                  │
│  │  /api/session│    │  Tool Runner │    │              │                  │
│  │              │    │  Streaming   │    │              │                  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘                  │
│                             │                                               │
│                             ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                            Tools                                      │  │
│  │                                                                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │ specify │  │  plan   │  │ execute │  │  read   │  │ update  │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          Sessions                                     │  │
│  │                                                                       │  │
│  │  Session per Work Item:                                               │  │
│  │  - Transcript (message history)                                       │  │
│  │  - State (idle | specify | plan | execute)                            │  │
│  │  - Context (work item data, related items)                            │  │
│  │  - Pending plan (if in plan state)                                    │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phases

### Phase 1: Server Foundation

**Goal:** Basic server that can chat with Claude and manage sessions.

**Components:**

```
packages/server/src/
├── index.ts                 # Fastify server setup
├── routes/
│   ├── chat.ts              # WebSocket endpoint for streaming chat
│   └── sessions.ts          # REST endpoints for session CRUD
├── agent/
│   ├── agent.ts             # Claude integration with tool use
│   ├── prompt.ts            # System prompt for the agent
│   └── types.ts             # Agent types
├── sessions/
│   └── session-manager.ts   # In-memory session storage
└── services/
    └── claude.ts            # Claude SDK wrapper
```

**Tasks:**

1. **Server setup** (index.ts)
   - Fastify with WebSocket plugin
   - CORS configuration
   - Health check endpoint

2. **Session Manager** (sessions/)
   - Create/get/delete sessions
   - Store transcript and state
   - In-memory storage (Redis later)

3. **Claude Service** (services/claude.ts)
   - Anthropic SDK integration
   - Streaming response handling
   - Tool use support

4. **Agent** (agent/)
   - System prompt with personality
   - Message handling
   - Tool execution loop

5. **Chat Route** (routes/chat.ts)
   - WebSocket connection handling
   - Stream Claude responses to client
   - Handle tool calls

**Deliverable:** Server that accepts WebSocket connections and streams Claude responses.

---

### Phase 2: Azure DevOps Integration

**Goal:** Connect to Azure DevOps and read/write work items.

**Components:**

```
packages/server/src/
├── services/
│   └── azure-devops.ts      # Azure DevOps API client
└── tools/
    ├── index.ts             # Tool registry
    ├── schemas.ts           # All tool schemas
    ├── read-work-item.ts    # Read work item details
    ├── search-work-items.ts # Search by query
    ├── create-work-item.ts  # Create new work item
    ├── update-work-item.ts  # Update fields
    └── link-work-items.ts   # Create relationships
```

**Tasks:**

1. **Azure DevOps Service** (services/azure-devops.ts)
   - Authentication (PAT)
   - Work Item Tracking API client
   - Error handling and retries

2. **Read Tool** (tools/read-work-item.ts)
   - Get work item by ID
   - Get children, parent, linked items
   - Get comments and history

3. **Search Tool** (tools/search-work-items.ts)
   - WIQL query builder
   - Search by title, tags, state, assignee

4. **Create Tool** (tools/create-work-item.ts)
   - Create with specified fields
   - Set parent relationship
   - Copy fields from parent

5. **Update Tool** (tools/update-work-item.ts)
   - Update any field
   - Add/remove tags
   - Change state

6. **Link Tool** (tools/link-work-items.ts)
   - Create parent-child links
   - Create related links
   - Create predecessor/successor links

**Deliverable:** Server can read and write Azure DevOps work items via Claude tools.

---

### Phase 3: Flows (Specify, Plan, Execute)

**Goal:** Implement the three main workflows.

**Components:**

```
packages/server/src/
├── tools/
│   ├── specify.ts           # Specify flow tool
│   ├── plan.ts              # Plan flow tool
│   └── execute.ts           # Execute flow tool
└── agent/
    └── prompt.ts            # Updated prompt with flow instructions
```

**Tasks:**

1. **Specify Tool** (tools/specify.ts)
   - Analyze current work item
   - Generate clarifying questions
   - Output structured specification
   - Update session state to "specify"

2. **Plan Tool** (tools/plan.ts)
   - Analyze work item and specification
   - Generate subtask breakdown
   - Identify dependencies
   - Estimate effort (optional)
   - Store plan in session
   - Update session state to "plan"

3. **Execute Tool** (tools/execute.ts)
   - Read plan from session
   - Support dry-run mode
   - Create work items in batch
   - Set up relationships
   - Report results
   - Update session state to "idle"

4. **Agent Prompt Updates**
   - Instructions for each flow
   - When to use which tool
   - How to handle user confirmations

**Deliverable:** Server supports Specify → Plan → Execute workflow.

---

### Phase 4: Extension UI

**Goal:** Azure DevOps extension with chat panel.

**Components:**

```
packages/extension/
├── src/
│   ├── index.tsx            # Extension entry point
│   ├── App.tsx              # Main app component
│   ├── components/
│   │   ├── ChatPanel.tsx    # Main chat panel
│   │   ├── Message.tsx      # Message bubble
│   │   ├── ToolStatus.tsx   # Tool execution display
│   │   └── ActionButtons.tsx # Confirm/Cancel buttons
│   ├── hooks/
│   │   ├── useChat.ts       # WebSocket chat hook
│   │   ├── useSession.ts    # Session management hook
│   │   └── useWorkItem.ts   # Work item context hook
│   └── lib/
│       └── websocket.ts     # WebSocket client
├── vss-extension.json       # Extension manifest
└── overview.md              # Marketplace description
```

**Tasks:**

1. **Extension Manifest** (vss-extension.json)
   - Extension ID and publisher
   - Contribution points (work item form page)
   - Required scopes

2. **WebSocket Client** (lib/websocket.ts)
   - Connect to server
   - Handle reconnection
   - Stream message chunks

3. **Chat Hook** (hooks/useChat.ts)
   - Integrate with assistant-ui
   - Handle streaming responses
   - Manage message state

4. **Session Hook** (hooks/useSession.ts)
   - Create/restore session for work item
   - Track session state

5. **Work Item Hook** (hooks/useWorkItem.ts)
   - Get current work item context
   - Subscribe to work item changes

6. **Chat Panel** (components/ChatPanel.tsx)
   - assistant-ui Thread component
   - Custom message rendering
   - Tool status display
   - Action confirmation buttons

7. **Extension Registration**
   - Register with Azure DevOps SDK
   - Handle extension lifecycle

**Deliverable:** Working Azure DevOps extension with chat panel.

---

### Phase 5: Polish & Production

**Goal:** Production-ready quality.

**Tasks:**

1. **Error Handling**
   - Graceful error messages
   - Retry logic for transient failures
   - Connection loss recovery

2. **Logging & Observability**
   - Structured logging (pino)
   - Request tracing
   - Error tracking

3. **Security**
   - Validate all inputs
   - Sanitize outputs
   - Rate limiting

4. **Testing**
   - Unit tests for tools
   - Integration tests for flows
   - E2E tests for extension

5. **Documentation**
   - README with setup instructions
   - API documentation
   - Extension marketplace listing

6. **Deployment**
   - Docker container for server
   - Extension packaging (.vsix)
   - CI/CD for releases

**Deliverable:** Production-ready v1.0.

---

## Dependencies

```
Phase 1 (Server Foundation)
    │
    ▼
Phase 2 (Azure DevOps Integration)
    │
    ▼
Phase 3 (Flows) ◄─────────────────┐
    │                              │
    ▼                              │
Phase 4 (Extension UI) ───────────┘
    │               (can start in parallel after Phase 1)
    ▼
Phase 5 (Polish)
```

**Parallel work possible:**

- Phase 4 can start after Phase 1 (mock server responses)
- Phase 3 and Phase 4 can be developed in parallel

---

## Tech Stack

| Component        | Technology                 |
| ---------------- | -------------------------- |
| Server Runtime   | Node.js 22+                |
| Server Framework | Fastify                    |
| WebSocket        | @fastify/websocket         |
| AI               | Claude API (Anthropic SDK) |
| Azure DevOps     | azure-devops-node-api      |
| Extension UI     | React 18                   |
| Chat UI          | assistant-ui               |
| Build Tool       | Vite                       |
| Package Manager  | pnpm                       |
| Language         | TypeScript                 |

---

## File Structure (Final)

```
azure-boards-ai/
├── packages/
│   ├── extension/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ChatPanel.tsx
│   │   │   │   ├── Message.tsx
│   │   │   │   ├── ToolStatus.tsx
│   │   │   │   └── ActionButtons.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useChat.ts
│   │   │   │   ├── useSession.ts
│   │   │   │   └── useWorkItem.ts
│   │   │   ├── lib/
│   │   │   │   └── websocket.ts
│   │   │   ├── App.tsx
│   │   │   └── index.tsx
│   │   ├── index.html
│   │   ├── vss-extension.json
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── agent/
│   │   │   │   ├── agent.ts
│   │   │   │   ├── prompt.ts
│   │   │   │   └── types.ts
│   │   │   ├── routes/
│   │   │   │   ├── chat.ts
│   │   │   │   └── sessions.ts
│   │   │   ├── services/
│   │   │   │   ├── azure-devops.ts
│   │   │   │   └── claude.ts
│   │   │   ├── sessions/
│   │   │   │   └── session-manager.ts
│   │   │   ├── tools/
│   │   │   │   ├── index.ts
│   │   │   │   ├── schemas.ts
│   │   │   │   ├── specify.ts
│   │   │   │   ├── plan.ts
│   │   │   │   ├── execute.ts
│   │   │   │   ├── read-work-item.ts
│   │   │   │   ├── search-work-items.ts
│   │   │   │   ├── create-work-item.ts
│   │   │   │   ├── update-work-item.ts
│   │   │   │   └── link-work-items.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── work-item.ts
│       │   │   ├── session.ts
│       │   │   ├── messages.ts
│       │   │   └── tools.ts
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── SPECIFICATION.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── OPENCLAW_REVERSE_SPEC.md
│
├── .github/
│   ├── workflows/ci.yml
│   └── dependabot.yml
│
├── CLAUDE.md
├── CONTRIBUTING.md
├── package.json
└── pnpm-workspace.yaml
```

---

## MVP Scope

For MVP (Minimum Viable Product), we focus on:

**In Scope:**

- Chat with Claude about work item
- Read work item context
- Specify flow (clarify requirements)
- Plan flow (break down tasks)
- Execute flow (create subtasks)

**Out of Scope for MVP:**

- Search across all work items
- Update existing work items
- Link work items (beyond parent-child)
- Session persistence (in-memory only)
- Multi-user support

---

## Next Steps

1. Review and approve this plan
2. Start Phase 1: Server Foundation
3. Create feature branch: `feat/phase-1-server`
