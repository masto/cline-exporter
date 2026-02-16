import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    // Copy static template files to dist/templates/
    const templatesDir = join("dist", "templates");
    mkdirSync(templatesDir, { recursive: true });
    copyFileSync(
      join("src", "templates", "style.css"),
      join(templatesDir, "style.css"),
    );
    copyFileSync(
      join("src", "templates", "script.js"),
      join(templatesDir, "script.js"),
    );
    console.log("✅ Copied template files to dist/templates/");
  },
});
