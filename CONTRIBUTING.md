# Contributing

## Branch Strategy

### Main Branch

- `main` is protected
- No direct pushes allowed
- All changes via Pull Request only

### Feature Branches

All features must be developed on separate branches:

```
feat/<feature-name>     # New features
fix/<bug-name>          # Bug fixes
chore/<task-name>       # Maintenance tasks
docs/<doc-name>         # Documentation updates
refactor/<scope>        # Code refactoring
```

### Workflow

```
1. Create branch from main
   git checkout main
   git pull origin main
   git checkout -b feat/chat-panel

2. Make changes and commit
   git add .
   git commit -m "feat: add chat panel component"

3. Push branch
   git push -u origin feat/chat-panel

4. Create Pull Request
   gh pr create --title "feat: add chat panel" --body "Description..."

5. Wait for CI checks to pass
   - Lint & Format
   - Security Scan
   - Build

6. Merge PR (squash recommended)
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting (no code change)
- `refactor` — Code refactoring
- `perf` — Performance improvement
- `test` — Adding tests
- `chore` — Maintenance tasks
- `ci` — CI/CD changes

### Examples

```
feat(server): add session management
fix(extension): resolve websocket reconnection
docs: update specification
chore(deps): update eslint to v9
```

## Pull Request Requirements

Before merging, PR must pass:

- [ ] ESLint (no errors)
- [ ] Prettier (formatted)
- [ ] Gitleaks (no secrets)
- [ ] Trivy (no critical vulnerabilities)
- [ ] Build successful

## Code Quality

- Cognitive complexity ≤ 15 per function
- No duplicate strings (> 3 occurrences)
- No identical functions
- Use `const` over `let`
- Use `import type` for type-only imports
