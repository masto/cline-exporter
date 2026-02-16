# PLAN.md — cline-exporter Development Plan

## Overview

Convert Cline conversation history (a folder of JSON files) into a self-contained static website that renders the conversation in a readable, chat-like layout.

---

## Phase 1: Project Scaffolding

**Status:** ✅ Complete

Set up the development environment with all tooling configured and passing.

- `pnpm init`, install dev dependencies (TypeScript, ESLint, Prettier, Vitest, tsup)
- `tsconfig.json` with `strict: true`
- `eslint.config.ts` (flat config with `@typescript-eslint`)
- `.prettierrc` and `.prettierignore`
- `package.json` scripts: `build`, `dev`, `lint`, `format`, `format:check`, `test`
- `.gitignore` for `node_modules/`, `dist/`
- Verify: `pnpm lint`, `pnpm format:check`, `pnpm test` all pass (even if trivially)

---

## Phase 2: Parser

**Status:** ✅ Complete

Read a Cline conversation directory and produce typed, validated intermediate data structures.

### Input Files

| File                            | Description                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `ui_messages.json`              | 560-entry array of UI messages. Primary rendering source.                                 |
| `api_conversation_history.json` | 118-entry array of user/assistant API messages with metrics. Used for cost/token summary. |
| `task_metadata.json`            | Files in context, model usage history.                                                    |

### Key Data Observations

**`ui_messages.json`** (primary source for rendering):

- Each entry has: `ts`, `type` ("say" | "ask"), `say`/`ask` (subtype), `text`, `images`, `files`
- Say subtypes (16): `task`, `text`, `user_feedback`, `reasoning`, `tool`, `command`, `command_output`, `completion_result`, `api_req_started`, `browser_action`, `browser_action_launch`, `browser_action_result`, `checkpoint_created`, `mcp_server_request_started`, `use_mcp_server`, `task_progress`
- Ask subtypes (5): `command`, `command_output`, `completion_result`, `plan_mode_respond`, `resume_completed_task`
- `api_req_started` entries contain embedded JSON in `text` with token/cost data
- Some entries have `modelInfo` (providerId, modelId, mode)
- Images array can contain base64 data URIs (browser screenshots)

**`api_conversation_history.json`** (supplementary — metrics/cost):

- Strictly alternating user → assistant (59 each)
- Content block types: `text`, `thinking`, `tool_use`, `image`
- Assistant entries have `modelInfo` and `metrics` (tokensIn, tokensOut, cacheReads, cacheWrites, cost)
- Tool names used: `read_file`, `write_to_file`, `replace_in_file`, `execute_command`, `attempt_completion`, `plan_mode_respond`, `browser_action`, `list_files`, `search_files`, `list_code_definition_names`, `use_mcp_tool`

**`task_metadata.json`** (supplementary — context):

- `files_in_context`: array of file records (path, state, source, timestamps)
- `model_usage`: array of model usage events (model_id, provider, mode)
- `environment_history`: array (empty in sample)

### Approach

1. Define TypeScript types for all three input files.
2. Read and validate each JSON file with clear error messages for malformed input.
3. Produce a single `ParsedConversation` object containing:
   - `task`: initial task text
   - `messages`: normalized array of UI messages
   - `summary`: aggregated stats (total cost, tokens, duration, model info)
   - `metadata`: files in context, model usage
4. Unit test with sample conversation data.

---

## Phase 3: Static Templates (CSS + JS)

**Status:** ✅ Complete

Build the prebuilt static assets that are conversation-independent.

### `style.css`

- Chat-like layout (alternating message bubbles or blocks)
- Visual distinction for: user messages, assistant text, thinking/reasoning (collapsible), tool calls, command output, code blocks, images, completion results, api request info, browser actions
- Syntax highlighting theme (via Prism.js or a lightweight alternative — or just ship a pre-built highlight.js CSS theme)
- Responsive design, dark mode support
- Collapsible sections for long content (tool results, command output, reasoning)

### `script.js`

