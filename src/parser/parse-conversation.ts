import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ApiReqStartedData,
  ConversationSummary,
  ParsedConversation,
  RawApiMessage,
  RawTaskMetadata,
  RawUiMessage,
} from "../types.js";

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return await readJsonFile<T>(filePath);
  } catch {
    return null;
  }
}

function parseApiReqText(text: string | undefined): ApiReqStartedData {
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiReqStartedData;
  } catch {
    return {};
  }
}

function buildSummary(
  messages: RawUiMessage[],
  apiMessages: RawApiMessage[],
): ConversationSummary {
  // Find task text (first "say"/"task" message)
  const taskMessage = messages.find(
    (m) => m.type === "say" && m.say === "task",
  );
  const taskPreview = taskMessage?.text?.slice(0, 200) ?? "";

  // Find model info from first message that has it, or from api messages
  const modelInfoSource =
    messages.find((m) => m.modelInfo)?.modelInfo ??
    apiMessages.find((m) => m.modelInfo)?.modelInfo;

  const modelId = modelInfoSource?.modelId ?? "unknown";
  const providerId = modelInfoSource?.providerId ?? "unknown";
  const mode = modelInfoSource?.mode ?? "unknown";

  // Aggregate costs and tokens from api_req_started messages
  let totalCost = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCacheReads = 0;
  let totalCacheWrites = 0;
  let apiRequestCount = 0;

  for (const msg of messages) {
    if (msg.type === "say" && msg.say === "api_req_started") {
      apiRequestCount++;
      const data = parseApiReqText(msg.text);
      totalCost += data.cost ?? 0;
      totalTokensIn += data.tokensIn ?? 0;
      totalTokensOut += data.tokensOut ?? 0;
      totalCacheReads += data.cacheReads ?? 0;
      totalCacheWrites += data.cacheWrites ?? 0;
    }
  }

  // Timestamps — find the last "meaningful" message to avoid inflated duration
  // from resume_completed_task entries added days later
  const NOISE_SUBTYPES = new Set([
    "resume_completed_task",
    "resume_task",
    "task_progress",
    "checkpoint_created",
    "api_req_started",
  ]);

  const startTimestamp = messages[0].ts;

  // Walk backwards to find the last meaningful message
  let endTimestamp = messages[messages.length - 1].ts;
  for (let i = messages.length - 1; i >= 0; i--) {
    const subtype = messages[i].say ?? messages[i].ask ?? "unknown";
    if (!NOISE_SUBTYPES.has(subtype)) {
      endTimestamp = messages[i].ts;
      break;
    }
  }

  const durationMs = endTimestamp - startTimestamp;

  return {
    taskPreview,
    modelId,
    providerId,
    mode,
    totalCost,
    totalTokensIn,
    totalTokensOut,
    totalCacheReads,
    totalCacheWrites,
    startTimestamp,
    endTimestamp,
    durationMs,
    messageCount: messages.length,
    apiRequestCount,
  };
}

export async function parseConversation(
  conversationDir: string,
): Promise<ParsedConversation> {
  const uiMessagesPath = join(conversationDir, "ui_messages.json");
  const apiHistoryPath = join(conversationDir, "api_conversation_history.json");
  const metadataPath = join(conversationDir, "task_metadata.json");

  // ui_messages.json is required
  let messages: RawUiMessage[];
  try {
    messages = await readJsonFile<RawUiMessage[]>(uiMessagesPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read ui_messages.json: ${message}. ` +
        `Make sure "${conversationDir}" is a valid Cline conversation directory.`,
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(
      `ui_messages.json is empty or not an array in "${conversationDir}".`,
    );
  }

  // api_conversation_history.json and task_metadata.json are optional
  const apiMessages =
    (await readOptionalJsonFile<RawApiMessage[]>(apiHistoryPath)) ?? [];
  const metadata = await readOptionalJsonFile<RawTaskMetadata>(metadataPath);

  const summary = buildSummary(messages, apiMessages);

  return {
    messages,
    apiMessages,
    metadata,
    summary,
  };
}
