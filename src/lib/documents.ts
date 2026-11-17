// Shared by the uploader (browser) and the server checks.

export const DOCUMENT_LABELS = ["nic", "proposal", "policy", "vehicle", "medical", "receipt", "other"] as const;
export type DocumentLabel = (typeof DOCUMENT_LABELS)[number];

/** Same list as the storage bucket allows (see the first migration). */
export const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const MAX_BYTES = 10 * 1024 * 1024;

export type DocumentRow = {
  id: string;
  client_id: string;
  label: DocumentLabel;
  title: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};
