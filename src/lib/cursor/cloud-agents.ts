import { createHmac, timingSafeEqual } from "node:crypto";

/** Cursor Cloud Agents API (v0 — supports launch-time webhooks). */

const CURSOR_API_BASE = "https://api.cursor.com";

export type CursorAgentStatus =
  | "CREATING"
  | "RUNNING"
  | "FINISHED"
  | "ERROR"
  | "EXPIRED"
  | string;

export type CursorAgentLaunchResult = {
  id: string;
  name: string;
  status: CursorAgentStatus;
  source: {
    repository: string;
    ref?: string;
  };
  target: {
    branchName?: string;
    url?: string;
    prUrl?: string;
    autoCreatePr?: boolean;
  };
  createdAt?: string;
};

export type CursorAgentDetails = CursorAgentLaunchResult & {
  summary?: string;
};

function getCursorApiKey(): string {
  const key = process.env.CURSOR_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "CURSOR_API_KEY is not configured. Create a key at Cursor Dashboard → API Keys.",
    );
  }
  return key;
}

function authHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

export function getCursorRepoUrl(): string {
  const url =
    process.env.CURSOR_GITHUB_REPO_URL?.trim() ||
    process.env.GITHUB_REPO_URL?.trim();
  if (!url) {
    throw new Error(
      "CURSOR_GITHUB_REPO_URL is not configured (e.g. https://github.com/org/repo).",
    );
  }
  return url.replace(/\.git$/, "").replace(/\/$/, "");
}

export function getCursorBaseRef(): string {
  return process.env.CURSOR_AGENT_BASE_REF?.trim() || "dev";
}

export function hasCursorCloudAgents(): boolean {
  return Boolean(process.env.CURSOR_API_KEY?.trim());
}

export function getCursorWebhookSecret(): string | undefined {
  const secret = process.env.CURSOR_WEBHOOK_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : undefined;
}

export function buildFeedbackAgentBranchName(feedbackId: string): string {
  const short = feedbackId.replace(/-/g, "").slice(0, 10);
  return `cursor/feedback-${short}`;
}

export async function launchCursorCloudAgent(input: {
  prompt: string;
  name?: string;
  branchName?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  images?: Array<{ data: string; width: number; height: number }>;
}): Promise<CursorAgentLaunchResult> {
  const apiKey = getCursorApiKey();
  const repository = getCursorRepoUrl();
  const ref = getCursorBaseRef();

  const body: Record<string, unknown> = {
    prompt: {
      text: input.prompt,
      ...(input.images && input.images.length > 0
        ? {
            images: input.images.map((img) => ({
              data: img.data,
              dimension: { width: img.width, height: img.height },
            })),
          }
        : {}),
    },
    model: process.env.CURSOR_AGENT_MODEL?.trim() || "default",
    source: {
      repository,
      ref,
    },
    target: {
      autoCreatePr: true,
      openAsCursorGithubApp: true,
      skipReviewerRequest: true,
      ...(input.branchName ? { branchName: input.branchName } : {}),
    },
  };

  if (input.name) {
    body.name = input.name.slice(0, 100);
  }

  if (input.webhookUrl) {
    const secret = input.webhookSecret ?? getCursorWebhookSecret();
    body.webhook = {
      url: input.webhookUrl,
      ...(secret ? { secret } : {}),
    };
  }

  const res = await fetch(`${CURSOR_API_BASE}/v0/agents`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as
    | CursorAgentLaunchResult
    | { error?: string; message?: string };

  if (!res.ok) {
    const message =
      ("error" in json && json.error) ||
      ("message" in json && json.message) ||
      `Cursor API error (${res.status})`;
    throw new Error(String(message));
  }

  return json as CursorAgentLaunchResult;
}

export async function getCursorCloudAgent(
  agentId: string,
): Promise<CursorAgentDetails> {
  const apiKey = getCursorApiKey();
  const res = await fetch(
    `${CURSOR_API_BASE}/v0/agents/${encodeURIComponent(agentId)}`,
    {
      headers: {
        Authorization: authHeader(apiKey),
      },
    },
  );

  const json = (await res.json().catch(() => ({}))) as
    | CursorAgentDetails
    | { error?: string; message?: string };

  if (!res.ok) {
    const message =
      ("error" in json && json.error) ||
      ("message" in json && json.message) ||
      `Cursor API error (${res.status})`;
    throw new Error(String(message));
  }

  return json as CursorAgentDetails;
}

export function parsePrNumber(prUrl: string | null | undefined): number | null {
  if (!prUrl) return null;
  const match = prUrl.match(/\/pull\/(\d+)(?:\/|$|\?)/);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function verifyCursorWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expectedHex = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.replace(/^sha256=/, "").trim();
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
