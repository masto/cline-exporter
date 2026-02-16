# cline-exporter

Convert [Cline](https://github.com/cline/cline) conversation history into a self-contained static website you can open in any browser or drop onto any hosting platform.

## Features

- **Static output** — Generates a folder of HTML, CSS, JS, and images. No server required.
- **All message types** — Renders user prompts, assistant text, thinking/reasoning, tool calls, commands, command output, browser actions, MCP operations, and more.
- **Image extraction** — Base64 screenshots from browser actions are decoded and saved as separate image files.
- **Syntax highlighting** — Code blocks are highlighted at build time using [highlight.js](https://highlightjs.org/).
- **Filter toggles** — Show/hide categories of messages (Thinking, Browser, Tools, MCP, Commands, Progress, API Stats) with checkboxes that persist via localStorage.
- **Tool grouping** — Consecutive tool calls of the same type (e.g. 13 file creations in a row) are collapsed into a single expandable summary.
- **Dark & light mode** — Respects `prefers-color-scheme` automatically.
- **Conversation metadata** — Displays model, provider, cost, token counts, duration, and API request count.

## Installation

```bash
git clone https://github.com/masto/cline-exporter.git
cd cline-exporter
pnpm install
```

## Usage

```bash
pnpm cline-exporter <conversation-dir> [--output <dir>]
```

### Arguments

| Argument             | Description                                                       |
| -------------------- | ----------------------------------------------------------------- |
| `conversation-dir`   | Path to a Cline conversation folder (contains `ui_messages.json`) |
| `--output`, `-o`     | Output directory (default: `./cline-export-output`)               |
| `--no-commands`      | Omit all command and command output messages                      |
| `--no-full-paths`    | Strip absolute project-root prefixes from displayed file paths    |
| `--no-file-contents` | Show file create/edit entries without embedded file contents      |
| `--help`, `-h`       | Show help                                                         |

### Example

```bash
# Export a Cline conversation
pnpm cline-exporter ~/Library/Application\ Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/1234567890

# Specify output directory
pnpm cline-exporter ./my-conversation -o ./exported-site

# Privacy-friendly export
pnpm cline-exporter ./my-conversation \
  --no-commands \
  --no-full-paths \
  --no-file-contents

# Open the result
open ./cline-export-output/index.html
```

### Finding your conversations

Cline stores conversations in VS Code's global storage:

```
~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/
```

Each conversation is a numbered directory containing `ui_messages.json`, `api_conversation_history.json`, and `task_metadata.json`.

## Output structure

```
cline-export-output/
├── index.html      # The conversation page
├── style.css       # Prebuilt stylesheet (dark/light mode)
├── script.js       # Filter toggles, copy-to-clipboard
└── images/         # Extracted browser screenshots (if any)
    ├── 001.webp
    ├── 002.webp
    └── ...
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development (watch mode)
pnpm dev

# Run tests
pnpm test

# Lint & format
pnpm lint
pnpm format:check
```

## License

[Apache License 2.0](LICENSE)
