# /security Command

Security audit of code.

## Usage

```
/security [file or scope]
```

## Behavior

1. Scan for security vulnerabilities
2. Check authentication/authorization
3. Validate input handling
4. Check secret management
5. Report findings by severity

## Example

```
/security packages/server/src/routes
```

Output: Security review with vulnerabilities and recommendations.
