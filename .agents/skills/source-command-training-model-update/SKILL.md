---
name: "source-command-training-model-update"
description: "Migrated source command `training-model-update`"
---

# source-command-training-model-update

Use this skill when the user asks to run the migrated source command `training-model-update`.

## Command Template

# model-update

Update neural models with new data.

## Usage
```bash
npx Codex-flow training model-update [options]
```

## Options
- `--model <name>` - Model to update
- `--incremental` - Incremental update
- `--validate` - Validate after update

## Examples
```bash
# Update all models
npx Codex-flow training model-update

# Specific model
npx Codex-flow training model-update --model agent-selector

# Incremental with validation
npx Codex-flow training model-update --incremental --validate
```
