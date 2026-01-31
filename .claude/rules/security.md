# Security Rules

## Pre-Commit Checklist

Before every commit, verify:

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] Input validation on all user input
- [ ] No SQL/NoSQL injection vulnerabilities
- [ ] XSS protection (sanitize output)
- [ ] Authentication/authorization checks in place
- [ ] Rate limiting considered
- [ ] Error messages don't leak sensitive info

## Secret Management

```typescript
// ❌ NEVER do this
const apiKey = "sk-ant-xxxxx";

// ✅ Always use environment variables
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is required");
}
```

## Security Response

If a vulnerability is found:

1. Stop and assess severity
2. If secrets exposed: rotate immediately
3. Document the issue
4. Fix before continuing other work

## Sensitive Data

Never log or expose:

- API keys and tokens
- Passwords
- Personal user data
- Internal error stack traces (in production)
