import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent } from "./agent.js";
import type { WorkItemSession } from "@azure-boards-ai/shared";

// Mock ClaudeService
vi.mock("../services/claude.js", () => ({
  ClaudeService: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockImplementation(async function* () {
      yield { type: "text", text: "Hello" };
      yield { type: "done" };
    }),
  })),
}));

describe("Agent", () => {
  let agent: Agent;
  let mockSession: WorkItemSession;
  let mockClaude: { chat: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClaude = {
      chat: vi.fn().mockImplementation(async function* () {
        yield { type: "text", text: "Hello" };
        yield { type: "done" };
      }),
    };

    mockSession = {
      id: "test-session",
      workItemId: 123,
      projectId: "TestProject",
      organizationUrl: "https://dev.azure.com/test",
      state: "idle",
      transcript: [],
      context: {
        workItem: {
          id: 123,
          fields: {
            "System.Title": "Test Work Item",
            "System.Description": "Test description",
            "System.State": "New",
            "System.WorkItemType": "User Story",
          },
        } as never,
        relatedItems: [],
        childItems: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    agent = new Agent(mockSession, mockClaude as never);
  });

  describe("chat", () => {
    it("should stream responses from Claude", async () => {
      const chunks: string[] = [];

      for await (const chunk of agent.chat("Hello")) {
        if (chunk.type === "text" && chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks).toContain("Hello");
    });

    it("should include work item context in prompt", async () => {
      const chunks = [];

      for await (const chunk of agent.chat("What's the current work item?")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle tool use events", async () => {
      const mockClaudeWithTools = {
        chat: vi.fn().mockImplementation(async function* () {
          yield {
            type: "tool_use",
            toolUse: {
              id: "tool_123",
              name: "search",
              input: { query: "test" },
            },
          };
          yield { type: "done" };
        }),
      };

      const agentWithTools = new Agent(mockSession, mockClaudeWithTools as never);
      const chunks = [];

      for await (const chunk of agentWithTools.chat("Search for something")) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe("tool_call");
      expect(chunks[0].toolCall).toEqual({
        id: "tool_123",
        name: "search",
        input: { query: "test" },
      });
      expect(chunks[1].type).toBe("done");
    });

    it("should add messages to transcript", async () => {
      const initialLength = mockSession.transcript.length;

      // Consume the stream
      // eslint-disable-next-line sonarjs/no-unused-vars
      for await (const _chunk of agent.chat("Test message")) {
        // Continue consuming
      }

      expect(mockSession.transcript.length).toBe(initialLength + 2);
      expect(mockSession.transcript[initialLength].role).toBe("user");
      expect(mockSession.transcript[initialLength].content).toBe("Test message");
      expect(mockSession.transcript[initialLength + 1].role).toBe("assistant");
    });
  });
});
