import { toPng } from "html-to-image";

export type FeedbackPin = {
  x: number;
  y: number;
  radius: number;
};

const FEEDBACK_UI_ATTR = "data-feedback-ui";

function isFeedbackUiNode(node: HTMLElement): boolean {
  return Boolean(node.closest(`[${FEEDBACK_UI_ATTR}]`));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load screenshot"));
    img.src = src;
  });
}

/** Capture the viewport and draw a red circle around the pin. */
export async function captureFeedbackScreenshot(
  pin: FeedbackPin,
): Promise<Blob> {
  const root = document.documentElement;
  const dataUrl = await toPng(root, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !isFeedbackUiNode(node);
    },
  });

  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas");

  ctx.drawImage(img, 0, 0);

  const scaleX = img.naturalWidth / window.innerWidth;
  const scaleY = img.naturalHeight / window.innerHeight;
  const cx = pin.x * scaleX;
  const cy = pin.y * scaleY;
  const r = pin.radius * ((scaleX + scaleY) / 2);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
  ctx.fill();
  ctx.lineWidth = Math.max(3, 3 * ((scaleX + scaleY) / 2));
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();

  // Crosshair at center
  const tick = Math.max(8, r * 0.15);
  ctx.beginPath();
  ctx.moveTo(cx - tick, cy);
  ctx.lineTo(cx + tick, cy);
  ctx.moveTo(cx, cy - tick);
  ctx.lineTo(cx, cy + tick);
  ctx.stroke();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to encode screenshot");
  return blob;
}

export { FEEDBACK_UI_ATTR };
