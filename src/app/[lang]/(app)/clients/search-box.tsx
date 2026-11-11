"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";

/** Updates ?q= as you type (after a short pause), keeping the current filter. */
export function SearchBox({ placeholder, initial }: { placeholder: string; initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function update(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sp = new URLSearchParams(params);
      if (next.trim()) sp.set("q", next.trim());
      else sp.delete("q");
      sp.delete("limit");
      startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false }));
    }, 300);
  }

  return (
    <form role="search" onSubmit={(e) => e.preventDefault()} className="relative">
      <Icon name="search" size={20} className="pointer-events-none absolute top-3.5 left-3 text-muted" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-md border border-border bg-surface pr-3 pl-10 text-body outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary-soft"
      />
      {pending && <span className="absolute top-4 right-3 size-4 animate-spin rounded-full border-2 border-border border-t-primary" />}
    </form>
  );
}
