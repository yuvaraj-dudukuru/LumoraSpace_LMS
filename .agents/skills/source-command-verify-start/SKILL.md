---
name: "source-command-verify-start"
description: "Migrated source command `verify-start`"
---

# source-command-verify-start

Use this skill when the user asks to run the migrated source command `verify-start`.

## Command Template

# 🔍 Verification Commands

Truth verification system for ensuring code quality and correctness with a 0.95 accuracy threshold.

## Overview

The verification system provides real-time truth checking and validation for all agent tasks, ensuring high-quality outputs and automatic rollback on failures.

## Subcommands

### `verify check`
Run verification checks on current code or agent outputs.

```bash
Codex-flow verify check --file src/app.js
Codex-flow verify check --task "task-123"
Codex-flow verify check --threshold 0.98
```

### `verify rollback`
Automatically rollback changes that fail verification.

```bash
Codex-flow verify rollback --to-commit abc123
Codex-flow verify rollback --last-good
Codex-flow verify rollback --interactive
```

### `verify report`
Generate verification reports and metrics.

```bash
Codex-flow verify report --format json
Codex-flow verify report --export metrics.html
Codex-flow verify report --period 7d
```

### `verify dashboard`
Launch interactive verification dashboard.

```bash
Codex-flow verify dashboard
Codex-flow verify dashboard --port 3000
Codex-flow verify dashboard --export
```

## Configuration

Default threshold: **0.95** (95% accuracy required)

Configure in `.Codex-flow/config.json`:
```json
{
  "verification": {
    "threshold": 0.95,
    "autoRollback": true,
    "gitIntegration": true,
    "hooks": {
      "preCommit": true,
      "preTask": true,
      "postEdit": true
    }
  }
}
```

## Integration

### With Swarm Commands
```bash
Codex-flow swarm --verify --threshold 0.98
Codex-flow hive-mind --verify
```

### With Training Pipeline
```bash
Codex-flow train --verify --rollback-on-fail
```

### With Pair Programming
```bash
Codex-flow pair --verify --real-time
```

## Metrics

- **Truth Score**: 0.0 to 1.0 (higher is better)
- **Confidence Level**: Statistical confidence in verification
- **Rollback Rate**: Percentage of changes rolled back
- **Quality Improvement**: Trend over time

## Examples

### Basic Verification
```bash
# Verify current directory
Codex-flow verify check

# Verify with custom threshold
Codex-flow verify check --threshold 0.99

# Verify and auto-fix
Codex-flow verify check --auto-fix
```

### Advanced Workflows
```bash
# Continuous verification during development
Codex-flow verify watch --directory src/

# Batch verification
Codex-flow verify batch --files "*.js" --parallel

# Integration testing
Codex-flow verify integration --test-suite full
```

## Performance

- Verification latency: <100ms for most checks
- Rollback time: <1s for git-based rollback
- Dashboard refresh: Real-time via WebSocket

## Related Commands

- `truth` - View truth scores and metrics
- `pair` - Collaborative development with verification
- `train` - Training with verification feedback
