"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { AdminUserSearch } from "@/features/admin/admin-user-search";
import type {
  AdminUserSearchResult,
  PlatformAdminMember,
} from "@/features/admin/types";

export function AdminTeamPanel({
  members: initialMembers,
  currentUserId,
}: {
  members: PlatformAdminMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function addMember(user: AdminUserSearchResult) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        member?: PlatformAdminMember;
      };
      if (!res.ok) throw new Error(body.error || "Failed to grant access");
      if (body.member) {
        setMembers((prev) => {
          if (prev.some((m) => m.id === body.member!.id)) return prev;
          return [...prev, body.member!].sort((a, b) =>
            (a.name || a.email || a.id).localeCompare(
              b.name || b.email || b.id,
            ),
          );
        });
      }
      setMessage(
        `Granted Admin Center access to ${user.name || user.email || "user"}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grant access");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/team/${userId}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to remove access");
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      setMessage("Removed Admin Center access.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove access");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {message ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Add platform admin</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Search existing users by name or email.
          </p>
        </div>
        <AdminUserSearch
          onSelect={(user) => void addMember(user)}
          excludeIds={members.map((m) => m.id)}
          disabled={busy}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">
          Platform admins
          <span className="ml-1.5 font-normal text-muted-foreground">
            ({members.length})
          </span>
        </h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No platform admins yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              const canRemove = members.length > 1;
              return (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar
                      name={member.name}
                      email={member.email}
                      avatarUrl={member.avatarUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.name || member.email || member.id}
                        {isSelf ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </p>
                      {member.email ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void removeMember(member.id)}
                    >
                      Remove
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Last admin
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
