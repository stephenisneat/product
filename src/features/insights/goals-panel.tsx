"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Goal, GoalHorizon, GoalMetric, GoalScope } from "@/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const METRICS: { value: GoalMetric; label: string }[] = [
  { value: "roas", label: "ROAS" },
  { value: "cac", label: "CAC" },
  { value: "revenue", label: "Revenue" },
  { value: "conversions", label: "Conversions" },
  { value: "custom", label: "Custom" },
];

const HORIZONS: { value: GoalHorizon; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "ongoing", label: "Ongoing" },
];

function formatTarget(goal: Goal): string {
  if (goal.targetValue == null) return goal.metric.toUpperCase();
  return `${goal.targetValue}${goal.targetUnit ?? ""} · ${goal.metric.toUpperCase()}`;
}

export function GoalsPanel({
  goals: initial,
  products,
}: {
  goals: Goal[];
  products: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<GoalScope>("product");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<GoalMetric>("roas");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("x");
  const [horizon, setHorizon] = useState<GoalHorizon>("monthly");
  const [notes, setNotes] = useState("");

  const workspaceGoals = goals.filter((g) => g.scope === "workspace");
  const productGoals = goals.filter((g) => g.scope === "product");
  const titleByProduct = Object.fromEntries(products.map((p) => [p.id, p.title]));

  async function createGoal() {
    setError(null);
    const body: Record<string, unknown> = {
      scope,
      title: title.trim(),
      metric,
      horizon,
      notes: notes.trim() || undefined,
      targetUnit: targetUnit.trim() || null,
    };
    if (targetValue.trim()) {
      const n = Number(targetValue);
      if (!Number.isFinite(n)) {
        setError("Target must be a number");
        return;
      }
      body.targetValue = n;
    } else {
      body.targetValue = null;
    }
    if (scope === "product") {
      if (!productId) {
        setError("Pick a product");
        return;
      }
      body.productId = productId;
    }

    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Failed to create goal");
      return;
    }
    const data = (await res.json()) as { goal: Goal };
    setGoals((prev) => [data.goal, ...prev]);
    setTitle("");
    setNotes("");
    setTargetValue("");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  async function archiveGoal(id: string) {
    setError(null);
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Failed to archive goal");
      return;
    }
    const data = (await res.json()) as { goal: Goal };
    setGoals((prev) => prev.map((g) => (g.id === id ? data.goal : g)));
    startTransition(() => router.refresh());
  }

  return (
    <section className="mb-8 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          Goals
        </h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Cancel" : "Add goal"}
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {open ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-scope">Scope</Label>
              <Select
                value={scope}
                onValueChange={(v) => {
                  if (v) setScope(v as GoalScope);
                }}
              >
                <SelectTrigger id="goal-scope" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="workspace">Workspace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "product" ? (
              <div className="space-y-1.5">
                <Label htmlFor="goal-product">Product</Label>
                <Select
                  value={productId}
                  onValueChange={(v) => {
                    if (v) setProductId(v);
                  }}
                >
                  <SelectTrigger id="goal-product" className="w-full">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="goal-title">Title</Label>
              <Input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hit 3x ROAS on serum"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Metric</Label>
              <Select
                value={metric}
                onValueChange={(v) => {
                  if (v) setMetric(v as GoalMetric);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Horizon</Label>
              <Select
                value={horizon}
                onValueChange={(v) => {
                  if (v) setHorizon(v as GoalHorizon);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORIZONS.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="Optional"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input
                id="goal-unit"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                placeholder="x, $, %"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="goal-notes">Notes</Label>
              <Textarea
                id="goal-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional context"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending || !title.trim()}
            onClick={() => void createGoal()}
          >
            Save goal
          </Button>
        </div>
      ) : null}

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No goals yet. Add a product or workspace goal so insights stay focused.
        </p>
      ) : (
        <div className="space-y-4">
          {productGoals.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Product
              </p>
              <ul className="space-y-2">
                {productGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{goal.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {goal.productId
                          ? titleByProduct[goal.productId] ?? goal.productId
                          : "Product"}{" "}
                        · {formatTarget(goal)} · {goal.horizon}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {goal.status}
                      </Badge>
                      {goal.status === "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={pending}
                          onClick={() => void archiveGoal(goal.id)}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {workspaceGoals.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Workspace
              </p>
              <ul className="space-y-2">
                {workspaceGoals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/80 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{goal.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTarget(goal)} · {goal.horizon}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {goal.status}
                      </Badge>
                      {goal.status === "active" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={pending}
                          onClick={() => void archiveGoal(goal.id)}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