- Toggle collapsible sections
- Copy-to-clipboard for code blocks
- Syntax highlighting initialization (if using a runtime highlighter)
- No framework dependencies — vanilla JS

### `highlight.js` or equivalent

- Ship a prebuilt syntax highlighting library (highlight.js is ~40KB minified for common languages)
- Or: pre-highlight at build time in the renderer (no runtime JS needed for highlighting)

### Decision needed: Runtime vs. build-time syntax highlighting

- **Runtime (highlight.js):** Simpler renderer, but adds ~40KB JS to output
- **Build-time:** No extra JS, but renderer is more complex. Need a Node-side highlighter like `shiki` or `highlight.js` in Node mode.

**Recommendation:** Build-time highlighting with `shiki` or `highlight.js` on the Node side. This keeps the output lighter and avoids runtime JS for highlighting. The `script.js` only handles interactivity (collapsible sections, copy buttons).

---

## Phase 4: Renderer

**Status:** ✅ Complete

Transform `ParsedConversation` → HTML string, using the static templates.

### Approach

- Use a simple template literal approach (no template engine dependency).
- Generate an `index.html` that:
  - Links to `style.css` and `script.js` (relative paths)
  - Contains a header with task summary (model, cost, duration, timestamp)
  - Renders each message as an HTML block based on its type/subtype
  - Embeds images inline (base64 data URIs for screenshots)
- Escape HTML in user-generated content.
- Apply syntax highlighting to code blocks at build time.
- Handle special message types:
  - `api_req_started` → collapsible API request info (model, tokens, cost)
  - `reasoning` / `thinking` → collapsible reasoning block
  - `tool` → formatted tool call with parameters
  - `command` / `command_output` → terminal-style block
  - `browser_action*` → image + action description
  - `completion_result` → highlighted completion summary
  - `task_progress` → progress checklist rendering

---

## Phase 5: CLI

**Status:** ✅ Complete

Wire everything together with a command-line interface.

### Usage

```
cline-export <conversation-dir> [--output <dir>]
```

- `<conversation-dir>`: Path to Cline conversation folder (containing `ui_messages.json`, etc.)
- `--output <dir>`: Output directory (default: `./cline-export-output/`)

### Flow

1. Parse arguments
2. Validate input directory (check required files exist)
3. Run parser → `ParsedConversation`
4. Run renderer → HTML string
5. Copy static assets (CSS, JS) to output directory
6. Write `index.html` to output directory
7. Print success message with path to output

### Libraries

- Argument parsing: `commander` or manual `process.argv` parsing (keep minimal)
- File I/O: Node `fs/promises`

---

## Phase 6: Testing & Polish

**Status:** ✅ Complete (initial)

- Unit tests for parser (valid input, malformed input, edge cases)
- Unit tests for renderer (message type rendering, HTML escaping, code highlighting)
- Integration test: run full pipeline on sample conversation, verify output
- Manual browser check of generated output
- README with usage instructions

---

## Data Flow

```
Conversation Directory          Static Templates
       │                              │
       ▼                              │
    Parser                            │
       │                              │
       ▼                              │
  ParsedConversation                  │
       │                              │
       ▼                              ▼
    Renderer ────────────────► Output Directory
                                ├── index.html
                                ├── style.css
                                └── script.js
```

---

## Resolved Questions

1. **Syntax highlighting:** ✅ Build-time with `highlight.js` in Node mode. Code blocks are pre-highlighted; no runtime JS needed for syntax coloring.
2. **Image handling:** ✅ Kept inline (base64 data URIs) for simplicity. Can optimize later if needed.
3. **Multiple conversations:** Deferred — single conversation export only for now.
4. **Dark/light mode:** ✅ Auto-detect with `prefers-color-scheme`. Dark mode is default, light mode activates automatically.

---

## Current Status

**All phases complete.** The tool is functional — builds, lints, tests, and produces a nice-looking static site from Cline conversation data.

### Future enhancements

- Batch export (multiple conversations)
- Extract large base64 images to separate files
- More unit tests for renderer
- README with usage docs
- npm publishing
