// Core message types
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// Session types
export interface WorkItemSession {
  id: string;
  workItemId: number;
  projectId: string;
  organizationUrl: string;
  state: "idle" | "specify" | "plan" | "execute";
  transcript: Message[];
  context: {
    workItem: WorkItem;
    relatedItems: WorkItem[];
    childItems: WorkItem[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionCreateRequest {
  workItemId: number;
  projectId: string;
  organizationUrl: string;
}

export interface SessionUpdateRequest {
  state?: "idle" | "specify" | "plan" | "execute";
}

// Work item types
export interface WorkItem {
  id: number;
  fields: Record<string, string | number | undefined>;
}

// Chat types
export interface ChatRequest {
  sessionId: string;
  message: string;
}

export interface StreamChunk {
  type: "text" | "tool_call" | "done" | "error";
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    input: Record<string, unknown>;
  };
  error?: string;
}
