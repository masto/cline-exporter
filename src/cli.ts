import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConversation } from "./parser/index.js";
import { renderPage } from "./renderer/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  conversationDir: string;
  outputDir: string;
}

function printUsage(): void {
  console.log(`
Usage: cline-export <conversation-dir> [options]

Arguments:
  conversation-dir    Path to a Cline conversation folder
                      (containing ui_messages.json)

Options:
  --output, -o <dir>  Output directory (default: ./cline-export-output)
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

  const { conversationDir, outputDir } = args;

  console.log(`📂 Reading conversation from: ${conversationDir}`);

  // Parse the conversation
  const conversation = await parseConversation(conversationDir);
  console.log(
    `✅ Parsed ${conversation.summary.messageCount} messages (${conversation.summary.apiRequestCount} API requests)`,
  );

  // Render the HTML
  const html = renderPage(conversation);

  // Create output directory
  await mkdir(outputDir, { recursive: true });

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
