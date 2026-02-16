import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConversation } from "./parser/index.js";
import { renderPage } from "./renderer/index.js";
import type { ExportOptions, ParsedConversation } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  conversationDir: string;
  outputDir: string;
  options: ExportOptions;
}

function getCommonPathPrefix(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const splitPaths = paths.map((p) =>
    p.split("/").filter((part) => part.length),
  );
  if (splitPaths.length === 0) return null;

  const first = splitPaths[0];
  let commonLength = first.length;

  for (let i = 1; i < splitPaths.length; i++) {
    const current = splitPaths[i];
    let j = 0;
    while (j < commonLength && j < current.length && current[j] === first[j]) {
      j++;
    }
    commonLength = j;
    if (commonLength === 0) return null;
  }

  return `/${first.slice(0, commonLength).join("/")}`;
}

function deriveProjectRoot(conversation: ParsedConversation): string | null {
  const metadataPaths =
    conversation.metadata?.files_in_context
      .map((f) => f.path)
      .filter((p) => p.startsWith("/")) ?? [];

  const toolPaths = conversation.messages
    .filter((m) => m.say === "tool" && m.text)
    .map((m) => {
      try {
        const parsed = JSON.parse(m.text ?? "") as { path?: string };
        return parsed.path ?? "";
      } catch {
        return "";
      }
    })
    .filter((p) => p.startsWith("/"));

  const paths = [...metadataPaths, ...toolPaths];
  return getCommonPathPrefix(paths);
}

function printUsage(): void {
  console.log(`
Usage: cline-exporter <conversation-dir> [options]

Arguments:
  conversation-dir    Path to a Cline conversation folder
                      (containing ui_messages.json)

Options:
  --output, -o <dir>  Output directory (default: ./cline-export-output)
  --no-commands       Omit command and command output messages
  --no-full-paths     Strip absolute project root from file paths
  --no-file-contents  Hide file contents for create/edit tool calls
  --help, -h          Show this help message
`);
}

function parseArgs(argv: string[]): CliArgs | null {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    return null;
  }

  let conversationDir = "";
  let outputDir = "./cline-export-output";
  const options: ExportOptions = {
    noCommands: false,
    noFullPaths: false,
    noFileContents: false,
    projectRoot: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      i++;
      const next = args[i];
      if (!next) {
        console.error("Error: --output requires a directory path");
        process.exit(1);
      }
      outputDir = next;
    } else if (arg === "--no-commands") {
      options.noCommands = true;
    } else if (arg === "--no-full-paths") {
      options.noFullPaths = true;
    } else if (arg === "--no-file-contents") {
      options.noFileContents = true;
    } else if (!arg.startsWith("-")) {
      conversationDir = arg;
    } else {
      console.error(`Error: Unknown option "${arg}"`);
      printUsage();
      process.exit(1);
    }
  }

  if (!conversationDir) {
    console.error("Error: conversation directory is required");
    printUsage();
    process.exit(1);
  }

  return {
    conversationDir: resolve(conversationDir),
    outputDir: resolve(outputDir),
    options,
  };
}

function getTemplatesDir(): string {
  // In development (ts source), templates are at src/templates/
  // In built output (dist/), templates are bundled — we need to resolve from the package
  const srcTemplates = join(__dirname, "templates");
  const devTemplates = join(__dirname, "..", "src", "templates");

  // Try both locations
  return srcTemplates.includes("src") ? srcTemplates : devTemplates;
}

async function copyTemplateFile(
  templatesDir: string,
  outputDir: string,
  filename: string,
): Promise<void> {
  const src = join(templatesDir, filename);
  const dest = join(outputDir, filename);
  await copyFile(src, dest);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  if (!args) {
    process.exit(0);
  }

  const { conversationDir, outputDir, options } = args;

  console.log(`📂 Reading conversation from: ${conversationDir}`);

  // Parse the conversation
  const conversation = await parseConversation(conversationDir);
  console.log(
    `✅ Parsed ${conversation.summary.messageCount} messages (${conversation.summary.apiRequestCount} API requests)`,
  );

  if (options.noFullPaths) {
    options.projectRoot = deriveProjectRoot(conversation);
  }

  // Create output directory (needed before rendering, since images are extracted during render)
  await mkdir(outputDir, { recursive: true });

  // Render the HTML (this also extracts images to outputDir/images/)
  const { resetImageCounter } = await import("./utils/images.js");
  resetImageCounter();
  const html = await renderPage(conversation, outputDir, options);

  // Write HTML
  await writeFile(join(outputDir, "index.html"), html, "utf-8");

  // Copy static assets
  const templatesDir = getTemplatesDir();
  await copyTemplateFile(templatesDir, outputDir, "style.css");
  await copyTemplateFile(templatesDir, outputDir, "script.js");

  console.log(`\n🎉 Export complete!`);
  console.log(`   Output: ${outputDir}`);
  console.log(`   Open ${join(outputDir, "index.html")} in your browser.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Error: ${message}`);
  process.exit(1);
});
