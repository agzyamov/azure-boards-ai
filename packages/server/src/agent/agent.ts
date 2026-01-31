import type { WorkItemSession, Message, StreamChunk } from "@azure-boards-ai/shared";
import { ClaudeService } from "../services/claude.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { nanoid } from "nanoid";

export class Agent {
  private session: WorkItemSession;
  private claude: ClaudeService;

  constructor(session: WorkItemSession, claude?: ClaudeService) {
    this.session = session;
    this.claude = claude || new ClaudeService();
  }

  async *chat(userMessage: string): AsyncGenerator<StreamChunk> {
    // Add user message to transcript
    const userMsg: Message = {
      id: nanoid(),
      role: "user",
      content: userMessage,
      createdAt: new Date(),
    };

    this.session.transcript.push(userMsg);

    // Build context-aware prompt
    const contextPrompt = this.buildContextPrompt();
    const fullSystemPrompt = `${SYSTEM_PROMPT}\n\n${contextPrompt}`;

    // Stream response from Claude
    let assistantMessage = "";

    for await (const chunk of this.claude.chat({
      messages: this.session.transcript,
      systemPrompt: fullSystemPrompt,
    })) {
      if (chunk.type === "text" && chunk.text) {
        assistantMessage += chunk.text;
        yield {
          type: "text",
          content: chunk.text,
        };
      } else if (chunk.type === "tool_use" && chunk.toolUse) {
        yield {
          type: "tool_call",
          toolCall: {
            id: chunk.toolUse.id,
            name: chunk.toolUse.name,
            input: chunk.toolUse.input,
          },
        };
      } else if (chunk.type === "done") {
        // Add assistant message to transcript
        const assistantMsg: Message = {
          id: nanoid(),
          role: "assistant",
          content: assistantMessage,
          createdAt: new Date(),
        };
        this.session.transcript.push(assistantMsg);

        yield { type: "done" };
      }
    }
  }

  private buildContextPrompt(): string {
    const { workItem } = this.session.context;

    return `## Current Work Item

ID: ${workItem.id}
Title: ${workItem.fields["System.Title"]}
Type: ${workItem.fields["System.WorkItemType"]}
State: ${workItem.fields["System.State"]}

${workItem.fields["System.Description"] ? `Description:\n${workItem.fields["System.Description"]}` : ""}

${
  workItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"]
    ? `Acceptance Criteria:\n${workItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"]}`
    : ""
}`;
  }
}
