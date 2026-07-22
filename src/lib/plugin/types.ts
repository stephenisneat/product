export type PluginTagType = "pixel" | "script" | "custom_html" | "builtin";

export type PluginTriggerType =
  | "pageview"
  | "click"
  | "custom_event"
  | "timer"
  | "scroll_depth"
  | "form_submit"
  | "element_visible";

export type PluginVariableType =
  | "constant"
  | "data_layer"
  | "cookie"
  | "dom_element"
  | "javascript"
  | "url_parameter"
  | "builtin";

export type PluginConsentCategory =
  | "necessary"
  | "analytics"
  | "marketing"
  | "preferences";

export type PluginContainer = {
  id: string;
  workspace_id: string;
  published_version: number;
  draft_version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PluginTag = {
  id: string;
  container_id: string;
  name: string;
  type: PluginTagType;
  config: Record<string, unknown>;
  trigger_ids: string[];
  priority: number;
  enabled: boolean;
  consent_category: PluginConsentCategory;
  rate_limit_exempt: boolean;
  created_at: string;
  updated_at: string;
};

export type PluginTrigger = {
  id: string;
  container_id: string;
  name: string;
  type: PluginTriggerType;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PluginVariable = {
  id: string;
  container_id: string;
  name: string;
  type: PluginVariableType;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PluginVersionSummary = {
  id: string;
  version: number;
  notes: string | null;
  published_by: string | null;
  created_at: string;
};

export type PluginContainerPayload = {
  container: PluginContainer;
  tags: PluginTag[];
  triggers: PluginTrigger[];
  variables: PluginVariable[];
  versions: PluginVersionSummary[];
  installSnippet: string;
};

export type PluginInstallStatus = {
  has_ever_received: boolean;
  last_event_at: string | null;
  last_event_type: string | null;
  last_event_name: string | null;
  last_hour_count: number;
  last_day_count: number;
  primary_domain: string | null;
  detected_provider: string | null;
};

export type PluginPingResult = {
  ok: boolean;
  script_reachable: boolean;
  container_reachable: boolean;
  container_version: number | null;
  status: PluginInstallStatus;
  error?: string;
};
