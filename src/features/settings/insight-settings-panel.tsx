"use client";

import { useEffect, useState } from "react";
import type {
  InsightGoalMode,
  InsightHeartbeatSchedule,
  InsightSettings,
} from "@/domain";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GoalsPanel } from "@/features/insights/goals-panel";
import { cn } from "@/lib/utils";

const GOAL_MODES: {
  value: InsightGoalMode;
  label: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "Auto",
    description:
      "Goals are inferred and kept up to date from your products and performance.",
  },
  {
    value: "manual",
    label: "Manual",
    description: "Create and edit product and workspace goals yourself.",
  },
];

const TRIGGER_ROWS: {
  key: keyof InsightSettings["triggers"];
  label: string;
  description: string;
}[] = [
  {
    key: "job",
    label: "Job completions",
    description: "Generate insights when background jobs finish.",
  },
  {
    key: "agent",
    label: "Agent",
    description: "Allow the agent to propose insights in chat.",
  },
  {
    key: "heartbeat",
    label: "Heartbeat",
    description: "Periodic check-ins on a schedule you choose.",
  },
  {
    key: "api",
    label: "API",
    description: "Allow insights to be requested via the API.",
  },
];

const HEARTBEAT_SCHEDULES: {
  value: InsightHeartbeatSchedule;
  label: string;
}[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "off", label: "Off" },
];

export function InsightSettingsPanel({
  initialSettings,
  goals,
  products,
  canEdit,
}: {
  initialSettings: InsightSettings;
  goals: Parameters<typeof GoalsPanel>[0]["goals"];
  products: Parameters<typeof GoalsPanel>[0]["products"];
  canEdit: boolean;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  async function save(patch: Partial<{
    goalMode: InsightGoalMode;
    heartbeatSchedule: InsightHeartbeatSchedule;
    triggers: Partial<InsightSettings["triggers"]>;
  }>) {
    if (!canEdit) return;
    const previous = settings;
    const next: InsightSettings = {
      goalMode: patch.goalMode ?? settings.goalMode,
      heartbeatSchedule: patch.heartbeatSchedule ?? settings.heartbeatSchedule,
      triggers: { ...settings.triggers, ...patch.triggers },
    };
    setSettings(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/insights", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: InsightSettings;
      };
      if (!res.ok) throw new Error(body.error || "Failed to save");
      if (body.settings) setSettings(body.settings);
    } catch (err) {
      setSettings(previous);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          Only workspace owners and admins can change insight settings.
        </p>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Goals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose whether goals are set automatically or managed by hand.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {GOAL_MODES.map((mode) => {
            const selected = settings.goalMode === mode.value;
            return (
              <Button
                key={mode.value}
                type="button"
                variant="outline"
                disabled={!canEdit || saving}
                className={cn(
                  "h-auto flex-col items-start gap-1 px-3 py-3 text-left whitespace-normal",
                  selected && "border-foreground bg-muted/40",
                )}
                aria-pressed={selected}
                onClick={() => void save({ goalMode: mode.value })}
              >
                <span className="text-sm font-medium">{mode.label}</span>
                <span className="text-xs text-muted-foreground">
                  {mode.description}
                </span>
              </Button>
            );
          })}
        </div>

        {settings.goalMode === "manual" ? (
          <GoalsPanel goals={goals} products={products} />
        ) : (
          <p className="text-sm text-muted-foreground">
            With auto goal setting, Product keeps goals aligned to your catalog
            and performance. Switch to manual to create and edit them here.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-medium">Triggers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what can create insights for this workspace.
          </p>
        </div>

        <ul className="divide-y divide-border rounded-lg border border-border">
          {TRIGGER_ROWS.map((row) => (
            <li
              key={row.key}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="space-y-0.5">
                <Label
                  htmlFor={`trigger-${row.key}`}
                  className="text-sm font-medium"
                >
                  {row.label}
                </Label>
                <p className="text-xs text-muted-foreground">{row.description}</p>
              </div>
              <Switch
                id={`trigger-${row.key}`}
                checked={settings.triggers[row.key]}
                disabled={!canEdit || saving}
                onCheckedChange={(checked) =>
                  void save({ triggers: { [row.key]: checked } })
                }
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="heartbeat-schedule" className="text-sm font-medium">
              Heartbeat schedule
            </Label>
            <p className="text-xs text-muted-foreground">
              How often the heartbeat trigger may run when it is enabled.
            </p>
          </div>
          <Select
            value={settings.heartbeatSchedule}
            disabled={
              !canEdit || saving || !settings.triggers.heartbeat
            }
            onValueChange={(value) => {
              if (!value) return;
              void save({
                heartbeatSchedule: value as InsightHeartbeatSchedule,
              });
            }}
          >
            <SelectTrigger id="heartbeat-schedule" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEARTBEAT_SCHEDULES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
