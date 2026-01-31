# Azure Boards AI — Specification

## Overview

Azure Boards AI is an AI assistant integrated into Azure DevOps that helps users manage work items through natural language conversation. Users interact with the AI via a chat panel embedded in the Azure DevOps work item view.

The system follows patterns established by OpenClaw — a proven open-source AI assistant platform — adapted for the Azure DevOps enterprise context.

## Goals

1. Enable natural language interaction with Azure Boards work items
2. Automate routine work item management tasks
3. Provide Claude Code-like experience within Azure DevOps native UI
4. Support iterative workflows: Specify → Plan → Execute
5. Respect Azure DevOps permissions and enterprise security model

## User Stories

### Core Interaction

- **US-1**: As a user, I want to open a chat panel on any work item and ask questions or give instructions in natural language, so that I can get help without leaving Azure DevOps
- **US-2**: As a user, I want AI responses to stream in real-time, so that I see progress immediately without waiting
- **US-3**: As a user, I want chat history preserved per work item, so that I can continue conversations later

### Requirements Clarification (Specify)

- **US-4**: As a product owner, I want to ask AI to help me refine requirements, so that acceptance criteria are clear and complete
- **US-5**: As a user, I want AI to ask clarifying questions about edge cases, so that requirements cover all scenarios
- **US-6**: As a user, I want AI to suggest improvements to description, so that work items are well-defined

### Task Breakdown (Plan)

- **US-7**: As a team lead, I want to ask AI to break down a large work item into subtasks, so that work can be distributed among team members
- **US-8**: As a user, I want AI to identify dependencies between subtasks, so that work is sequenced correctly
- **US-9**: As a user, I want AI to estimate effort for subtasks, so that I can plan capacity

### Execution (Execute)

- **US-10**: As a user, I want AI to create planned subtasks as actual work items, so that I don't have to create them manually
- **US-11**: As a user, I want AI to set up parent-child relationships automatically, so that hierarchy is correct
- **US-12**: As a user, I want to preview what will be created before confirming, so that I can verify the plan

### Work Item Operations

- **US-13**: As a user, I want to ask AI to find related work items, so that I understand context and dependencies
- **US-14**: As a user, I want to ask AI to update work item fields, so that I can make changes through conversation
- **US-15**: As a developer, I want AI to understand work item context (parent, children, links), so that suggestions are relevant

### Session Management

- **US-16**: As a user, I want each work item to have its own conversation, so that discussions don't mix
- **US-17**: As a user, I want to see what flow stage I'm in (specify/plan/execute), so that I know where I am in the process

## Functional Requirements

### FR-1: Chat Panel

- Chat panel appears as a side panel within Azure DevOps work item view
- Panel can be opened/closed by user
- Supports markdown rendering in messages
- Shows streaming indicator during AI response
- Displays tool execution status (what AI is doing)

### FR-2: Real-Time Streaming

- AI responses stream token-by-token via WebSocket
- Tool calls and results shown as they happen
- Connection resilience with automatic reconnection

### FR-3: Natural Language Understanding

- AI understands user intent from natural language (no slash commands required)
- Supports English and Russian languages
- AI asks clarifying questions when intent is unclear
- AI determines which flow to activate based on request

### FR-4: Work Item Context

- AI has access to current work item details (title, description, acceptance criteria, state, tags, etc.)
- AI can see work item hierarchy (parent, children)
- AI can see linked work items (related, predecessor/successor)
- AI can see work item history and comments
- Context refreshes when work item changes

### FR-5: Specify Flow

- AI asks targeted questions to clarify requirements
- AI identifies missing information: acceptance criteria, edge cases, dependencies
- AI suggests improvements to description
- AI outputs structured specification
- User can approve, modify, or reject suggestions
- Flow completes when user confirms specification

### FR-6: Plan Flow

- AI analyzes work item and proposes breakdown into subtasks
- Each subtask includes: title, description, type, tags
- AI identifies dependencies between subtasks
- AI can estimate effort (optional, based on user preference)
- AI shows plan summary for review
- User can modify plan before execution
- Flow completes when user approves plan

### FR-7: Execute Flow

- AI creates work items based on approved plan
- AI sets up parent-child relationships
- AI copies relevant fields from parent (area path, iteration, tags)
- AI creates links between dependent items
- Supports dry-run mode (preview without creating)
- AI reports results with links to created items
- Flow completes when all items created successfully

