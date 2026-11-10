import { getDictionary, getLocale } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { LanguageSwitch } from "@/components/session-controls";

export default async function AuthLayout({ children }: LayoutProps<"/[lang]">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary text-label font-semibold text-on-primary">
              CM
            </span>
            <span className="text-heading">{dict.app.name}</span>
          </div>
          <LanguageSwitch lang={lang} label={dict.app.switchLanguage} />
        </div>
        <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-6">{children}</div>
        <p className="flex items-center justify-center gap-2 text-caption text-muted">
          <Icon name="lock" size={16} />
          {dict.app.role}
        </p>
      </div>
    </div>
  );
}
