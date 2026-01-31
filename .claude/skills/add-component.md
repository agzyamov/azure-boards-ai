# Add Component

Create a new React component for extension.

## Trigger

- "add component"
- "create component"
- "new component"

## Steps

1. Create file at `packages/extension/src/components/{Name}.tsx`:

```tsx
import { FC } from "react";

interface {Name}Props {
  // props
}

export const {Name}: FC<{Name}Props> = (props) => {
  return (
    <div>
      {/* implementation */}
    </div>
  );
};
```

2. Export from `packages/extension/src/components/index.ts`
