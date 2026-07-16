import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function WorkspaceAvatar({
  name,
  avatarUrl,
  className,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  size?: "sm" | "default";
}) {
  const mark = name.trim().slice(0, 1).toUpperCase() || "W";

  return (
    <Avatar
      size={size}
      className={cn(
        "rounded bg-muted after:rounded",
        size === "sm" && "size-5",
        className,
      )}
    >
      {avatarUrl ? (
        <AvatarImage src={avatarUrl} alt="" className="rounded" />
      ) : null}
      <AvatarFallback className="rounded text-[10px] font-semibold">
        {mark}
      </AvatarFallback>
    </Avatar>
  );
}
