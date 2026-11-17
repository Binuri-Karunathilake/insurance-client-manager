"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n";
import { DOCUMENT_LABELS, MAX_BYTES, type DocumentLabel } from "@/lib/documents";
import { shrinkImage } from "@/lib/shrink-image";
import { createClient } from "@/lib/supabase/client";
import { fill } from "@/lib/text";
import { Button } from "@/components/button";
import { ErrorText, Field, SelectField, SuccessText } from "@/components/form";
import { finalizeUploadAction, prepareUploadAction } from "./actions";

type T = Dictionary["documents"];
type Step = "idle" | "ready" | "shrinking" | "uploading" | "saving";
type ErrorKey = keyof T["errors"];

/**
 * Take photo / Upload file, then confirm what it is and save. With
 * `clientId` it files under that client; with `clients` it asks which.
 */
export function Uploader({
  t,
  clientId,
  clients,
}: {
  t: T;
  clientId?: string;
  clients?: { id: string; full_name: string }[];
}) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [label, setLabel] = useState<DocumentLabel>("nic");
  const [title, setTitle] = useState(t.labels.nic);
  const [titleEdited, setTitleEdited] = useState(false);
  const [chosenClient, setChosenClient] = useState(clientId ?? "");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function choose(f: File | undefined) {
    if (!f) return;
    setSaved(null);
    setError(null);
    const isPdf = f.type === "application/pdf";
    if (!isPdf && !f.type.startsWith("image/")) return setError("type");
    if (isPdf && f.size > MAX_BYTES) return setError("size");
    setFile(f);
    setPreview(isPdf ? null : URL.createObjectURL(f));
    setStep("ready");
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setStep("idle");
    setLabel("nic");
    setTitle(t.labels.nic);
    setTitleEdited(false);
    if (!clientId) setChosenClient("");
    if (camera.current) camera.current.value = "";
    if (picker.current) picker.current.value = "";
  }

  async function save() {
    if (!file) return;
    if (!chosenClient) return setError("client");
    setError(null);
    try {
      let body: Blob = file;
      let mime = file.type;
      if (mime.startsWith("image/")) {
        setStep("shrinking");
        try {
          body = await shrinkImage(file);
          mime = body.type || "image/jpeg";
        } catch {
          setStep("ready");
          return setError("read");
        }
      }
      if (body.size > MAX_BYTES) {
        setStep("ready");
        return setError("size");
      }

      setStep("uploading");
      const prepared = await prepareUploadAction({ clientId: chosenClient, mime, size: body.size });
      if (!prepared.ok) {
        setStep("ready");
        return setError(prepared.error);
      }
      const { error: uploadError } = await createClient()
        .storage.from("documents")
        .uploadToSignedUrl(prepared.path, prepared.token, body, { contentType: mime });
      if (uploadError) throw uploadError;

      setStep("saving");
      const done = await finalizeUploadAction({ clientId: chosenClient, path: prepared.path, label, title, mime, size: body.size });
      if (!done.ok) throw new Error("finalize failed");
      setSaved(title);
      reset();
    } catch {
      setStep("ready");
      setError("generic");
    }
  }

  const busy = step === "shrinking" || step === "uploading" || step === "saving";
  const busyText = step === "shrinking" ? t.shrinking : step === "uploading" ? t.uploading : t.saving;

  return (
    <div className="flex flex-col gap-3">
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />
      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => choose(e.target.files?.[0])}
      />

      {saved && step === "idle" && <SuccessText>{fill(t.saved, { name: saved })}</SuccessText>}
      {error && step !== "ready" && <ErrorText>{t.errors[error]}</ErrorText>}

      {step === "idle" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button icon="camera" onClick={() => camera.current?.click()}>
            {t.takePhoto}
          </Button>
          <Button variant="outline" icon="upload" onClick={() => picker.current?.click()}>
            {t.uploadFile}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            {preview ? (
              // A local preview of the chosen photo (object URL); next/image can't optimise those.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-20 shrink-0 rounded-md border border-border object-cover" />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-bg text-caption font-medium text-muted">PDF</span>
            )}
            <p className="min-w-0 truncate text-caption text-muted">{file?.name}</p>
          </div>

          {clients && (
            <SelectField label={t.client} value={chosenClient} onChange={(e) => setChosenClient(e.target.value)}>
              <option value="" disabled>
                {t.chooseClient}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField
            label={t.label}
            value={label}
            onChange={(e) => {
              const next = e.target.value as DocumentLabel;
              setLabel(next);
              if (!titleEdited) setTitle(t.labels[next]);
            }}
            hint={label === "medical" ? t.medicalHint : undefined}
          >
            {DOCUMENT_LABELS.map((l) => (
              <option key={l} value={l}>
                {t.labels[l]}
              </option>
            ))}
          </SelectField>

          <Field
            label={t.name}
            value={title}
            maxLength={80}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(true);
            }}
          />

          {error && <ErrorText>{t.errors[error]}</ErrorText>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={reset} disabled={busy}>
              {t.cancel}
            </Button>
            <Button onClick={save} disabled={busy || !title.trim()}>
              {busy ? busyText : t.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
