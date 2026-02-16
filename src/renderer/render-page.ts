import type { ParsedConversation, RawUiMessage } from "../types.js";
import {
  escapeHtml,
  formatCost,
  formatDuration,
  formatTimestamp,
  formatTokens,
} from "../utils/html.js";
import { renderMessage } from "./render-message.js";

/** Tool name → human-readable label for group summaries */
const TOOL_GROUP_LABELS: Record<string, string> = {
  newFileCreated: "Files created",
  editedExistingFile: "Files edited",
  readFile: "Files read",
  listFilesTopLevel: "Directories listed",
  listFilesRecursive: "Directories listed",
  listCodeDefinitionNames: "Code definitions listed",
  searchFiles: "File searches",
  // fallback handled in code
};

/** Minimum tool calls in a run needed to form a group */
const MIN_GROUP_SIZE = 3;

/**
 * Message subtypes that don't break a tool run.
 * These "noise" messages appear between tool calls but shouldn't prevent grouping.
 */
const TRANSPARENT_SUBTYPES = new Set([
  "task_progress",
  "checkpoint_created",
  "api_req_started",
]);

interface ToolInfo {
  tool: string;
  path?: string;
}

/** Try to extract tool name and path from a tool message's JSON text */
function parseToolInfo(message: RawUiMessage): ToolInfo | null {
  if (message.say !== "tool" || !message.text) return null;
  try {
    const data = JSON.parse(message.text) as ToolInfo;
    return data.tool ? data : null;
  } catch {
    return null;
  }
}

/** Get the subtype of a message */
function getSubtype(message: RawUiMessage): string {
  return message.say ?? message.ask ?? "unknown";
}

interface MessageSlot {
  kind: "single";
  html: string;
}

interface GroupSlot {
  kind: "group";
  toolName: string;
  paths: string[];
  /** Indices of all messages in this group (tool + noise) */
  memberIndices: number[];
  /** Indices of just the tool messages */
  toolIndices: number[];
}

type Slot = MessageSlot | GroupSlot;

/**
 * Group tool messages with the same tool name into collapsible slots,
 * skipping over "noise" messages (progress, checkpoints, api stats) in between.
 */
function groupRenderedMessages(
  messages: RawUiMessage[],
  htmls: string[],
): Slot[] {
  const slots: Slot[] = [];
  let i = 0;

  while (i < messages.length) {
    const info = parseToolInfo(messages[i]);
    if (!info) {
      if (htmls[i].length > 0) slots.push({ kind: "single", html: htmls[i] });
      i++;
      continue;
    }

    // Start a potential run of same-tool calls (allowing noise in between)
    const toolName = info.tool;
    const toolIndices: number[] = [i];
    const memberIndices: number[] = [i];
    const paths: string[] = info.path ? [info.path] : [];

    let j = i + 1;
    while (j < messages.length) {
      const nextInfo = parseToolInfo(messages[j]);
      if (nextInfo) {
        if (nextInfo.tool === toolName) {
          // Same tool — extend the run
          toolIndices.push(j);
          memberIndices.push(j);
          if (nextInfo.path) paths.push(nextInfo.path);
          j++;
        } else {
          // Different tool — end the run
          break;
        }
      } else if (TRANSPARENT_SUBTYPES.has(getSubtype(messages[j]))) {
        // Noise message — include in group but don't count as tool
        memberIndices.push(j);
        j++;
      } else {
        // Non-transparent, non-tool message — end the run
        break;
      }
    }

    if (toolIndices.length >= MIN_GROUP_SIZE) {
      slots.push({
        kind: "group",
        toolName,
        paths,
        memberIndices,
        toolIndices,
      });
      i = j;
    } else {
      // Too few — emit the first tool as a single, advance by one
      if (htmls[i].length > 0) slots.push({ kind: "single", html: htmls[i] });
      i++;
    }
  }

  return slots;
}

