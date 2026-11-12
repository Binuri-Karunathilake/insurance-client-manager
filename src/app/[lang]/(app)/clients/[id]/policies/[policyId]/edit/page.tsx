import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary, getLocale, type Dictionary } from "@/lib/i18n";
import { getClientProfile, listInsurers } from "@/lib/data/clients";
import { colomboToday } from "@/lib/format";
import { fill } from "@/lib/text";
import type { Locale } from "@/lib/locales";
import { Icon } from "@/components/icons";
import { PolicyForm } from "../../policy-form";

export const metadata: Metadata = { title: "Edit policy" };

type Params = PageProps<"/[lang]/clients/[id]/policies/[policyId]/edit">["params"];

export default async function EditPolicyPage({ params }: { params: Params }) {
  const [lang, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Suspense fallback={<div className="h-[32rem] animate-pulse rounded-lg border border-border bg-surface" />}>
        <EditPolicy lang={lang} dict={dict} params={params} />
      </Suspense>
    </div>
  );
}

async function EditPolicy({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Params }) {
  const { id, policyId } = await params;
  const [result, insurers] = await Promise.all([getClientProfile(id), listInsurers()]);
  const policy = result?.client.policies.find((p) => p.id === policyId);
  if (!result || !policy) {
    return <p className="rounded-lg border border-border bg-surface p-6 text-body text-muted">{dict.profile.notFound}</p>;
  }
  const back = `/${lang}/clients/${id}`;

  return (
    <>
      <header className="flex items-center gap-3">
        <Link href={back} aria-label={result.client.full_name} className="-ml-2 rounded-md p-2 hover:bg-surface">
          <Icon name="arrow-left" />
        </Link>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title">{dict.policyForm.editTitle}</h1>
          <p className="truncate text-caption text-muted">
            {fill(dict.policyForm.forClient, { name: result.client.full_name })} · {policy.policy_number}
          </p>
        </div>
      </header>
      <PolicyForm
        lang={lang}
        dict={{ policyForm: dict.policyForm, policyTypes: dict.policyTypes, policy: dict.policy, calendar: dict.calendar }}
        clientId={id}
        insurers={insurers}
        today={colomboToday()}
        policy={policy}
        cancelHref={back}
      />
    </>
  );
}
