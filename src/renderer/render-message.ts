import type {
  ApiReqStartedData,
  ExportOptions,
  RawUiMessage,
} from "../types.js";
import {
  escapeHtml,
  formatCost,
  formatTimestamp,
  formatTokens,
} from "../utils/html.js";
import { extractDataUri, processImages } from "../utils/images.js";
import { renderMarkdown } from "../utils/markdown.js";

/** Regex to find data: image URIs embedded in text. */
const INLINE_DATA_URI_RE = /data:image\/\w+;base64,[^\s]+/g;

interface InlineImageResult {
  /** Text with data URIs stripped out and trimmed. */
  cleanedText: string;
  /** Relative paths to the extracted image files. */
  imagePaths: string[];
}

/**
 * Scan `text` for embedded base64 data URIs, extract each one to a file
 * in `outputDir/images/`, and return the leftover text plus image paths.
 */
async function extractInlineDataUris(
  text: string,
  outputDir: string,
): Promise<InlineImageResult> {
  const matches = text.match(INLINE_DATA_URI_RE);
  if (!matches) return { cleanedText: text, imagePaths: [] };

  const imagePaths: string[] = [];
  let cleaned = text;

  for (const dataUri of matches) {
    const extracted = await extractDataUri(dataUri, outputDir);
    if (extracted) {
      imagePaths.push(extracted.relativePath);
      cleaned = cleaned.replace(dataUri, "");
    }
  }

  return { cleanedText: cleaned.trim(), imagePaths };
}

interface ToolData {
  tool: string;
  path?: string;
  content?: string;
  operationIsLocatedInWorkspace?: boolean;
}

