import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-heading text-xl font-semibold tracking-tight">Not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        That product or page does not exist in this workspace.
      </p>
      <Button render={<Link href="/" />}>Back to catalog</Button>
    </div>
  );
}
