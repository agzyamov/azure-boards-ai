import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@azure-boards-ai/shared";

export interface ChatOptions {
  messages: Message[];
  systemPrompt: string;
  tools?: Anthropic.Tool[];
}

export interface ChatChunk {
  type: "text" | "tool_use" | "done";
  text?: string;
  toolUse?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
}

export class ClaudeService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required");
    }

    this.client = new Anthropic({
      apiKey,
    });
  }

  async *chat(options: ChatOptions): AsyncGenerator<ChatChunk> {
    const { messages, systemPrompt, tools } = options;

    const anthropicMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const stream = await this.client.messages.stream({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      tools,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield {
          type: "text",
          text: event.delta.text,
        };
      } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        yield {
          type: "tool_use",
          toolUse: {
            id: event.content_block.id,
            name: event.content_block.name,
            input: event.content_block.input as Record<string, unknown>,
          },
        };
      }
    }

    yield { type: "done" };
  }
}
