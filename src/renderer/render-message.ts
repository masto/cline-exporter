import type { ApiReqStartedData, RawUiMessage } from "../types.js";
import {
  escapeHtml,
  formatCost,
  formatTimestamp,
  formatTokens,
} from "../utils/html.js";
import { renderMarkdown } from "../utils/markdown.js";

interface ToolData {
  tool: string;
  path?: string;
  content?: string;
  operationIsLocatedInWorkspace?: boolean;
}

function renderToolCall(text: string): string {
  let data: ToolData;
  try {
    data = JSON.parse(text) as ToolData;
  } catch {
    // Fallback: if not JSON, show raw
    return (
      `<div class="message tool-call">` +
      `<div class="tool-header"><span class="tool-icon">🔧</span><span class="tool-name">Tool</span></div>` +
      `<details class="tool-details"><summary>Details</summary>` +
      `<pre class="tool-params"><code>${escapeHtml(text)}</code></pre>` +
      `</details></div>`
    );
  }

  const toolName = data.tool ?? "unknown";
  const toolLabel = escapeHtml(toolName.replace(/([A-Z])/g, " $1").trim());
  const pathHtml = data.path
    ? `<span class="tool-summary">${escapeHtml(data.path)}</span>`
    : "";

  // For file operations, show the content in a collapsible details
  const hasContent = data.content && data.content.length > 0;
  const contentPreview =
    hasContent && data.content
      ? data.content.length > 200
        ? data.content.slice(0, 200) + "…"
        : data.content
      : "";

  return (
    `<div class="message tool-call">` +
    `<div class="tool-header">` +
    `<span class="tool-icon">🔧</span>` +
    `<span class="tool-name">${toolLabel}</span>` +
    pathHtml +
    `</div>` +
    (hasContent
      ? `<details class="tool-details">` +
        `<summary>${escapeHtml(contentPreview)}</summary>` +
        `<pre class="tool-params"><code>${escapeHtml(data.content ?? "")}</code></pre>` +
        `</details>`
      : "") +
    `</div>`
  );
}

interface McpData {
  type?: string;
  serverName?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
}

function renderMcpAction(text: string): string {
  let data: McpData;
  try {
    data = JSON.parse(text) as McpData;
  } catch {
    return (
      `<div class="message mcp-action">` +
      `<div class="mcp-header"><span class="mcp-icon">🔌</span> MCP Server</div>` +
      (text ? `<div class="message-body">${renderMarkdown(text)}</div>` : "") +
      `</div>`
    );
  }

  const toolName = data.toolName ?? "unknown";
  const serverName = data.serverName ?? "";
  const argsStr = data.arguments ? JSON.stringify(data.arguments, null, 2) : "";

  return (
    `<div class="message mcp-action">` +
    `<div class="mcp-header"><span class="mcp-icon">🔌</span> MCP: <span class="tool-name">${escapeHtml(toolName)}</span></div>` +
    (serverName
      ? `<div class="mcp-server-name">Server: ${escapeHtml(serverName)}</div>`
      : "") +
    (argsStr
      ? `<details class="tool-details"><summary>Arguments</summary>` +
        `<pre class="tool-params"><code>${escapeHtml(argsStr)}</code></pre>` +
        `</details>`
      : "") +
    `</div>`
  );
}

interface PlanModeData {
  response?: string;
  options?: string[];
}

function renderPlanMode(text: string): string {
  let content = text;
  try {
    const data = JSON.parse(text) as PlanModeData;
    if (data.response) {
      content = data.response;
    }
  } catch {
    // Not JSON, use as-is
  }

  return (
    `<div class="message plan-mode">` +
    `<div class="message-body">${renderMarkdown(content)}</div>` +
    `</div>`
  );
}

function renderApiReqStarted(text: string): string {
  let data: ApiReqStartedData = {};
  try {
    data = JSON.parse(text) as ApiReqStartedData;
  } catch {
    return "";
  }

  // Only show if there's meaningful cost/token data
  if (!data.cost && !data.tokensIn && !data.tokensOut) {
    return `<div class="message api-request"><span class="api-icon">⚡</span> API Request</div>`;
  }

  const parts: string[] = [];
  if (data.tokensIn) parts.push(`↓ ${formatTokens(data.tokensIn)}`);
  if (data.tokensOut) parts.push(`↑ ${formatTokens(data.tokensOut)}`);
  if (data.cacheReads) parts.push(`cache: ${formatTokens(data.cacheReads)}`);
  if (data.cost) parts.push(formatCost(data.cost));

  const cancelInfo = data.cancelReason
    ? ` <span class="cancel-reason">(${escapeHtml(data.cancelReason)})</span>`
    : "";

  return (
    `<div class="message api-request">` +
    `<span class="api-icon">⚡</span> ` +
    `<span class="api-stats">${parts.join(" · ")}</span>` +
    cancelInfo +
    `</div>`
  );
}

