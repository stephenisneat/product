"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Code2Icon, PlusIcon, ShieldIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { InstallPanel } from "@/features/plugin/install-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Container {
  id: string;
  workspace_id: string;
  published_version: number;
  draft_version: number;
  published_at: string | null;
  updated_at: string;
}

interface Tag {
  id: string;
  container_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  trigger_ids: string[];
  priority: number;
  enabled: boolean;
  consent_category: string;
  rate_limit_exempt: boolean;
}

interface Trigger {
  id: string;
  container_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
}

interface Variable {
  id: string;
  container_id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
}

interface Version {
  id: string;
  version: number;
  notes: string | null;
  published_by: string;
  created_at: string;
}

type Section = "tags" | "triggers" | "variables" | "versions";

// ─── Constants ───────────────────────────────────────────────────────────────

const TAG_TYPES = ["pixel", "script", "custom_html", "builtin"] as const;
const TRIGGER_TYPES = [
  "pageview",
  "click",
  "form_submit",
  "element_visible",
  "custom_event",
  "timer",
  "scroll_depth",
] as const;
const VARIABLE_TYPES = [
  "constant",
  "data_layer",
  "cookie",
  "dom_element",
  "javascript",
  "url_parameter",
  "builtin",
] as const;
const CONSENT_CATEGORIES = ["necessary", "analytics", "marketing", "preferences"] as const;
const BUILTIN_TRACKERS = ["pageview"] as const;

// ─── Small helpers ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted capitalize">
      {type.replace(/_/g, " ")}
    </span>
  );
}

