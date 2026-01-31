# Add Tool

Create a new tool for Claude Agent.

## Trigger

- "add tool"
- "create tool"
- "new tool"

## Steps

1. Create schema file at `packages/server/src/tools/{name}.schema.ts`:

```typescript
import type { ToolDefinition } from "@azure-boards-ai/shared";

export const {name}Schema: ToolDefinition = {
  name: "{name}",
  description: "...",
  input_schema: {
    type: "object",
    properties: {
      // ...
    },
    required: []
  }
};
```

2. Create implementation at `packages/server/src/tools/{name}.ts`:

```typescript
import type { ToolContext } from "../agent/types.js";
import type { {Name}Input, {Name}Output } from "@azure-boards-ai/shared";

export async function {name}(
  input: {Name}Input,
  context: ToolContext
): Promise<{Name}Output> {
  // implementation
}
```

3. Add types to `packages/shared/src/types/tools.ts`

4. Register tool in `packages/server/src/agent/tools.ts`
