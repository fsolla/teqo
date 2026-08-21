---
name: concise-output
description: 'Force concise agent output to reduce token waste.'
  Forces concise agent output. Reduces token waste from verbose responses,
  unnecessary preambles, and repeated context. Use at session start or
  before any skill that produces long output.
---

# Concise Output Protocol

## Rules (always apply)

1. **≤3 sentences** per response unless the user asks for detail.
2. **Never repeat** what you just read — state only new information or decisions.
3. **No preambles** — skip "Here is...", "Let me...", "I will..." — go straight to the answer.
4. **Code in code blocks** — don't write prose to describe code.
5. **Extract, don't paste** — when reporting tool results, show only relevant lines.
6. **Batch tool calls** — multiple `read`/`grep` calls in one message, not round-tripping.
7. **Show edits only** — when editing, show the changed lines with context, not the full file.
8. **No summary** at the end of a task unless explicitly asked.

## In skills

When a skill instructs verbose output (tables, multi-section reports), apply these overrides:
- Tables: max 5 rows unless the user asked for comprehensive coverage
- Reports: lead with the conclusion, details on request
- Checklists: only show items that need attention, skip passed items
