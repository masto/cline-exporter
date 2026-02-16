import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConversation } from "./parse-conversation.js";

const SAMPLE_DIR = join(
  __dirname,
  "..",
  "..",
  "sample-conversations",
  "1771088413059",
);

describe("parseConversation", () => {
  it("parses the sample conversation successfully", async () => {
    const result = await parseConversation(SAMPLE_DIR);

    expect(result.messages).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.apiMessages).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it("extracts correct message count", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.messageCount).toBe(560);
  });

  it("extracts correct API request count", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.apiRequestCount).toBe(59);
  });

  it("extracts model info", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.modelId).toContain("claude");
    expect(result.summary.providerId).toBe("cline");
  });

  it("calculates total cost", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.totalCost).toBeGreaterThan(0);
  });

  it("calculates timestamps and duration", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.startTimestamp).toBeGreaterThan(0);
    expect(result.summary.endTimestamp).toBeGreaterThan(
      result.summary.startTimestamp,
    );
    expect(result.summary.durationMs).toBeGreaterThan(0);
  });

  it("finds the task text", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.summary.taskPreview.length).toBeGreaterThan(0);
  });

  it("loads metadata when available", async () => {
    const result = await parseConversation(SAMPLE_DIR);
    expect(result.metadata).not.toBeNull();
    expect(result.metadata?.files_in_context).toBeDefined();
  });

  it("throws on non-existent directory", async () => {
    await expect(
      parseConversation("/tmp/nonexistent-dir-12345"),
    ).rejects.toThrow("Failed to read ui_messages.json");
  });
});
