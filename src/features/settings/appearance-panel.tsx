"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

export function AppearancePanel() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <div
            key={option.value}
            className="h-20 rounded-lg border border-border bg-muted/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <Button
            key={value}
            type="button"
            variant="outline"
            className={cn(
              "h-auto flex-col gap-2 py-4",
              selected && "border-foreground bg-muted/40",
            )}
            aria-pressed={selected}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-5" />
            <span className="text-sm">{label}</span>
          </Button>
        );
      })}
    </div>
  );
}