function SectionLabel({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <SectionLabel label={label} />
      {children}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Config field renderers ───────────────────────────────────────────────────

function TagConfigFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (type === "pixel") {
    return (
      <Field label="Pixel URL">
        <Input
          value={(config.url as string) || ""}
          onChange={(e) => onChange("url", e.target.value)}
          placeholder="https://example.com/pixel.gif"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "script") {
    return (
      <Field label="Script source URL">
        <Input
          value={(config.src as string) || ""}
          onChange={(e) => onChange("src", e.target.value)}
          placeholder="https://example.com/script.js"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "custom_html") {
    return (
      <Field label="HTML / code">
        <Textarea
          value={(config.html as string) || ""}
          onChange={(e) => onChange("html", e.target.value)}
          placeholder="<script>...</script>"
          className="min-h-[120px] font-mono text-sm"
        />
      </Field>
    );
  }
  if (type === "builtin") {
    return (
      <Field label="Tracker">
        <Select
          value={(config.tracker as string) || ""}
          onValueChange={(v) => onChange("tracker", v)}
        >
          <SelectTrigger className="w-full text-sm">
            <SelectValue placeholder="Select tracker…" />
          </SelectTrigger>
          <SelectContent>
            {BUILTIN_TRACKERS.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  return null;
}

function TriggerConfigFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (type === "pageview") {
    return (
      <Field label="URL pattern (blank = all pages)">
        <Input
          value={(config.url_pattern as string) || ""}
          onChange={(e) => onChange("url_pattern", e.target.value)}
          placeholder="/checkout/**"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "click" || type === "form_submit" || type === "element_visible") {
    const label =
      type === "click"
        ? "CSS selector"
        : type === "form_submit"
          ? "Form CSS selector"
          : "Element CSS selector";
    const placeholder =
      type === "click"
        ? "button.cta, a[href*='checkout']"
        : type === "form_submit"
          ? "form#contact"
          : ".hero-section";
    return (
      <div className="space-y-3">
        <Field label={label}>
          <Input
            value={(config.selector as string) || ""}
            onChange={(e) => onChange("selector", e.target.value)}
            placeholder={placeholder}
            className="text-sm"
          />
        </Field>
        {type === "element_visible" && (
          <Field label="Visibility threshold (0–1)">
            <Input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={(config.threshold as number) ?? 0.5}
              onChange={(e) => onChange("threshold", parseFloat(e.target.value) || 0.5)}
              placeholder="0.5"
              className="w-24 text-sm"
            />
          </Field>
        )}
      </div>
    );
  }
  if (type === "custom_event") {
    return (
      <Field label="Event name">
        <Input
          value={(config.event_name as string) || ""}
          onChange={(e) => onChange("event_name", e.target.value)}
          placeholder="purchase"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "timer") {
    return (
      <Field label="Seconds">
        <Input
          type="number"
          value={(config.seconds as number) || 0}
          onChange={(e) => onChange("seconds", parseFloat(e.target.value) || 0)}
          placeholder="30"
          className="w-24 text-sm"
        />
      </Field>
    );
  }
  if (type === "scroll_depth") {
    return (
      <Field label="Scroll depth threshold (%)">
        <Input
          type="number"
          value={(config.threshold as number) || 50}
          onChange={(e) => onChange("threshold", parseFloat(e.target.value) || 50)}
          placeholder="50"
          className="w-24 text-sm"
        />
      </Field>
    );
  }
  return null;
}

function VariableConfigFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (type === "constant") {
    return (
      <Field label="Value">
        <Input
          value={(config.value as string) || ""}
          onChange={(e) => onChange("value", e.target.value)}
          placeholder="my_constant_value"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "data_layer") {
    return (
      <Field label="Data layer key">
        <Input
          value={(config.key as string) || ""}
          onChange={(e) => onChange("key", e.target.value)}
          placeholder="ecommerce.value"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "cookie") {
    return (
      <Field label="Cookie name">
        <Input
          value={(config.name as string) || ""}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="_ga"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "dom_element") {
    const waitMs = config.wait_ms == null ? "" : String(config.wait_ms);
    const transform = (config.transform as string) || "";
    return (
      <div className="space-y-3">
        <Field label="CSS selector">
          <Input
            value={(config.selector as string) || ""}
            onChange={(e) => onChange("selector", e.target.value)}
            placeholder="#product-title"
            className="text-sm"
          />
        </Field>
        <Field label="Attribute (blank for text content)">
          <Input
            value={(config.attribute as string) || ""}
            onChange={(e) => onChange("attribute", e.target.value)}
            placeholder="data-id"
            className="text-sm"
          />
        </Field>
        <Field label="Wait for element (ms, blank = no wait)">
          <Input
            type="number"
            min={0}
            max={10000}
            step={100}
            value={waitMs}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange("wait_ms", undefined);
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              onChange("wait_ms", Math.max(0, Math.min(10000, Math.round(n))));
            }}
            placeholder="3000"
            className="w-32 text-sm"
          />
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Polls for the selector before resolving. Use for late-mounted content. Capped at
            10000ms.
          </p>
        </Field>
        <Field label="Transform">
          <Select
            value={transform || "__none"}
            onValueChange={(v) => onChange("transform", v === "__none" ? undefined : v)}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None (raw value)</SelectItem>
              <SelectItem value="numeric">Numeric (strip non-digits/.)</SelectItem>
              <SelectItem value="trim">Trim whitespace</SelectItem>
              <SelectItem value="lowercase">Lowercase</SelectItem>
              <SelectItem value="uppercase">Uppercase</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    );
  }
  if (type === "javascript") {
    return (
      <Field label="JavaScript expression">
        <Textarea
          value={(config.expression as string) || ""}
          onChange={(e) => onChange("expression", e.target.value)}
          placeholder="window.location.pathname"
          className="min-h-[80px] font-mono text-sm"
        />
      </Field>
    );
  }
  if (type === "url_parameter") {
    return (
      <Field label="URL parameter name">
        <Input
          value={(config.param as string) || ""}
          onChange={(e) => onChange("param", e.target.value)}
          placeholder="utm_source"
          className="text-sm"
        />
      </Field>
    );
  }
  if (type === "builtin") {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        Built-in variables are provided automatically by the plugin runtime (e.g. page URL,
        referrer, timestamp).
      </div>
    );
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ContainerManagerProps {
  /** Base API path for container CRUD. Defaults to `/api/plugin/container`. */
  apiBase?: string;
  /** Optional display name (e.g. workspace name) for the header. */
  displayName?: string;
}

export function ContainerManager({
  apiBase = "/api/plugin/container",
  displayName,
}: ContainerManagerProps) {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [container, setContainer] = useState<Container | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [installSnippet, setInstallSnippet] = useState("");

  const [section, setSection] = useState<Section>("tags");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [editEnabled, setEditEnabled] = useState(true);
  const [editPriority, setEditPriority] = useState(0);
  const [editConsentCategory, setEditConsentCategory] = useState("necessary");
  const [editRateLimitExempt, setEditRateLimitExempt] = useState(false);
  const [editTriggerIds, setEditTriggerIds] = useState<string[]>([]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirty = container ? container.draft_version > (container.published_version ?? 0) : false;
  const installStatusUrl = `${apiBase}/install-status`;

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");

      setContainer(data.container);
      setTags(data.tags || []);
      setTriggers(data.triggers || []);
      setVariables(data.variables || []);
      setVersions(data.versions || []);
      setInstallSnippet(data.installSnippet || "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Select item ──
  const selectedTag = section === "tags" ? tags.find((t) => t.id === selectedId) : undefined;
  const selectedTrigger =
    section === "triggers" ? triggers.find((t) => t.id === selectedId) : undefined;
  const selectedVariable =
    section === "variables" ? variables.find((v) => v.id === selectedId) : undefined;

  const populateEditor = useCallback((item: Tag | Trigger | Variable | null) => {
    if (!item) {
      setEditName("");
      setEditType("");
      setEditConfig({});
      setEditEnabled(true);
      setEditPriority(0);
      setEditConsentCategory("necessary");
      setEditRateLimitExempt(false);
      setEditTriggerIds([]);
      return;
    }
    setEditName(item.name);
    setEditType(item.type);
    setEditConfig({ ...(item.config || {}) });
    if ("enabled" in item) setEditEnabled(item.enabled);
    if ("priority" in item) setEditPriority(item.priority);
    if ("consent_category" in item) setEditConsentCategory(item.consent_category);
    if ("rate_limit_exempt" in item) setEditRateLimitExempt(item.rate_limit_exempt);
    if ("trigger_ids" in item) setEditTriggerIds(item.trigger_ids || []);
  }, []);

  useEffect(() => {
    if (section === "tags") populateEditor(selectedTag || null);
    else if (section === "triggers") populateEditor(selectedTrigger || null);
    else if (section === "variables") populateEditor(selectedVariable || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, section]);

  const handleSelect = (id: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSelectedId(id);
  };

  const handleSectionChange = (s: Section) => {
    setSection(s);
    setSelectedId(null);
  };

  // ── Save ──
  const save = useCallback(
    async (overrides?: {
      name?: string;
      type?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
      priority?: number;
      consent_category?: string;
      rate_limit_exempt?: boolean;
      trigger_ids?: string[];
    }) => {
      if (!selectedId) return;
      setSaving(true);
      try {
        const entity = section === "tags" ? "tag" : section === "triggers" ? "trigger" : "variable";
        const updates: Record<string, unknown> = {
          name: overrides?.name ?? editName,
          type: overrides?.type ?? editType,
          config: overrides?.config ?? editConfig,
        };
        if (section === "tags") {
          updates.enabled = overrides?.enabled ?? editEnabled;
          updates.priority = overrides?.priority ?? editPriority;
          updates.consent_category = overrides?.consent_category ?? editConsentCategory;
          updates.rate_limit_exempt = overrides?.rate_limit_exempt ?? editRateLimitExempt;
          updates.trigger_ids = overrides?.trigger_ids ?? editTriggerIds;
        }

        const res = await fetch(apiBase, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entity, id: selectedId, ...updates }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (section === "tags" && data.tag) {
          setTags((prev) => prev.map((t) => (t.id === selectedId ? data.tag : t)));
        } else if (section === "triggers" && data.trigger) {
          setTriggers((prev) => prev.map((t) => (t.id === selectedId ? data.trigger : t)));
        } else if (section === "variables" && data.variable) {
          setVariables((prev) => prev.map((v) => (v.id === selectedId ? data.variable : v)));
        }
        setContainer((prev) => (data.container ? data.container : prev));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [
      selectedId,
      section,
      apiBase,
      editName,
      editType,
      editConfig,
      editEnabled,
      editPriority,
      editConsentCategory,
      editRateLimitExempt,
      editTriggerIds,
    ],
  );

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(), 1000);
  }, [save]);

  const handleBlurSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    save();
  }, [save]);

  // ── Config field update ──
  const handleConfigChange = (key: string, value: unknown) => {
    setEditConfig((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[key];
      else next[key] = value;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save({ config: next }), 1000);
      return next;
    });
  };

  // ── Create ──
  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const action =
        section === "tags"
          ? "create_tag"
          : section === "triggers"
            ? "create_trigger"
            : "create_variable";

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (section === "tags" && data.tag) {
        setTags((prev) => [...prev, data.tag]);
        setSelectedId(data.tag.id);
        populateEditor(data.tag);
      } else if (section === "triggers" && data.trigger) {
        setTriggers((prev) => [...prev, data.trigger]);
        setSelectedId(data.trigger.id);
        populateEditor(data.trigger);
      } else if (section === "variables" && data.variable) {
        setVariables((prev) => [...prev, data.variable]);
        setSelectedId(data.variable.id);
        populateEditor(data.variable);
      }
      setContainer((prev) => (data.container ? data.container : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!selectedId) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this item?")) return;
    setDeleting(true);
    try {
      const entity = section === "tags" ? "tag" : section === "triggers" ? "trigger" : "variable";

      const res = await fetch(apiBase, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (section === "tags") setTags((prev) => prev.filter((t) => t.id !== selectedId));
      else if (section === "triggers")
        setTriggers((prev) => prev.filter((t) => t.id !== selectedId));
      else if (section === "variables")
        setVariables((prev) => prev.filter((v) => v.id !== selectedId));
      setSelectedId(null);
      setContainer((prev) => (data.container ? data.container : prev));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ── Publish ──
  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  // ── Loading / error ──
  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 rounded bg-muted" />
          <div className="mt-4 flex gap-4">
            <div className="h-96 w-48 rounded-xl bg-muted" />
            <div className="h-96 w-72 rounded-xl bg-muted" />
            <div className="h-96 flex-1 rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !container) {
    return <div className="p-8 text-sm text-destructive">{error}</div>;
  }

  const currentItems: Array<Tag | Trigger | Variable> =
    section === "tags" ? tags : section === "triggers" ? triggers : section === "variables" ? variables : [];

  const selectedItem = selectedTag || selectedTrigger || selectedVariable || null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {displayName || "Plugin container"}
          </span>
          {isDirty && (
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
              Unpublished changes
            </span>
          )}
          {container?.published_version ? (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
              v{container.published_version} live
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}

          <Popover>
            <PopoverTrigger
              render={<Button type="button" variant="ghost" size="sm" className="text-xs" />}
            >
              <Code2Icon data-icon="inline-start" />
              Install snippet
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] max-h-[80vh] overflow-y-auto p-4">
              <InstallPanel
                statusUrl={installStatusUrl}
                installSnippet={installSnippet}
                section="install"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger
              render={<Button type="button" variant="ghost" size="sm" className="text-xs" />}
            >
              <ShieldIcon data-icon="inline-start" />
              Block your tracking
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[420px] max-h-[80vh] overflow-y-auto p-4">
              <InstallPanel
                statusUrl={installStatusUrl}
                installSnippet={installSnippet}
                section="opt_out"
              />
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            onClick={handlePublish}
            disabled={publishing || !isDirty}
            variant={isDirty ? "default" : "secondary"}
            className="text-xs font-medium"
            title={isDirty ? "" : "No unpublished changes"}
          >
            {publishing
              ? "Publishing…"
              : isDirty
                ? `Publish v${container?.draft_version ?? 1}`
                : `v${container?.published_version ?? 0} published`}
          </Button>
        </div>
      </div>

      {/* ── Three columns ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left nav ── */}
        <div className="flex w-[180px] shrink-0 flex-col overflow-y-auto border-r border-border bg-background">
          <nav className="flex-1 space-y-0.5 p-2">
            {(["tags", "triggers", "variables", "versions"] as Section[]).map((s) => {
              const count =
                s === "tags"
                  ? tags.length
                  : s === "triggers"
                    ? triggers.length
                    : s === "variables"
                      ? variables.length
                      : versions.length;
              const label = s.charAt(0).toUpperCase() + s.slice(1);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSectionChange(s)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    section === s
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-xs",
                      section === s ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Center: item list ── */}
        <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/30">
          {section !== "versions" && (
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
                {section}
              </span>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
              >
                <PlusIcon className="size-3.5" />
                New
              </button>
            </div>
          )}

          <div className="flex-1 space-y-1 p-2">
            {section === "versions" ? (
              versions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No published versions yet
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">v{v.version}</span>
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        published
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(v.created_at)}</div>
                    {v.notes && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">{v.notes}</div>
                    )}
                  </div>
                ))
              )
            ) : currentItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No {section} yet. Click &ldquo;New&rdquo; to create one.
              </div>
            ) : (
              currentItems.map((item) => {
                const isTag = "enabled" in item;
                const isSelected = item.id === selectedId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      "w-full rounded-lg border bg-background p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary/40 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-medium leading-tight text-foreground">
                        {item.name}
                      </span>
                      {isTag && (
                        <div
                          className={cn(
                            "mt-1 size-2 shrink-0 rounded-full",
                            (item as Tag).enabled ? "bg-emerald-500" : "bg-muted-foreground/40",
                          )}
                        />
                      )}
                    </div>
                    <TypeBadge type={item.type} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: editor panel ── */}
        <div className="flex-1 overflow-y-auto bg-background">
          {!selectedItem || section === "versions" ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {section === "versions"
                ? "Version history is shown in the list."
                : `Select a ${section.slice(0, -1)} to edit it.`}
            </div>
          ) : (
            <div className="max-w-xl space-y-5 p-6">
              {/* Name + enabled */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <SectionLabel label="Name" />
                  <Input
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      scheduleSave();
                    }}
                    onBlur={handleBlurSave}
                    className="text-sm font-medium"
                  />
                </div>
                {section === "tags" && (
                  <div className="shrink-0 pt-5">
                    <Switch
                      checked={editEnabled}
                      onCheckedChange={(v) => {
                        setEditEnabled(v);
                        save({ enabled: v });
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Type */}
              <Field label="Type">
                <Select
                  value={editType}
                  onValueChange={(v) => {
                    if (v == null) return;
                    setEditType(v);
                    setEditConfig({});
                    save({ type: v, config: {} });
                  }}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(section === "tags"
                      ? TAG_TYPES
                      : section === "triggers"
                        ? TRIGGER_TYPES
                        : VARIABLE_TYPES
                    ).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Type-specific config */}
              {section === "tags" && (
                <TagConfigFields type={editType} config={editConfig} onChange={handleConfigChange} />
              )}
              {section === "triggers" && (
                <TriggerConfigFields
                  type={editType}
                  config={editConfig}
                  onChange={handleConfigChange}
                />
              )}
              {section === "variables" && (
                <VariableConfigFields
                  type={editType}
                  config={editConfig}
                  onChange={handleConfigChange}
                />
              )}

              {/* Tag-specific fields */}
              {section === "tags" && (
                <>
                  {/* Triggers multi-select */}
                  <div>
                    <SectionLabel label="Triggers" />
                    {triggers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No triggers defined yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {triggers.map((tr) => (
                          <label key={tr.id} className="flex cursor-pointer items-center gap-2.5">
                            <Checkbox
                              checked={editTriggerIds.includes(tr.id)}
                              onCheckedChange={(checked) => {
                                const on = checked === true;
                                const next = on
                                  ? [...editTriggerIds, tr.id]
                                  : editTriggerIds.filter((id) => id !== tr.id);
                                setEditTriggerIds(next);
                                save({ trigger_ids: next });
                              }}
                            />
                            <span className="text-sm text-foreground">{tr.name}</span>
                            <TypeBadge type={tr.type} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <Field label="Priority (higher fires first)">
                    <Input
                      type="number"
                      value={editPriority}
                      onChange={(e) => {
                        setEditPriority(parseInt(e.target.value, 10) || 0);
                        scheduleSave();
                      }}
                      onBlur={handleBlurSave}
                      className="w-24 text-sm"
                    />
                  </Field>

                  {/* Consent category */}
                  <Field label="Consent category">
                    <Select
                      value={editConsentCategory}
                      onValueChange={(v) => {
                        if (v == null) return;
                        setEditConsentCategory(v);
                        save({ consent_category: v });
                      }}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONSENT_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {/* Rate limit exempt */}
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editRateLimitExempt}
                      onCheckedChange={(v) => {
                        setEditRateLimitExempt(v);
                        save({ rate_limit_exempt: v });
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-foreground">Rate limit exempt</div>
                      <div className="text-xs text-muted-foreground">
                        Fire this tag even when rate limiting is active
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Save + Delete */}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-destructive transition-colors hover:text-destructive/80 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
                <Button size="sm" onClick={() => save()} disabled={saving} className="text-xs font-medium">
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
