"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useUpgradeOptional } from "@/features/billing/upgrade-context";

type ButtonProps = ComponentProps<typeof Button>;

/** Opens the shared upgrade pricing overlay. Falls back to /settings/billing. */
export function UpgradeButton({
  children = "Upgrade",
  ...props
}: Omit<ButtonProps, "onClick" | "render"> & {
  children?: ReactNode;
}) {
  const upgrade = useUpgradeOptional();

  return (
    <Button
      type="button"
      {...props}
      onClick={() => {
        if (upgrade) {
          upgrade.openUpgrade();
          return;
        }
        window.location.href = "/settings/billing";
      }}
    >
      {children}
    </Button>
  );
}
