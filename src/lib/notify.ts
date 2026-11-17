import "server-only";
import webpush from "web-push";

// Sending push notifications (Web Push with VAPID keys) and email (Resend).
// Each part switches on only when its keys are set, so the app runs fine
// without them.

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = "sent" | "gone" | "failed";

export function notificationsConfigured() {
  return {
    push: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
    email: !!(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM_EMAIL),
  };
}

let vapidSet = false;

export async function sendPush(
  target: PushTarget,
  message: { title: string; body: string; url: string },
): Promise<PushResult> {
  if (!notificationsConfigured().push) return "failed";
  if (!vapidSet) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      { TTL: 12 * 60 * 60, urgency: "normal" },
    );
    return "sent";
  } catch (error) {
    // 404 / 410: the phone unsubscribed or the app was removed. Forget it.
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  if (!notificationsConfigured().email) return false;
  // RESEND_API_URL only exists so the job can be tested against a local stand-in.
  const base = process.env.RESEND_API_URL ?? "https://api.resend.com";
  const res = await fetch(`${base}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM_EMAIL, ...message }),
  });
  return res.ok;
}

/** The address links in notifications point to. */
export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
