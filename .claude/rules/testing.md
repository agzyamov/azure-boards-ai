# Testing Rules

## Coverage Requirements

**Minimum: 80% code coverage**

## Test Types Required

1. **Unit Tests** — Isolated functions and components
2. **Integration Tests** — API endpoints, services
3. **E2E Tests** — Critical user workflows (Playwright)

## Test-Driven Development (TDD)

Follow RED → GREEN → REFACTOR cycle:

1. **RED**: Write test first, confirm it fails
2. **GREEN**: Implement minimal solution to pass
3. **REFACTOR**: Improve code quality
4. **VERIFY**: Check coverage ≥ 80%

## Debugging Tests

When tests fail:

1. Check test isolation (no interdependencies)
2. Validate mock configurations
3. Fix implementation, not the test (unless test is wrong)
4. Use descriptive test names

## Test File Structure

```
src/
├── feature/
│   ├── feature.ts
│   └── feature.test.ts      # Co-located tests
└── __tests__/
    └── integration/         # Integration tests
```
