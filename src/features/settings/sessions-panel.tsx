"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SessionItem = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  refreshedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  isCurrent: boolean;
};

type HistoryItem = {
  id: string;
  sessionId: string;
  event: "login" | "revoke";
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function summarizeUserAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile browser";
  return "Browser";
}

export function SessionsPanel() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/auth/sessions");
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessions?: SessionItem[];
        history?: HistoryItem[];
      };
      if (!res.ok) throw new Error(body.error || "Failed to load sessions");
      setSessions(body.sessions ?? []);
      setHistory(body.history ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(sessionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        signedOut?: boolean;
      };
      if (!res.ok) throw new Error(body.error || "Failed to revoke session");
      if (body.signedOut) {
        router.push("/login");
        router.refresh();
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setBusy(false);
    }
  }

  async function revokeOthers() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sessions/revoke-others", {
        method: "POST",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to revoke sessions");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading sessions…</p>;
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Active sessions</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || sessions.filter((s) => !s.isCurrent).length === 0}
            onClick={() => void revokeOthers()}
          >
            Sign out other sessions
          </Button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {summarizeUserAgent(session.userAgent)}
                    {session.isCurrent ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (this device)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ip ? `${session.ip} · ` : ""}
                    Signed in {formatWhen(session.createdAt)}
                    {session.refreshedAt
                      ? ` · Last active ${formatWhen(session.refreshedAt)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void revoke(session.id)}
                >
                  {session.isCurrent ? "Sign out" : "Revoke"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Session history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No session history yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((item) => (
              <li key={item.id} className="px-3 py-3">
                <p className="text-sm font-medium capitalize">
                  {item.event === "login" ? "Signed in" : "Revoked"}
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {summarizeUserAgent(item.userAgent)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.ip ? `${item.ip} · ` : ""}
                  {formatWhen(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
