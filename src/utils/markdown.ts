import hljs from "highlight.js";
import { Marked } from "marked";
import { escapeHtml } from "./html.js";

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language }).value;
      return (
        `<div class="code-block">` +
        `<div class="code-header">` +
        `<span class="code-lang">${escapeHtml(language)}</span>` +
        `<button class="copy-btn" data-code="${escapeHtml(text)}">Copy</button>` +
        `</div>` +
        `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>` +
        `</div>`
      );
    },
  },
});

/** Render markdown text to HTML with syntax-highlighted code blocks. */
export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}
