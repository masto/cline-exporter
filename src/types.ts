// ─── Raw Input Types (matching Cline's JSON structure) ───

export type SaySubtype =
  | "task"
  | "text"
  | "user_feedback"
  | "reasoning"
  | "tool"
  | "command"
  | "command_output"
  | "completion_result"
  | "api_req_started"
  | "browser_action"
  | "browser_action_launch"
  | "browser_action_result"
  | "checkpoint_created"
  | "mcp_server_request_started"
  | "use_mcp_server"
  | "task_progress";

export type AskSubtype =
  | "command"
  | "command_output"
  | "completion_result"
  | "plan_mode_respond"
  | "resume_completed_task"
  | "resume_task";

export interface ModelInfo {
  providerId: string;
  modelId: string;
  mode: string;
}

export interface RawUiMessage {
  ts: number;
  type: "say" | "ask";
  say?: SaySubtype;
  ask?: AskSubtype;
  text?: string;
  images?: string[];
  files?: string[];
  modelInfo?: ModelInfo;
  conversationHistoryIndex?: number;
}

export interface ApiReqStartedData {
  request?: string;
  tokensIn?: number;
  tokensOut?: number;
  cacheWrites?: number;
  cacheReads?: number;
  cost?: number;
  cancelReason?: string;
  streamingFailedMessage?: string;
}

export interface ApiContentBlock {
  type: "text" | "thinking" | "tool_use" | "image" | "tool_result";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  source?: { type: string; media_type: string; data: string };
  content?: string | ApiContentBlock[];
  // tool_use fields
  tool_use_id?: string;
  is_error?: boolean;
}

export interface ApiMetrics {
  tokensIn?: number;
  tokensOut?: number;
  cacheReads?: number;
  cacheWrites?: number;
  cost?: number;
}

export interface RawApiMessage {
  role: "user" | "assistant";
  content: ApiContentBlock[];
  modelInfo?: ModelInfo;
  metrics?: ApiMetrics;
}

export interface FileInContext {
  path: string;
  record_state: "active" | "stale";
  record_source: "cline_edited" | "user_edited";
  cline_read_date: number | null;
  cline_edit_date: number | null;
  user_edit_date: number | null;
}

export interface ModelUsageEntry {
  ts: number;
  model_id: string;
  model_provider_id: string;
  mode: string;
}

export interface RawTaskMetadata {
  files_in_context: FileInContext[];
  model_usage: ModelUsageEntry[];
  environment_history: unknown[];
}

// ─── Parsed / Normalized Types ───

export interface ConversationSummary {
  taskPreview: string;
  modelId: string;
  providerId: string;
  mode: string;
  totalCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCacheReads: number;
  totalCacheWrites: number;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: number;
  messageCount: number;
  apiRequestCount: number;
}

export interface ParsedConversation {
  messages: RawUiMessage[];
  apiMessages: RawApiMessage[];
  metadata: RawTaskMetadata | null;
  summary: ConversationSummary;
}
