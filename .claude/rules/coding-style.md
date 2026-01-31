# Coding Style Rules

## Core Principles

### Immutability

Never modify existing objects. Create new ones instead:

```typescript
// ❌ Bad
user.name = name;

// ✅ Good
const updatedUser = { ...user, name };
```

### File Organization

- Prefer many small files over few large files
- Target: 200-400 lines per file
- Maximum: 800 lines per file
- Organize by feature/domain, not by file type

### Error Handling

- All risky operations must have try-catch
- Provide meaningful error messages
- Never fail silently

### Input Validation

- Validate all user input with Zod schemas
- Validate at system boundaries

## Quality Checklist

Before completing any task, verify:

- [ ] Readable, descriptive names
- [ ] Functions under 50 lines
- [ ] Files under 800 lines
- [ ] Max nesting depth: 4 levels
- [ ] Comprehensive error handling
- [ ] No console.log (use logger)
- [ ] No magic numbers
- [ ] Immutable patterns used
