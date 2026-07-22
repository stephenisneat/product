import { createClient } from "@/lib/supabase/server";

type FeedbackRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  kind: string;
  title: string;
  body: string | null;
  screenshot_url: string | null;
  created_at: string;
};

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function kindLabel(kind: string) {
  if (kind === "channel_request") return "Channel request";
  if (kind === "bug") return "Bug";
  if (kind === "feature") return "Feature request";
  return kind;
}

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_feedback")
    .select(
      "id, user_id, user_email, kind, title, body, screenshot_url, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as FeedbackRow[];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Feedback
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bugs, feature requests, and channel suggestions from users.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">
          Failed to load feedback: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feedback yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(row.created_at)}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {kindLabel(row.kind)}
                {row.user_email ? ` · ${row.user_email}` : null}
              </p>
              {row.body ? (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                  {row.body}
                </p>
              ) : null}
              {row.screenshot_url ? (
                <a
                  href={row.screenshot_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block overflow-hidden rounded-md border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.screenshot_url}
                    alt="Attached screenshot"
                    className="max-h-64 w-full object-contain bg-muted/30"
                  />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
