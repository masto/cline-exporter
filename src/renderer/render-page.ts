import type { ParsedConversation } from "../types.js";
import {
  formatCost,
  formatDuration,
  formatTimestamp,
  formatTokens,
} from "../utils/html.js";
import { renderMessage } from "./render-message.js";

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
  const messagesHtml = rendered.filter((html) => html.length > 0).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cline Conversation — ${conversation.summary.modelId}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    ${header}
    <main class="conversation">
      ${messagesHtml}
    </main>
    <footer class="conversation-footer">
      <p>Exported with <a href="https://github.com/cline/cline-exporter">cline-exporter</a></p>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`;
}