### FR-8: Work Item Operations

- **Read**: Get work item by ID, get children, get parent, get linked items
- **Search**: Find work items by query (title, tags, state, assignee)
- **Update**: Modify fields (state, tags, assignment, description, etc.)
- **Create**: Create new work item with specified fields
- **Link**: Create relationships between work items

### FR-9: Session Management

- Each work item has its own chat session
- Session stores conversation transcript
- Session tracks current flow state: idle | specify | plan | execute
- Session preserves pending plan (if in plan flow)
- Sessions persist across browser refreshes
- Session can be cleared/reset by user

### FR-10: Permission Passthrough

- All operations execute with user's Azure DevOps permissions
- AI cannot perform actions user is not authorized to do
- Permission errors shown clearly to user
- No elevation of privileges

## Non-Functional Requirements

### NFR-1: Performance

- Chat response should start streaming within 2 seconds
- Work item read operations complete within 1 second
- Work item write operations complete within 3 seconds
- Concurrent sessions supported without degradation

### NFR-2: Security

- Uses Azure DevOps authentication (user's PAT or OAuth)
- No sensitive data stored outside Azure DevOps and session storage
- API keys stored securely on server, never exposed to client
- HTTPS/WSS for all communication

### NFR-3: Reliability

- Graceful handling of API errors (Azure DevOps, Claude)
- Clear error messages with actionable guidance
- No data loss on connection interruption
- Automatic retry for transient failures

### NFR-4: Usability

- Intuitive chat interface (similar to ChatGPT/Claude)
- Clear indication of AI actions and their results
- Confirmation required before destructive/bulk operations
- Easy to cancel in-progress operations
- Mobile-friendly panel layout

### NFR-5: Observability

- Logging of all operations for troubleshooting
- Error tracking with context
- Usage metrics (optional)

## User Interface

### Chat Panel Layout

```
┌─────────────────────────────────────┐
│ Azure Boards AI        [State] [×] │
├─────────────────────────────────────┤
│                                     │
│  ┌─ User ───────────────────────┐  │
│  │ Break this down into tasks   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌─ Assistant ──────────────────┐  │
│  │ I'll analyze this user story │  │
│  │ and create a breakdown.      │  │
│  │                              │  │
│  │ ┌─ Tool: plan ─────────────┐ │  │
│  │ │ Created 4 subtasks       │ │  │
│  │ └──────────────────────────┘ │  │
│  │                              │  │
│  │ Here's the plan:            │  │
│  │ 1. Setup database schema    │  │
│  │ 2. Create API endpoints     │  │
│  │ 3. Build UI components      │  │
│  │ 4. Write tests              │  │
│  │                              │  │
│  │ [Create Items] [Modify]     │  │
│  └──────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│ Type a message...          [Send]  │
└─────────────────────────────────────┘
```

### Flow State Indicator

- Shows current state: `Idle` | `Specifying...` | `Planning...` | `Executing...`
- Allows user to understand where they are in the process

### Action Confirmations

Before executing actions (creating/updating work items), AI shows:

- Summary of what will be done
- List of items to be created/modified with details
- [Confirm] / [Modify] / [Cancel] options

### Error Display

- Inline error messages with clear explanation
- Suggestions for resolution when possible
- Option to retry failed operations

## Integration Points

### Azure DevOps

- Azure DevOps Extension SDK (azure-devops-extension-sdk)
- Work Item Tracking REST API
- User authentication via Azure DevOps OAuth or PAT

### AI Provider

- Claude API (Anthropic)
- Streaming responses via SSE
- Tool use (function calling) for operations

### Communication

- WebSocket for real-time streaming between Extension and Server
- REST API for session management

## Constraints

- Requires Azure DevOps Services (cloud) or Azure DevOps Server 2020+
- Requires user to have appropriate permissions for work item operations
- Extension must be installed by Azure DevOps organization admin
- Server requires network access to Claude API
- Single organization per server deployment (v1)

## Out of Scope (v1)

- Code generation or review
- Pull request integration
- Pipeline integration
- Bulk operations across multiple work items (not tied to single parent)
- Custom AI model fine-tuning
- Offline mode
- Multi-organization support
- Comment-based interaction (only chat panel)
- Custom fields configuration UI
