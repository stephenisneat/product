import { Resend } from "resend";

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

function fromAddress() {
  return process.env.RESEND_FROM || "Product Agent <onboarding@resend.dev>";
}

export async function sendWorkspaceInviteEmail(input: {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}) {
  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Join ${input.workspaceName} on Product Agent`,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 480px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">You're invited</h1>
        <p style="margin: 0 0 12px;">
          <strong>${escapeHtml(input.inviterName)}</strong> invited you to join
          <strong>${escapeHtml(input.workspaceName)}</strong> as
          <strong>${escapeHtml(input.role)}</strong>.
        </p>
        <p style="margin: 0 0 20px;">
          <a href="${escapeHtml(input.inviteUrl)}"
             style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
            Accept invite
          </a>
        </p>
        <p style="margin: 0; color: #666; font-size: 12px;">
          This invite expires in 7 days. If you weren't expecting this, you can ignore it.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send invite email");
  }
}

export async function sendCreativeReviewEmail(input: {
  to: string;
  creativeTitle: string;
  stage: string;
  creativeUrl: string;
}) {
  if (!process.env.RESEND_API_KEY) return;

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Review ready: ${input.creativeTitle} (${input.stage})`,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 480px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">Creative ready for review</h1>
        <p style="margin: 0 0 12px;">
          <strong>${escapeHtml(input.creativeTitle)}</strong> finished the
          <strong>${escapeHtml(input.stage)}</strong> stage and is awaiting review.
        </p>
        <p style="margin: 0 0 20px;">
          <a href="${escapeHtml(input.creativeUrl)}"
             style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
            Open creative
          </a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send creative review email");
  }
}

export async function sendFeedbackFulfilledEmail(input: {
  to: string;
  title: string;
  kind: string;
  prUrl?: string | null;
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      "[email] RESEND_API_KEY unset; skipping feedback fulfillment email",
    );
    return;
  }

  const kindLabel =
    input.kind === "channel_request"
      ? "channel request"
      : input.kind === "bug"
        ? "bug report"
        : input.kind === "feature"
          ? "feature request"
          : "feedback";

  const resend = getResend();
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: input.to,
    subject: `Your feedback was fulfilled: ${input.title}`,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; max-width: 480px;">
        <h1 style="font-size: 18px; margin: 0 0 12px;">Request fulfilled</h1>
        <p style="margin: 0 0 12px;">
          Your ${escapeHtml(kindLabel)}
          <strong>${escapeHtml(input.title)}</strong>
          has been completed and merged.
        </p>
        ${
          input.prUrl
            ? `<p style="margin: 0 0 20px;">
          <a href="${escapeHtml(input.prUrl)}"
             style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">
            View pull request
          </a>
        </p>`
            : ""
        }
        <p style="margin: 0; color: #666; font-size: 12px;">
          Thanks for helping improve Product Agent.
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || "Failed to send fulfillment email");
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
