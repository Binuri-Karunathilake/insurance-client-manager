"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/text";
import { Button } from "@/components/button";
import { Checkbox, ErrorText, SelectField, SuccessText } from "@/components/form";
import { removeDeviceAction, saveDeviceAction, saveSettingsAction, sendTestAction, type SettingsState, type TestResult } from "./actions";

type T = Dictionary["settings"];
type DeviceState = "checking" | "unsupported" | "blocked" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "Android phone" : "Android tablet";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Browser";
}

/** Turns the morning notification on or off for the phone or tablet in use. */
export function DeviceToggle({ t, vapidKey }: { t: T; vapidKey: string }) {
  const [state, setState] = useState<DeviceState>("checking");
  const [busy, startBusy] = useTransition();
  const isIphone = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  const [failed, setFailed] = useState(false);

  const turnOn = () =>
    startBusy(async () => {
      setFailed(false);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
        const json = sub.toJSON();
        const { ok } = await saveDeviceAction({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          label: deviceLabel(),
        });
        if (!ok) await sub.unsubscribe();
        setState(ok ? "on" : "off");
        setFailed(!ok);
      } catch {
        // e.g. no connection to the phone's push service
        setState("off");
        setFailed(true);
      }
    });

  const turnOff = () =>
    startBusy(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removeDeviceAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const message: Record<DeviceState, string> = {
    checking: "…",
    unsupported: t.deviceUnsupported,
    blocked: t.deviceBlocked,
    off: t.deviceOff,
    on: t.deviceOn,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className={`flex-1 text-body ${state === "blocked" ? "text-danger" : state === "on" ? "text-success" : "text-muted"}`}>{message[state]}</p>
        {state === "off" && (
          <Button icon="bell" onClick={turnOn} disabled={busy}>
            {busy ? t.working : t.turnOn}
          </Button>
        )}
        {state === "on" && (
          <Button variant="outline" onClick={turnOff} disabled={busy}>
            {busy ? t.working : t.turnOff}
          </Button>
        )}
      </div>
      {failed && <ErrorText>{t.deviceFailed}</ErrorText>}
      {isIphone && state !== "on" && <p className="text-caption text-muted">{t.iphoneHint}</p>}
    </div>
  );
}

export function PreferencesForm({
  t,
  emailEnabled,
  language,
  email,
}: {
  t: T;
  emailEnabled: boolean;
  language: "si" | "en";
  email: string | null;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Checkbox label={t.emailLabel} name="email_enabled" defaultChecked={emailEnabled} />
        {email && <p className="pl-8 text-caption text-muted">{fill(t.emailTo, { email })}</p>}
      </div>
      <SelectField label={t.languageLabel} name="language" defaultValue={language}>
        <option value="si">සිංහල</option>
        <option value="en">English</option>
      </SelectField>
      {state.saved && !pending && <SuccessText>{t.saved}</SuccessText>}
      {state.error && <ErrorText>{t.testFailed}</ErrorText>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t.saving : t.save}
      </Button>
    </form>
  );
}

export function SendTest({ t }: { t: T }) {
  const [result, setResult] = useState<TestResult | null>(null);
  const [busy, startBusy] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" icon="bell" className="self-start" disabled={busy} onClick={() => startBusy(async () => setResult(await sendTestAction()))}>
        {busy ? t.working : t.test}
      </Button>
      {result?.status === "sent" && <SuccessText>{fill(t.testSent, { push: result.push, email: result.email })}</SuccessText>}
      {result?.status === "nothing" && <p className="text-caption text-muted">{t.testNothing}</p>}
      {result?.status === "failed" && <ErrorText>{t.testFailed}</ErrorText>}
    </div>
  );
}