/** Render a grouped tool section as a collapsible summary */
function renderGroup(group: GroupSlot, htmls: string[]): string {
  const toolCount = group.toolIndices.length;
  const label =
    TOOL_GROUP_LABELS[group.toolName] ??
    `${group.toolName.replace(/([A-Z])/g, " $1").trim()}`;

  const pathList = group.paths.map((p) => escapeHtml(p));

  // Show paths as comma-separated list in summary (truncated if very long)
  const maxPathsInSummary = 8;
  const displayPaths = pathList.slice(0, maxPathsInSummary);
  const moreCount = pathList.length - maxPathsInSummary;
  const pathSummary =
    displayPaths.length > 0
      ? `<span class="group-paths">${displayPaths.join(", ")}${moreCount > 0 ? `, +${moreCount} more` : ""}</span>`
      : "";

  // Collect non-empty HTML from tool indices only (noise is absorbed into the group)
  const toolHtmlItems = group.toolIndices
    .map((idx) => htmls[idx])
    .filter((h) => h.length > 0);

  return (
    `<div class="message tool-group tool-call">` +
    `<details>` +
    `<summary class="group-summary">` +
    `<span class="tool-icon">🔧</span> ` +
    `<span class="group-label">${escapeHtml(label)}</span> ` +
    `<span class="group-count">(${toolCount})</span> ` +
    pathSummary +
    `</summary>` +
    `<div class="group-items">${toolHtmlItems.join("\n")}</div>` +
    `</details>` +
    `</div>`
  );
}

function renderSummaryHeader(conversation: ParsedConversation): string {
  const { summary } = conversation;

  return (
    `<header class="conversation-header">` +
    `<h1>Cline Conversation</h1>` +
    `<div class="summary-grid">` +
    `<div class="summary-item"><span class="label">Model</span><span class="value">${summary.modelId}</span></div>` +
    `<div class="summary-item"><span class="label">Provider</span><span class="value">${summary.providerId}</span></div>` +
    `<div class="summary-item"><span class="label">Started</span><span class="value">${formatTimestamp(summary.startTimestamp)}</span></div>` +
    `<div class="summary-item"><span class="label">Duration</span><span class="value">${formatDuration(summary.durationMs)}</span></div>` +
    `<div class="summary-item"><span class="label">Cost</span><span class="value">${formatCost(summary.totalCost)}</span></div>` +
    `<div class="summary-item"><span class="label">Tokens In</span><span class="value">${formatTokens(summary.totalTokensIn)}</span></div>` +
    `<div class="summary-item"><span class="label">Tokens Out</span><span class="value">${formatTokens(summary.totalTokensOut)}</span></div>` +
    `<div class="summary-item"><span class="label">API Requests</span><span class="value">${summary.apiRequestCount}</span></div>` +
    `</div>` +
    `</header>`
  );
}

export async function renderPage(
  conversation: ParsedConversation,
  outputDir: string,
): Promise<string> {
  const header = renderSummaryHeader(conversation);
  const rendered = await Promise.all(
    conversation.messages.map((msg) => renderMessage(msg, outputDir)),
  );

  // Group consecutive same-tool calls into collapsible summaries
  const slots = groupRenderedMessages(conversation.messages, rendered);
  const messagesHtml = slots
    .map((slot) =>
      slot.kind === "single" ? slot.html : renderGroup(slot, rendered),
    )
    .join("\n");

  const filterToolbar = `<div class="filter-toolbar">
      <span class="filter-label">Show:</span>
      <label class="filter-toggle"><input type="checkbox" data-filter="thinking"> Thinking</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="browser"> Browser</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="tools"> Tools</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="mcp"> MCP</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="commands"> Commands</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="progress"> Progress</label>
      <label class="filter-toggle"><input type="checkbox" data-filter="api"> API Stats</label>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cline Conversation — ${conversation.summary.modelId}</title>
  <link rel="stylesheet" href="style.css">
  <script src="script.js"></script>
</head>
<body class="hide-progress hide-commands hide-api">
  <div class="container">
    ${header}
    ${filterToolbar}
    <main class="conversation">
      ${messagesHtml}
    </main>
    <footer class="conversation-footer">
      <p>Exported with <a href="https://github.com/masto/cline-exporter">cline-exporter</a></p>
    </footer>
  </div>
</body>
</html>`;
}
