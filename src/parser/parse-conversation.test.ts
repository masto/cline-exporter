import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseConversation } from "./parse-conversation.js";

const SAMPLE_DIR = join(
  __dirname,
  "..",
  "..",
  "sample-conversations",
  "1771088413059",
);

const hasSampleData = existsSync(join(SAMPLE_DIR, "ui_messages.json"));

// Minimal synthetic fixture for tests that don't need real data
const SYNTHETIC_DIR = join(
  __dirname,
  "..",
  "..",
  "test-output",
  "test-fixture",
);

function createSyntheticFixture(): void {
  mkdirSync(SYNTHETIC_DIR, { recursive: true });
  const messages = [
    {
      ts: 1700000000000,
      type: "say",
      say: "task",
      text: "Build a hello world app",
      images: [],
    },
    {
      ts: 1700000010000,
      type: "say",
      say: "api_req_started",
      text: JSON.stringify({
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      }),
    },
    {
      ts: 1700000020000,
      type: "say",
      say: "text",
      text: "I'll create a hello world app for you.",
    },
    {
      ts: 1700000030000,
      type: "say",
      say: "tool",
      text: JSON.stringify({ tool: "newFileCreated", path: "hello.ts" }),
    },
    {
      ts: 1700000040000,
      type: "say",
      say: "completion_result",
      text: "Done! The app is ready.",
    },
  ];
  writeFileSync(
    join(SYNTHETIC_DIR, "ui_messages.json"),
    JSON.stringify(messages),
  );
  writeFileSync(
    join(SYNTHETIC_DIR, "api_conversation_history.json"),
    JSON.stringify([
      {
        role: "user",
        content: [{ type: "text", text: "Build a hello world app" }],
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Sure!" }],
        modelInfo: {
          modelId: "test-model",
          providerId: "test-provider",
          mode: "code",
        },
        metrics: {
          inputTokens: 100,
          outputTokens: 50,
          totalCost: 0.01,
        },
      },
    ]),
  );
}

createSyntheticFixture();

afterAll(() => {
  // Clean up is handled by test-output being gitignored
});

describe("parseConversation", () => {
  it("parses a conversation successfully", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);

    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBe(5);
    expect(result.apiMessages).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it("extracts message count", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.messageCount).toBe(5);
  });

  it("extracts API request count", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.apiRequestCount).toBe(1);
  });

  it("extracts model info", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.modelId).toBe("test-model");
    expect(result.summary.providerId).toBe("test-provider");
  });

  it("calculates total cost", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.totalCost).toBeCloseTo(0.01);
  });

  it("calculates timestamps and duration", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.startTimestamp).toBe(1700000000000);
    expect(result.summary.endTimestamp).toBe(1700000040000);
    expect(result.summary.durationMs).toBe(40000);
  });

  it("finds the task text", async () => {
    const result = await parseConversation(SYNTHETIC_DIR);
    expect(result.summary.taskPreview).toBe("Build a hello world app");
  });

  it("throws on non-existent directory", async () => {
    await expect(
      parseConversation("/tmp/nonexistent-dir-12345"),
    ).rejects.toThrow("Failed to read ui_messages.json");
  });
});

describe("parseConversation (sample data)", () => {
  it.skipIf(!hasSampleData)("parses the full sample conversation", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.messageCount).toBe(560);
    expect(result.summary.apiRequestCount).toBe(59);
    expect(result.summary.modelId).toContain("claude");
    expect(result.metadata).not.toBeNull();
  });
});
