import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeService } from "./claude.js";
import type { Message } from "@azure-boards-ai/shared";

const TEST_SYSTEM_PROMPT = "You are helpful";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const Anthropic = vi.fn();
  Anthropic.prototype.messages = {
    stream: vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } };
        yield { type: "done" };
      },
    }),
  };
  return { default: Anthropic };
});

describe("ClaudeService", () => {
  let service: ClaudeService;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    service = new ClaudeService();
  });

  describe("constructor", () => {
    it("should throw if API key is missing", () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new ClaudeService()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });

  describe("chat", () => {
    it("should accept messages and system prompt", async () => {
      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        },
      ];

      // Just verify it doesn't throw
      const generator = service.chat({
        messages,
        systemPrompt: TEST_SYSTEM_PROMPT,
      });

      expect(generator).toBeDefined();
    });

    it("should stream text delta events", async () => {
      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Hello",
          createdAt: new Date(),
        },
      ];

      const chunks = [];
      for await (const chunk of service.chat({
        messages,
        systemPrompt: TEST_SYSTEM_PROMPT,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].type).toBe("text");
      expect(chunks[0].text).toBe("Hello");
      expect(chunks[chunks.length - 1].type).toBe("done");
    });

    it("should handle tool use events", async () => {
      // Create a new mock for this specific test
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool_123",
              name: "search",
              input: { query: "test" },
            },
          };
          yield { type: "done" };
        },
      };

      vi.spyOn(service["client"].messages, "stream").mockResolvedValueOnce(mockStream as never);

      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Search for something",
          createdAt: new Date(),
        },
      ];

      const chunks = [];
      for await (const chunk of service.chat({
        messages,
        systemPrompt: TEST_SYSTEM_PROMPT,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].type).toBe("tool_use");
      expect(chunks[0].toolUse).toEqual({
        id: "tool_123",
        name: "search",
        input: { query: "test" },
      });
      expect(chunks[1].type).toBe("done");
    });

    it("should handle mixed text and tool events", async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: "Let me search for that." },
          };
          yield {
            type: "content_block_start",
            content_block: {
              type: "tool_use",
              id: "tool_456",
              name: "read_work_item",
              input: { id: 123 },
            },
          };
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: " Found it!" },
          };
          yield { type: "done" };
        },
      };

      vi.spyOn(service["client"].messages, "stream").mockResolvedValueOnce(mockStream as never);

      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Find work item 123",
          createdAt: new Date(),
        },
      ];

      const chunks = [];
      for await (const chunk of service.chat({
        messages,
        systemPrompt: TEST_SYSTEM_PROMPT,
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(4);
      expect(chunks[0].type).toBe("text");
      expect(chunks[0].text).toBe("Let me search for that.");
      expect(chunks[1].type).toBe("tool_use");
      expect(chunks[1].toolUse?.name).toBe("read_work_item");
      expect(chunks[2].type).toBe("text");
      expect(chunks[2].text).toBe(" Found it!");
      expect(chunks[3].type).toBe("done");
    });

    it("should pass tools to Claude API", async () => {
      const messages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "Help me",
          createdAt: new Date(),
        },
      ];

      const tools = [
        {
          name: "search",
          description: "Search for items",
          input_schema: {
            type: "object" as const,
            properties: {
              query: { type: "string" as const },
            },
            required: ["query"],
          },
        },
      ];

      const streamSpy = vi.spyOn(service["client"].messages, "stream");
      streamSpy.mockClear(); // Clear previous calls

      // Consume the stream
      // eslint-disable-next-line sonarjs/no-unused-vars
      for await (const _chunk of service.chat({
        messages,
        systemPrompt: TEST_SYSTEM_PROMPT,
        tools,
      })) {
        // Continue consuming
      }

      expect(streamSpy).toHaveBeenCalledWith({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: TEST_SYSTEM_PROMPT,
        messages: [{ role: "user", content: "Help me" }],
        tools,
      });
    });
  });
});
