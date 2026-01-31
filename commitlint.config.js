export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Type must be one of these
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation
        "style",    // Formatting (no code change)
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "perf",     // Performance improvement
        "test",     // Adding tests
        "chore",    // Maintenance tasks
        "ci",       // CI/CD changes
        "build",    // Build system changes
        "revert",   // Revert previous commit
      ],
    ],
    // Subject (message) should not be empty
    "subject-empty": [2, "never"],
    // Type should not be empty
    "type-empty": [2, "never"],
    // Subject should be lowercase
    "subject-case": [2, "always", "lower-case"],
  },
};