function renderImages(images: string[]): string {
  if (images.length === 0) return "";
  const imgTags = images
    .map(
      (src) =>
        `<div class="screenshot"><img src="${escapeHtml(src)}" alt="Screenshot" loading="lazy" /></div>`,
    )
    .join("");
  return `<div class="images">${imgTags}</div>`;
}

export function renderMessage(message: RawUiMessage): string {
  const text = message.text ?? "";
  const images = message.images ?? [];
  const subtype = message.say ?? message.ask ?? "unknown";
  const timestamp = formatTimestamp(message.ts);

  switch (subtype) {
    case "task":
      return (
        `<div class="message user-task" data-ts="${message.ts}">` +
        `<div class="message-header"><span class="role">User</span><time>${timestamp}</time></div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImages(images) +
        `</div>`
      );

    case "user_feedback":
      return (
        `<div class="message user-feedback" data-ts="${message.ts}">` +
        `<div class="message-header"><span class="role">User</span><time>${timestamp}</time></div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImages(images) +
        `</div>`
      );

    case "text":
      if (message.type === "say") {
        return (
          `<div class="message assistant-text" data-ts="${message.ts}">` +
          `<div class="message-body">${renderMarkdown(text)}</div>` +
          `</div>`
        );
      }
      return "";

    case "reasoning":
      if (!text) return "";
      return (
        `<div class="message reasoning" data-ts="${message.ts}">` +
        `<details>` +
        `<summary><span class="reasoning-icon">💭</span> Thinking</summary>` +
        `<div class="reasoning-body">${renderMarkdown(text)}</div>` +
        `</details>` +
        `</div>`
      );

    case "tool":
      return renderToolCall(text);

    case "command": {
      // command can be either say or ask type
      const cmdIcon = message.type === "ask" ? "❯" : "❯";
      return (
        `<div class="message command" data-ts="${message.ts}">` +
        `<div class="command-header"><span class="cmd-icon">${cmdIcon}</span> Command</div>` +
        `<pre class="command-text"><code>${escapeHtml(text)}</code></pre>` +
        `</div>`
      );
    }

    case "command_output":
      if (!text) return "";
      return (
        `<div class="message command-output" data-ts="${message.ts}">` +
        `<details>` +
        `<summary>Command Output</summary>` +
        `<pre class="output-text"><code>${escapeHtml(text)}</code></pre>` +
        `</details>` +
        `</div>`
      );

    case "completion_result":
      return (
        `<div class="message completion-result" data-ts="${message.ts}">` +
        `<div class="completion-header">✅ Task Complete</div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        `</div>`
      );

    case "api_req_started":
      return renderApiReqStarted(text);

    case "browser_action":
    case "browser_action_launch":
      return (
        `<div class="message browser-action" data-ts="${message.ts}">` +
        `<div class="browser-header"><span class="browser-icon">🌐</span> Browser Action</div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImages(images) +
        `</div>`
      );

    case "browser_action_result":
      return (
        `<div class="message browser-result" data-ts="${message.ts}">` +
        `<div class="browser-header"><span class="browser-icon">🌐</span> Browser Result</div>` +
        (text
          ? `<div class="message-body">${renderMarkdown(text)}</div>`
          : "") +
        renderImages(images) +
        `</div>`
      );

    case "mcp_server_request_started":
    case "use_mcp_server":
      return renderMcpAction(text);

    case "task_progress":
      if (!text) return "";
      return (
        `<div class="message task-progress" data-ts="${message.ts}">` +
        `<div class="progress-header">📋 Progress</div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        `</div>`
      );

    case "checkpoint_created":
      return `<div class="message checkpoint" data-ts="${message.ts}"><span class="checkpoint-icon">💾</span> Checkpoint created</div>`;

    case "plan_mode_respond":
      return renderPlanMode(text);

    case "resume_completed_task":
    case "resume_task":
      return `<div class="message resume" data-ts="${message.ts}"><span class="resume-icon">▶️</span> Task resumed</div>`;

    default:
      if (!text && images.length === 0) return "";
      return (
        `<div class="message generic" data-ts="${message.ts}">` +
        (text ? `<div class="message-body">${escapeHtml(text)}</div>` : "") +
        renderImages(images) +
        `</div>`
      );
  }
}
