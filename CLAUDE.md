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

## Rules (Always Follow)

See `.claude/rules/` for detailed guidelines:

- **coding-style.md** — Immutability, file organization, error handling
- **testing.md** — 80% coverage, TDD workflow
- **security.md** — No hardcoded secrets, input validation
- **git-workflow.md** — Commit format, PR process

### Quick Rules

| Rule                 | Requirement |
| -------------------- | ----------- |
| Functions            | < 50 lines  |
| Files                | < 800 lines |
| Nesting              | < 4 levels  |
| Coverage             | ≥ 80%       |
| Cognitive Complexity | ≤ 15        |

## Agents (Specialized Help)

Use these agents for specific tasks:

- `/plan` — Plan implementation before coding
- `/review` — Code review for quality
- `/security` — Security audit

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

```typescript
// 1. External packages
import Fastify from "fastify";
import Anthropic from "@anthropic-ai/sdk";

// 2. Internal packages
import type { WorkItem } from "@azure-boards-ai/shared";

// 3. Relative imports
import { SessionManager } from "./sessions/session-manager.js";
```

### Error Handling

```typescript
// Always use typed errors with context
try {
  await azureDevOps.createWorkItem(item);
} catch (error) {
  logger.error({ error, item }, "Failed to create work item");
  throw new WorkItemError("Failed to create work item", { cause: error });
}
```

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

## Development Workflow

### Before Coding

1. Read the requirements
2. Use `/plan` to create implementation plan
3. Get approval before starting

### While Coding

1. Write tests first (TDD)
2. Keep functions small (< 50 lines)
3. Handle all errors
4. No hardcoded secrets

### Before Committing

1. Run `pnpm lint` — fix all errors
2. Run `pnpm format` — format code
3. Use `/review` to check quality
4. Use `/security` for security-sensitive code
5. Write clear commit message

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev:server       # Run server in dev mode
pnpm dev:extension    # Run extension in dev mode
pnpm build            # Build all packages
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
```

## Environment Variables

```
ANTHROPIC_API_KEY=    # Claude API key
AZURE_DEVOPS_PAT=     # Azure DevOps Personal Access Token
AZURE_DEVOPS_ORG=     # Azure DevOps organization URL
```
