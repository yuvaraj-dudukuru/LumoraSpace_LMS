---
name: "source-command-verify-check"
description: "Migrated source command `verify-check`"
---

# source-command-verify-check

Use this skill when the user asks to run the migrated source command `verify-check`.

## Command Template

# verify check

Run verification checks on code, tasks, or agent outputs.

## Usage

```bash
Codex-flow verify check [options]
```

## Options

- `--file <path>` - Verify specific file
- `--task <id>` - Verify task output
- `--directory <path>` - Verify entire directory
- `--threshold <0-1>` - Override default threshold (0.95)
- `--auto-fix` - Attempt automatic fixes
- `--json` - Output results as JSON
- `--verbose` - Show detailed verification steps

## Examples

```bash
# Basic file verification
Codex-flow verify check --file src/app.js

# Verify with higher threshold
Codex-flow verify check --file src/critical.js --threshold 0.99

# Verify and auto-fix issues
Codex-flow verify check --directory src/ --auto-fix

# Get JSON output for CI/CD
Codex-flow verify check --json > verification.json
```

## Truth Scoring

The check command evaluates:
- Code correctness
- Best practices adherence
- Security vulnerabilities
- Performance implications
- Documentation completeness

## Exit Codes

- `0` - Verification passed
- `1` - Verification failed
- `2` - Error during verification
