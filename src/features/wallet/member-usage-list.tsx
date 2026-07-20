"use client";

import type { MemberUsage } from "@/domain";
import { UserAvatar } from "@/features/avatars/user-avatar";
import { formatCents } from "@/features/wallet/money";
import { cn } from "@/lib/utils";

function displayName(member: MemberUsage, isCurrentUser: boolean): string {
  if (isCurrentUser) return "You";
  return member.name?.trim() || member.email || "Former member";
}

/** Compact per-member AI usage rows for the Usage toolbar popover. */
export function MemberUsageList({
  members,
  currentUserId,
  totalUsageCents,
}: {
  members: MemberUsage[];
  currentUserId: string | null;
  totalUsageCents: number;
}) {
  if (members.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No members yet.</p>
    );
  }

  const maxCents = Math.max(
    totalUsageCents,
    ...members.map((m) => m.usageCents),
    1,
  );

  return (
    <ul className="space-y-2.5">
      {members.map((member) => {
        const isCurrent = member.userId === currentUserId;
        const pct = Math.round((member.usageCents / maxCents) * 100);
        return (
          <li key={member.userId} className="space-y-1">
            <div className="flex items-center gap-2">
              <UserAvatar
                name={member.name}
                email={member.email}
                avatarUrl={member.avatarUrl}
                size="sm"
                fallbackClassName="text-[10px]"
              />
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  isCurrent ? "font-medium text-foreground" : "text-foreground",
                )}
              >
                {displayName(member, isCurrent)}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatCents(member.usageCents)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-[width]",
                  isCurrent ? "bg-primary" : "bg-primary/50",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
