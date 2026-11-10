import { getDictionary, getLocale } from "@/lib/i18n";
import { BottomNav, SidebarNav } from "@/components/nav";
import { IdleSignOut, LanguageSwitch, SignOutButton } from "@/components/session-controls";

export default async function AppLayout({ children }: LayoutProps<"/[lang]">) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="flex items-center gap-3 pb-6 pl-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-label font-semibold text-on-primary">
            CM
          </span>
          <span className="text-heading">{dict.app.name}</span>
        </div>
        <SidebarNav lang={lang} labels={dict.nav} />
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          <LanguageSwitch lang={lang} label={dict.app.switchLanguage} />
          <SignOutButton lang={lang} label={dict.app.signOut} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-28 md:px-8 md:pt-8 md:pb-8">
        {children}
      </main>

      <BottomNav lang={lang} labels={dict.nav} />
      <IdleSignOut lang={lang} />
    </div>
  );
}
