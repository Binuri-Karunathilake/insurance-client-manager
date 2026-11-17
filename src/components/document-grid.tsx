import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";
import type { DocumentRow } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { ConfirmButton } from "./confirm-button";
import { Icon } from "./icons";
import { deleteDocumentAction } from "@/app/[lang]/(app)/documents/actions";

// Figma "Document tile" grid. Thumbnails and taps go through the private
// file route, which hands out a short-lived storage link each time.

export function DocumentGrid({
  docs,
  lang,
  dict,
  clientNames,
}: {
  docs: DocumentRow[];
  lang: Locale;
  dict: Pick<Dictionary, "documents" | "calendar">;
  /** On the Documents screen, show whose document it is. */
  clientNames?: Record<string, string>;
}) {
  const t = dict.documents;
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {docs.map((d) => {
        const href = `/${lang}/documents/file/${d.id}`;
        const isImage = d.mime_type.startsWith("image/");
        const meta = [clientNames?.[d.client_id], formatDate(d.created_at, dict.calendar, lang)].filter(Boolean).join(" · ");
        return (
          <li key={d.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
            <a href={href} target="_blank" rel="noopener" className="block overflow-hidden rounded-md bg-bg" aria-label={`${t.open}: ${d.title}`}>
              {isImage ? (
                // Short-lived private link; next/image would cache it on the server.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={href} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center text-muted">
                  <Icon name="file" size={28} />
                </span>
              )}
            </a>
            <div className="flex min-w-0 flex-col gap-0.5 px-1">
              <span className="truncate text-body font-medium">{d.title}</span>
              <span className="truncate text-caption text-muted">{meta}</span>
            </div>
            <div className="flex justify-end">
              <ConfirmButton
                action={deleteDocumentAction}
                fields={{ document_id: d.id }}
                label={t.remove}
                confirmLabel={t.confirmRemove}
                icon="trash"
                confirmVariant="danger"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
