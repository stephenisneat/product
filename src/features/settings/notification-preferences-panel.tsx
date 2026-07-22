"use client";

import { useEffect, useState } from "react";
import type { NotificationPreferences } from "@/domain";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ROWS: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
}[] = [
  {
    key: "productUpdates",
    label: "Product updates",
    description: "News about products you manage and catalog changes.",
  },
  {
    key: "jobCompletions",
    label: "Job completions",
    description: "When background jobs finish or need attention.",
  },
  {
    key: "creativeReview",
    label: "Creative review",
    description: "When a video creative is ready for review or Generate video.",
  },
  {
    key: "workspaceInvites",
    label: "Workspace invites",
    description: "Invites to join workspaces and related membership emails.",
  },
  {
    key: "billingAlerts",
    label: "Billing alerts",
    description: "Payment failures, renewals, and plan changes.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Occasional product tips and announcements.",
  },
];

export function NotificationPreferencesPanel({
  initialPreferences,
}: {
  initialPreferences: NotificationPreferences;
}) {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(initialPreferences);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(
    null,
  );

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  async function toggle(key: keyof NotificationPreferences, value: boolean) {
    const previous = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        preferences?: NotificationPreferences;
      };
      if (!res.ok) throw new Error(body.error || "Failed to save");
      if (body.preferences) setPreferences(body.preferences);
    } catch (err) {
      setPreferences(previous);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="flex items-start justify-between gap-4 px-4 py-3"
          >
            <div className="space-y-0.5">
              <Label htmlFor={`pref-${row.key}`} className="text-sm font-medium">
                {row.label}
              </Label>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              id={`pref-${row.key}`}
              checked={preferences[row.key]}
              disabled={savingKey !== null}
              onCheckedChange={(checked) => void toggle(row.key, checked)}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Changes save automatically. Transactional security emails are always
        sent.
      </p>
    </div>
  );
}
