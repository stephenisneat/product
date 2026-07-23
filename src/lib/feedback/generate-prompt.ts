import { generateText } from "ai";
import type { AdminFeedbackKind } from "@/domain";
import { getCursorBaseRef } from "@/lib/cursor/cloud-agents";
import { hasAiGateway } from "@/lib/mode";

/** Same default text model used elsewhere for structured generation. */
const FEEDBACK_PROMPT_MODEL = "openai/gpt-4.1-mini";

export type FeedbackPromptSource = {
  id: string;
  kind: AdminFeedbackKind | string;
  title: string;
  body: string | null;
  screenshotUrl: string | null;
  userEmail: string | null;
};

function kindLabel(kind: string): string {
  if (kind === "channel_request") return "channel request";
  if (kind === "bug") return "bug report";
  if (kind === "feature") return "feature request";
  return kind;
}

function buildTemplatePrompt(feedback: FeedbackPromptSource): string {
  const baseRef = getCursorBaseRef();
  const parts = [
    `Implement the following user ${kindLabel(feedback.kind)} in the Product Agent Next.js app.`,
    "",
    `## Feedback`,
    `- ID: ${feedback.id}`,
    `- Kind: ${feedback.kind}`,
    `- Title: ${feedback.title}`,
    feedback.userEmail ? `- Submitted by: ${feedback.userEmail}` : null,
    feedback.body?.trim() ? `- Details:\n${feedback.body.trim()}` : null,
    feedback.screenshotUrl
      ? `- Screenshot: ${feedback.screenshotUrl}`
      : null,
    "",
    `## Requirements`,
    `- Work from the \`${baseRef}\` branch and open a PR targeting \`${baseRef}\`.`,
    "- Scope the change tightly to this feedback; do not refactor unrelated code.",
    "- Match existing patterns, UI components, and naming in the repo.",
    "- Prefer small, reviewable diffs with clear commit messages.",
    "",
    `## Quality gates (required before finishing)`,
    "- Rebase/merge \`${baseRef}\` so the PR has no merge conflicts.",
    "- Run `pnpm typecheck` and fix any TypeScript errors you introduced.",
    "- Run `pnpm lint` and fix new lint issues in files you touched (pre-existing baseline issues elsewhere may remain).",
    "- If you changed app code that affects the build, run `pnpm build` (or the narrowest check that proves the change compiles) and fix build errors.",
    "- Do not leave the PR in a broken state.",
    "",
    `## Delivery`,
    `- Open a PR into \`${baseRef}\` with a clear title and summary referencing feedback ${feedback.id}.`,
    "- Mark the PR ready for review when checks look good.",
  ];

  return parts.filter((line) => line !== null).join("\n");
}

export async function generateFeedbackAgentPrompt(
  feedback: FeedbackPromptSource,
): Promise<string> {
  const template = buildTemplatePrompt(feedback);

  if (!hasAiGateway()) {
    return template;
  }

  try {
    const result = await generateText({
      model: FEEDBACK_PROMPT_MODEL,
      system: `You turn product feedback into a detailed implementation prompt for a Cursor cloud coding agent.

Rules:
- Output ONLY the prompt text the agent should follow (no preamble, no markdown fences around the whole response).
- Be concrete and actionable: files/areas to inspect, acceptance criteria, edge cases, and out-of-scope notes.
- Preserve the feedback ID and title.
- The agent must open a PR into the configured base branch (usually \`dev\`).
- Explicitly require: no merge conflicts with the base branch, and no TypeScript/build failures from the change (run typecheck/lint/build as needed and fix issues).
- Stay within the product (Next.js App Router + Supabase). Do not invent unrelated features.
- If a screenshot URL is provided, instruct the agent to use it as visual context for the bug/UI issue.
- Keep the prompt under ~2500 words.`,
      prompt: `Expand this feedback into a detailed agent prompt.

Feedback ID: ${feedback.id}
Kind: ${feedback.kind}
Title: ${feedback.title}
Submitter: ${feedback.userEmail ?? "unknown"}
Body:
${feedback.body?.trim() || "(none)"}
Screenshot URL: ${feedback.screenshotUrl ?? "(none)"}
Base branch: ${getCursorBaseRef()}

Seed outline (improve and flesh out, keep quality gates):
${template}`,
    });

    const text = result.text?.trim();
    if (text && text.length > 80) return text;
  } catch (err) {
    console.error("[feedback] prompt generation failed, using template", err);
  }

  return template;
}

export function wrapPromptForCloudAgent(input: {
  feedbackId: string;
  prompt: string;
}): string {
  const baseRef = getCursorBaseRef();
  return [
    input.prompt.trim(),
    "",
    "---",
    "Operational constraints (do not skip):",
    `- Base branch / PR target: \`${baseRef}\``,
    `- Feedback ID: ${input.feedbackId}`,
    "- Ensure the branch has no merge conflicts with the base branch before finishing.",
    "- Ensure the change does not introduce build or TypeScript errors; fix any you cause.",
    "- Create/update the pull request into the base branch when done.",
  ].join("\n");
}
