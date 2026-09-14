---
name: "source-command-training-pattern-learn"
description: "Migrated source command `training-pattern-learn`"
---

# source-command-training-pattern-learn

Use this skill when the user asks to run the migrated source command `training-pattern-learn`.

## Command Template

# pattern-learn

Learn patterns from successful operations.

## Usage
```bash
npx Codex-flow training pattern-learn [options]
```

## Options
- `--source <type>` - Pattern source
- `--threshold <score>` - Success threshold
- `--save <name>` - Save pattern set

## Examples
```bash
# Learn from all ops
npx Codex-flow training pattern-learn

# High success only
npx Codex-flow training pattern-learn --threshold 0.9

# Save patterns
npx Codex-flow training pattern-learn --save optimal-patterns
```