function sanitizePath(path: string, options: ExportOptions): string {
  if (!options.noFullPaths || !options.projectRoot) return path;
  const root = options.projectRoot;
  if (path === root) return ".";
  if (path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  return path;
}

function sanitizeTextPaths(text: string, options: ExportOptions): string {
  if (!options.noFullPaths || !options.projectRoot) return text;
  const root = options.projectRoot;
  return text.split(`${root}/`).join("").split(root).join(".");
}

function renderToolCall(text: string, options: ExportOptions): string {
  let data: ToolData;
  try {
    data = JSON.parse(text) as ToolData;
  } catch {
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
  const displayPath = data.path ? sanitizePath(data.path, options) : undefined;
  const pathHtml = data.path
    ? `<span class="tool-summary">${escapeHtml(displayPath ?? data.path)}</span>`
    : "";

  const hideContentForTool =
    options.noFileContents &&
    (toolName === "newFileCreated" || toolName === "editedExistingFile");

  const hasContent =
    !hideContentForTool && !!(data.content && data.content.length > 0);
  const contentPreview =
    hasContent && data.content
      ? data.content.length > 200
        ? data.content.slice(0, 200) + "…"
        : data.content
      : "";
  const sanitizedPreview = sanitizeTextPaths(contentPreview, options);
  const sanitizedContent = sanitizeTextPaths(data.content ?? "", options);

  return (
    `<div class="message tool-call">` +
    `<div class="tool-header">` +
    `<span class="tool-icon">🔧</span>` +
    `<span class="tool-name">${toolLabel}</span>` +
    pathHtml +
    `</div>` +
    (hasContent
      ? `<details class="tool-details">` +
        `<summary>${escapeHtml(sanitizedPreview)}</summary>` +
        `<pre class="tool-params"><code>${escapeHtml(sanitizedContent)}</code></pre>` +
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

function renderImageTags(imageSrcs: string[]): string {
  if (imageSrcs.length === 0) return "";
  const imgTags = imageSrcs
    .map(
      (src) =>
        `<div class="screenshot"><img src="${escapeHtml(src)}" alt="Screenshot" loading="lazy" /></div>`,
    )
    .join("");
  return `<div class="images">${imgTags}</div>`;
}

interface BrowserResultData {
  screenshot?: string;
  logs?: string;
  currentUrl?: string;
  currentMousePosition?: string;
}

/**
 * Extract screenshot from browser_action_result JSON text.
 * The text is JSON like: {"screenshot":"data:image/webp;base64,...","logs":"...","currentUrl":"..."}
 */
async function renderBrowserResult(
  text: string,
  images: string[],
  outputDir: string,
  ts: number,
): Promise<string> {
  let screenshotSrc = "";
  let logs = "";
  let currentUrl = "";

  // Try to parse as JSON to extract screenshot
  try {
    const data = JSON.parse(text) as BrowserResultData;
    if (data.screenshot) {
      const extracted = await extractDataUri(data.screenshot, outputDir);
      screenshotSrc = extracted ? extracted.relativePath : data.screenshot;
    }
    logs = data.logs ?? "";
    currentUrl = data.currentUrl ?? "";
  } catch {
    // Not JSON — fall through to show as text
  }

  // Also process any images from the images array
  const processedImages = await processImages(images, outputDir);

  const allImages = screenshotSrc
    ? [screenshotSrc, ...processedImages]
    : processedImages;

  const metaParts: string[] = [];
  if (currentUrl) metaParts.push(`URL: ${escapeHtml(currentUrl)}`);

  return (
    `<div class="message browser-result" data-ts="${ts}">` +
    `<div class="browser-header"><span class="browser-icon">🌐</span> Browser Result</div>` +
    (metaParts.length > 0
      ? `<div class="browser-meta">${metaParts.join(" · ")}</div>`
      : "") +
    renderImageTags(allImages) +
    (logs
      ? `<details class="tool-details"><summary>Console Logs</summary>` +
        `<pre class="output-text"><code>${escapeHtml(logs)}</code></pre></details>`
      : "") +
    `</div>`
  );
}

export async function renderMessage(
  message: RawUiMessage,
  outputDir: string,
  options: ExportOptions,
): Promise<string> {
  const text = message.text ?? "";
  const images = message.images ?? [];
  const subtype = message.say ?? message.ask ?? "unknown";
  const timestamp = formatTimestamp(message.ts);

  switch (subtype) {
    case "task": {
      const processedImages = await processImages(images, outputDir);
      return (
        `<div class="message user-task" data-ts="${message.ts}">` +
        `<div class="message-header"><span class="role">User</span><time>${timestamp}</time></div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImageTags(processedImages) +
        `</div>`
      );
    }

    case "user_feedback": {
      const processedImages = await processImages(images, outputDir);
      return (
        `<div class="message user-feedback" data-ts="${message.ts}">` +
        `<div class="message-header"><span class="role">User</span><time>${timestamp}</time></div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImageTags(processedImages) +
        `</div>`
      );
    }

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
      return renderToolCall(text, options);

    case "command": {
      if (options.noCommands) return "";
      const cmdIcon = message.type === "ask" ? "❯" : "❯";
      return (
        `<div class="message command" data-ts="${message.ts}">` +
        `<div class="command-header"><span class="cmd-icon">${cmdIcon}</span> Command</div>` +
        `<pre class="command-text"><code>${escapeHtml(text)}</code></pre>` +
        `</div>`
      );
    }

    case "command_output":
      if (options.noCommands) return "";
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
    case "browser_action_launch": {
      const processedImages = await processImages(images, outputDir);
      return (
        `<div class="message browser-action" data-ts="${message.ts}">` +
        `<div class="browser-header"><span class="browser-icon">🌐</span> Browser Action</div>` +
        `<div class="message-body">${renderMarkdown(text)}</div>` +
        renderImageTags(processedImages) +
        `</div>`
      );
    }

    case "browser_action_result":
      return renderBrowserResult(text, images, outputDir, message.ts);

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

    default: {
      if (!text && images.length === 0) return "";
      const { cleanedText, imagePaths } = await extractInlineDataUris(
        text,
        outputDir,
      );
      const processedImages = await processImages(images, outputDir);
      const allImages = [...imagePaths, ...processedImages];

      const COLLAPSE_THRESHOLD = 300;
      let textHtml = "";
      if (cleanedText) {
        if (cleanedText.length > COLLAPSE_THRESHOLD) {
          const preview = cleanedText.slice(0, 120) + "…";
          textHtml =
            `<details class="tool-details">` +
            `<summary>${escapeHtml(preview)}</summary>` +
            `<pre class="tool-params"><code>${escapeHtml(cleanedText)}</code></pre>` +
            `</details>`;
        } else {
          textHtml = `<div class="message-body">${escapeHtml(cleanedText)}</div>`;
        }
      }

      return (
        `<div class="message generic" data-ts="${message.ts}">` +
        textHtml +
        renderImageTags(allImages) +
        `</div>`
      );
    }
  }
}
