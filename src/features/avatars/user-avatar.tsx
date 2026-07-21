import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsFor(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email || "?").trim();
  return source.slice(0, 1).toUpperCase() || "?";
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  className,
  size = "sm",
  fallbackClassName,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
  size?: "sm" | "default";
  fallbackClassName?: string;
}) {
  return (
    <Avatar size={size} className={cn(className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={fallbackClassName}>
        {initialsFor(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}
