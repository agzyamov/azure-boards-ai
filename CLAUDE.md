# Azure Boards AI

AI assistant for Azure Boards with Claude Code-like interaction via comments and chat panel.

## Architecture

```
┌─ Azure DevOps Extension ─┐     ┌─ Backend Server ─────────────────────┐
│  assistant-ui (React)    │────▶│  Agent (Claude + Tools)              │
│  WebSocket streaming     │◀────│  Azure DevOps API                    │
└──────────────────────────┘     └──────────────────────────────────────┘
```

## Project Structure

- `packages/extension/` — Azure DevOps Extension (React + assistant-ui)
- `packages/server/` — Backend (Fastify + Claude SDK)
- `packages/shared/` — Shared TypeScript types

## Conventions

### TypeScript

- Strict mode enabled
- ES2022 target
- ESM modules (`"type": "module"`)
- Use `type` for type imports: `import type { X } from "..."`

### Naming

- Files: `kebab-case.ts`
- Types/Interfaces: `PascalCase`
- Functions/Variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`

### Imports

- External packages first
- Then internal packages (`@azure-boards-ai/*`)
- Then relative imports
- Separate groups with empty line

### Error Handling

- Use typed errors
- Always log errors with context
- Return clear messages to user

## Tools (for Claude Agent)

Agent uses tool use to perform actions:

| Tool               | Description                    |
| ------------------ | ------------------------------ |
| `specify`          | Clarify work item requirements |
| `plan`             | Break down into subtasks       |
| `execute`          | Create/update work items       |
| `search`           | Find related work items        |
| `read_work_item`   | Read work item details         |
| `update_work_item` | Update work item fields        |

## Azure DevOps API

- Use `azure-devops-node-api` SDK
- PAT token for authorization
- Work Item Tracking API for CRUD operations

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev:server       # Run server in dev mode
pnpm dev:extension    # Run extension in dev mode
pnpm build            # Build all packages
```

## Environment Variables

```
ANTHROPIC_API_KEY=    # Claude API key
AZURE_DEVOPS_PAT=     # Azure DevOps Personal Access Token
AZURE_DEVOPS_ORG=     # Azure DevOps organization URL
```
