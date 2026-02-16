# AGENTS.md — Project Guidelines for cline-exporter

## Project Overview

**cline-exporter** is a command-line Node.js utility that converts Cline conversation history (JSON files) into a self-contained static website. The output is a folder of static assets (HTML, CSS, JS) that can be opened in any browser without a server.

### Input Format

Cline stores each conversation as a directory containing:

- **`ui_messages.json`** — Array of UI-level message objects (`say` / `ask` types) with timestamps, text content, tool calls, command output, images, etc.
- **`api_conversation_history.json`** — Array of alternating `user` / `assistant` message objects containing content blocks (`text`, `thinking`, `tool_use`, `tool_result`) along with model info and token metrics.
- **`task_metadata.json`** — Metadata including files in context, mode, and task state.

Sample conversations are in `sample-conversations/` for reference and testing.

---

## Technology & Tooling

| Concern         | Choice                                |
| --------------- | ------------------------------------- |
| Runtime         | Node.js (LTS)                         |
| Language        | TypeScript — strict mode              |
| Package manager | pnpm                                  |
| Linting         | ESLint (with `@typescript-eslint`)    |
| Formatting      | Prettier                              |
| Testing         | Vitest                                |
| Build           | tsup (or similar zero-config bundler) |

### TypeScript

- Enable `"strict": true` in `tsconfig.json`.
- No use of `any` unless explicitly justified with a comment.
- Prefer explicit return types on exported functions.

### Linting & Formatting

- All code must pass `pnpm lint` (ESLint) and `pnpm format:check` (Prettier) with zero warnings.
- Use a flat ESLint config (`eslint.config.ts`).

### Testing

- Write unit tests for parsing logic, data transformations, and any non-trivial utility functions.
- Tests live alongside source files using the `*.test.ts` naming convention (e.g., `parser.ts` → `parser.test.ts`).
- Aim for meaningful coverage, not 100% — focus on correctness of data transformations and edge cases.
- Use the sample conversations in `sample-conversations/` as fixtures in integration tests.

---

## Project Structure (Planned)

```
cline-exporter/
├── AGENTS.md
├── package.json
├── tsconfig.json
├── eslint.config.ts
├── src/
│   ├── cli.ts              # Entry point — argument parsing
│   ├── parser/             # Read & validate Cline JSON files
│   ├── renderer/           # Transform parsed data → HTML
│   ├── templates/          # HTML/CSS/JS templates for the static site
│   └── utils/              # Shared helpers
├── tests/                  # Integration / snapshot tests
├── sample-conversations/   # Example Cline conversation data
└── dist/                   # Build output (git-ignored)
```

---

## Workflow & Collaboration

### Plan First, Build Second

We alternate between **planning** and **implementation** phases:

1. **Plan** — Discuss the approach, agree on scope, data structures, and interfaces.
2. **Implement** — Build only what was agreed upon.
3. **Review** — Verify the result, then plan the next increment.

> **Always check with the user before building anything.** Do not jump ahead to implementation without confirmation.

### When in Doubt, Ask

If anything is ambiguous — requirements, design tradeoffs, naming, scope — **ask a clarifying question** rather than guessing. A quick question now saves a rewrite later.

### Living Plan Document

- Maintain a **`PLAN.md`** file in the project root that captures the current development plan.
- Update it as decisions are made, scope changes, or new phases begin.
- This is the single source of truth for "what are we building next and why."

### Commit Discipline

- Use clear, conventional commit messages (e.g., `feat: add JSON parser`, `fix: handle empty message arrays`).
- Keep commits focused — one logical change per commit.

---

## Code Style & Conventions

- **Functional style preferred** — favor pure functions and immutable data where practical.
- **Named exports** — avoid default exports.
- **Descriptive names** — no abbreviations unless universally understood (`url`, `id`, etc.).
- **Error handling** — fail fast with clear error messages. CLI should exit with non-zero codes on failure and print user-friendly diagnostics to stderr.
- **No runtime dependencies on heavyweight frameworks** — keep the dependency footprint small. The output site must be fully self-contained (inline CSS/JS, no CDN links).

---

## Output Requirements (Initial)

- The generated site should be a **folder of static assets** (HTML, CSS, JS) that works offline — no server required.
- CSS and JS are **prebuilt static files** that don't depend on conversation data. Only the HTML (or a data file it references) is generated per-conversation.
- Render the conversation in a readable, chat-like layout.
- Distinguish between user messages, assistant text, thinking/reasoning blocks, tool use, command output, and results.
- Support syntax highlighting for code blocks.
- Include basic metadata: model used, token counts, timestamps.
