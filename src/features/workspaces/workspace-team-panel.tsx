"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  WorkspaceInvite,
  WorkspaceInviteRole,
  WorkspaceMember,
  WorkspaceRole,
} from "@/domain";
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
import { UserAvatar } from "@/features/avatars/user-avatar";

export function WorkspaceTeamPanel({
  workspaceId,
  role,
  members: initialMembers,
  invites: initialInvites,
  currentUserId,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  members: WorkspaceMember[];
  invites: WorkspaceInvite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const canManage = role === "owner" || role === "admin";

  const [members, setMembers] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceInviteRole>("member");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendInvite() {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        invite?: WorkspaceInvite;
      };
      if (!res.ok) throw new Error(body.error || "Failed to invite");
      if (body.invite) {
        setInvites((prev) => [body.invite!, ...prev]);
      }
      setInviteEmail("");
      setMessage(`Invite sent to ${inviteEmail}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setBusy(false);
    }
  }

  async function revokeInvite(inviteId: string) {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/invites/${inviteId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to revoke invite");
      }
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: "admin" | "member") {
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        member?: WorkspaceMember;
      };
      if (!res.ok) throw new Error(body.error || "Failed to update role");
      if (body.member) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, role: body.member!.role } : m,
          ),
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!canManage && userId !== currentUserId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/${userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to remove member");
      }
      if (userId === currentUserId) {
        router.push("/");
        router.refresh();
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      {message ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Members</h2>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {members.map((member) => {
            const memberIsOwner = member.role === "owner";
            const isSelf = member.userId === currentUserId;
            const canEditRole =
              canManage &&
              !memberIsOwner &&
              (role === "owner" || member.role !== "admin");
            const canRemove =
              !memberIsOwner &&
              (isSelf ||
                (canManage && (role === "owner" || member.role !== "admin")));

            return (
              <li
                key={member.userId}
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
                      {member.name || member.email || member.userId}
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
                <div className="flex items-center gap-2">
                  {canEditRole ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => {
                        if (value === "admin" || value === "member") {
                          void changeRole(member.userId, value);
                        }
                      }}
                    >
                      <SelectTrigger size="sm" className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs capitalize text-muted-foreground">
                      {member.role}
                    </span>
                  )}
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void removeMember(member.userId)}
                    >
                      {isSelf ? "Leave" : "Remove"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {canManage ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Invite people</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  disabled={busy}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <div>
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => {
                      if (value === "admin" || value === "member") {
                        setInviteRole(value);
                      }
                    }}
                  >
                    <SelectTrigger id="invite-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                disabled={busy || !inviteEmail.trim()}
                onClick={() => void sendInvite()}
              >
                Send invite
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium">Pending invites</h2>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invites.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{invite.email}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {invite.role} · expires{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void revokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
