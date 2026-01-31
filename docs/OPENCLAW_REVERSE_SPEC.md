# OpenClaw — Reverse-Engineered Specification

## Overview

OpenClaw is a self-hosted personal AI assistant that connects multiple messaging platforms to AI agents, enabling natural language interaction through channels users already use daily.

## Goals

1. Provide unified AI assistant access across all messaging platforms
2. Keep data and control local (self-hosted, privacy-first)
3. Enable voice and visual interaction beyond text
4. Support automation and scheduled tasks
5. Allow multi-agent workspaces for different contexts

## User Stories

### Communication
- **US-C1**: As a user, I want to message my AI assistant from WhatsApp/Telegram/Discord, so I don't need a separate app
- **US-C2**: As a user, I want to talk to AI by voice on my phone/laptop, so I can interact hands-free
- **US-C3**: As a user, I want AI to respond in the same channel I messaged from, so conversation stays in one place

### Agent Capabilities
- **US-A1**: As a user, I want AI to browse the web and fetch information, so I get answers without leaving the chat
- **US-A2**: As a user, I want AI to search the internet, so I get up-to-date information
- **US-A3**: As a user, I want AI to remember things about me across conversations, so I don't repeat myself
- **US-A4**: As a user, I want AI to analyze images I send, so I can ask questions about photos

### Automation
- **US-AU1**: As a user, I want to schedule AI tasks on a cron, so things happen automatically
- **US-AU2**: As a user, I want AI to react to webhooks, so it integrates with external services
- **US-AU3**: As a user, I want AI to post to Slack/Discord channels, so it can notify my team

### Multi-Agent
- **US-M1**: As a user, I want different channels routed to different agents, so work and personal contexts are separate
- **US-M2**: As a user, I want agents to have isolated workspaces, so they don't mix data
- **US-M3**: As a user, I want to spawn sub-agents for specific tasks, so complex work can be parallelized

### Security
- **US-S1**: As a user, I want group chats to run in sandbox, so untrusted users can't compromise my system
- **US-S2**: As a user, I want DM pairing codes, so only I can access my main agent
- **US-S3**: As a user, I want all data stored locally, so nothing goes to third-party servers

## Functional Requirements

### FR-1: Multi-Channel Gateway
- Central WebSocket hub that connects all messaging channels
- Supports: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix
- Bidirectional: receives messages and sends responses
- Channel-agnostic message format internally

### FR-2: Agent Runtime
- Connects to LLM providers (Claude, GPT, etc.)
- Supports streaming responses
- Tool use (function calling) for actions
- RPC mode for structured agent communication

### FR-3: Tool System
- Web browsing (dedicated browser instance)
- Web search
- Web fetch (URL content retrieval)
- Image analysis
- Text-to-speech
- Memory (persistent user context)
- Cron scheduling
- Webhook handling
- Channel-specific actions (post to Slack, Discord, etc.)

### FR-4: Session Management
- Per-conversation session with transcript history
- Session state persistence
- Session compaction (summarize long history)
- Isolated sessions for groups vs DMs

### FR-5: Multi-Agent Routing
- Route different channels/accounts to different agents
- Each agent has own workspace and configuration
- Spawn sub-agents for parallel tasks
- Send messages between sessions

### FR-6: Voice Interaction
- Voice wake word detection
- Continuous speech recognition
- Text-to-speech responses
- Works on macOS, iOS, Android

### FR-7: Visual Workspace (Canvas)
- Agent-driven UI (A2UI)
- Visual task management
- Screen control capabilities
- Served via HTTP to device WebViews

### FR-8: Device Nodes
- Companion apps for macOS, iOS, Android
- Expose device capabilities: camera, screen recording, location, notifications
- Connect to Gateway via WebSocket

### FR-9: Skills System
- Bundled reusable skill modules
- Workspace-specific skill configuration
- Skill registry (ClawHub) for discovery
- Install gating and permissions

### FR-10: Security
- Main session: full tool access on host
- Non-main sessions: Docker sandbox with restricted tools
- DM pairing with approval codes
- Localhost-only Gateway by default
- Optional remote access via Tailscale/SSH

## Non-Functional Requirements

### NFR-1: Self-Hosted
- Runs entirely on user's infrastructure
- No mandatory cloud dependencies
- Works offline (except for LLM API calls)

### NFR-2: Cross-Platform
- macOS, Linux, Windows (WSL2)
- Node.js ≥22 runtime

### NFR-3: Extensible
- Plugin architecture for new channels
- Custom tool definitions
- Skill authoring support

### NFR-4: Real-Time
- WebSocket streaming for responses
- Low-latency voice interaction

---

# Mapping to Azure Boards AI

## What Applies

| OpenClaw Concept | Azure Boards AI Application |
|------------------|----------------------------|
| **Multi-Channel Gateway** | Single channel (Azure DevOps Extension), but same WebSocket pattern for streaming |
| **Agent Runtime + Tool Use** | Core of our system — Claude with Azure DevOps tools |
| **Session Management** | Session per Work Item with transcript history |
| **Session State** | Flow states: idle → specify → plan → execute |
| **Tool System** | Our tools: specify, plan, execute, search, read/update work item |
| **Skills System** | Reusable flows like "specify", "plan" as skill-like modules |
| **Streaming Responses** | Real-time chat responses via WebSocket |

## What Does NOT Apply

| OpenClaw Feature | Why Not Applicable |
|------------------|-------------------|
| Multi-channel messaging | We only have Azure DevOps |
| Voice interaction | Not needed for work items |
| Device nodes (camera, location) | Not relevant |
| Docker sandbox | Overkill for enterprise context |
| Visual Canvas/A2UI | We use assistant-ui instead |
| Cron/Webhooks | Out of scope for v1 |
| Multiple agents | Single agent per organization |

## Concepts to Adopt

### 1. Gateway Pattern (Simplified)
- Single WebSocket endpoint for Extension ↔ Server communication
- Handles session routing and streaming

### 2. Session Model
- Session bound to Work Item (not just conversation)
- Transcript preservation
- State machine for flows

### 3. Tool Architecture
- Schema separate from implementation
- Context passed to tools (Azure DevOps client, session info)
- Typed inputs/outputs

### 4. Skills as Flows
- "Specify" skill: structured requirements gathering
- "Plan" skill: task breakdown with dependencies
- "Execute" skill: batch work item creation
- Each skill has defined entry/exit criteria

## New Requirements (Not in OpenClaw)

| Requirement | Reason |
|-------------|--------|
| Azure DevOps API integration | Our target platform |
| Work Item context awareness | Need to understand WI structure |
| Parent-child WI relationships | Core for task breakdown |
| Dry-run mode | Preview before creating items |
| User permission passthrough | Respect Azure DevOps RBAC |
