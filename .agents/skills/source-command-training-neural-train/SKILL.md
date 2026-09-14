---
name: "source-command-training-neural-train"
description: "Migrated source command `training-neural-train`"
---

# source-command-training-neural-train

Use this skill when the user asks to run the migrated source command `training-neural-train`.

## Command Template

# neural-train

Train neural patterns with SONA (Self-Optimizing Neural Architecture) for adaptive learning and pattern recognition.

## Usage
```bash
npx Codex-flow neural train [options]
```

## Options
- `-p, --pattern <type>` - Pattern type: coordination, optimization, prediction (default: coordination)
- `-e, --epochs <n>` - Number of training epochs (default: 50)
- `-d, --data <file>` - Training data file (JSON)
- `-m, --model <id>` - Model ID to train
- `-l, --learning-rate <rate>` - Learning rate (default: 0.001)
- `-b, --batch-size <n>` - Batch size (default: 32)

## Pattern Persistence

Trained patterns are **automatically persisted** to disk:
- **Location**: `.Codex-flow/neural/patterns.json`
- **Stats**: `.Codex-flow/neural/stats.json`

Patterns survive process restarts and are loaded automatically on next session.

## Examples

```bash
# Train coordination patterns (50 epochs)
npx Codex-flow neural train -p coordination -e 50

# Train with custom learning rate
npx Codex-flow neural train -p optimization -l 0.005

# Train from file
npx Codex-flow neural train -d ./training-data.json

# Quick training (10 epochs)
npx Codex-flow neural train -e 10
```

## Output

Training produces:
- **Patterns Recorded**: Number of patterns stored in ReasoningBank
- **Trajectories**: Complete learning sequences recorded
- **SONA Adaptation**: Target is <0.05ms per operation
- **Persistence Path**: Where patterns are saved

## List Trained Patterns

```bash
# List all persisted patterns
npx Codex-flow neural patterns --action list

# Search patterns by query
npx Codex-flow neural patterns --action list -q "error handling"

# Analyze patterns
npx Codex-flow neural patterns --action analyze -q "coordination"
```

## Performance Targets

| Metric | Target |
|--------|--------|
| SONA Adaptation | <0.05ms (achieved: ~2μs) |
| Pattern Search | O(log n) with HNSW |
| Memory Efficient | Circular buffers |

## Related Commands

- `neural patterns` - List and search patterns
- `neural status` - Check neural system status
- `neural predict` - Make predictions using trained models
