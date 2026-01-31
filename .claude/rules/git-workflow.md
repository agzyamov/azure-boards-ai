# Git Workflow Rules

## Commit Messages

Format: `<type>: <description>`

Types:

- `feat` — New feature
- `fix` — Bug fix
- `refactor` — Code refactoring
- `docs` — Documentation
- `test` — Tests
- `chore` — Maintenance
- `perf` — Performance
- `ci` — CI/CD changes

## Pull Request Process

1. Review ALL commits, not just the latest
2. Use `git diff main...HEAD` to see full changes
3. Write thorough summary
4. Include test plan
5. Push with `-u` flag for new branches

## Feature Development Cycle

### 1. Planning

- Plan implementation before coding
- Identify dependencies and blockers
- Break into manageable tasks

### 2. Test-Driven Development

- Write tests first (RED)
- Implement to pass (GREEN)
- Refactor (IMPROVE)
- Verify 80%+ coverage

### 3. Review

- Self-review code before PR
- Fix CRITICAL and HIGH issues
- Address MEDIUM when feasible

### 4. Finalize

- Write clear commit messages
- Squash if needed
- Push and create PR

## Branch Naming

```
feat/<feature-name>
fix/<bug-name>
docs/<doc-name>
refactor/<scope>
chore/<task-name>
```
