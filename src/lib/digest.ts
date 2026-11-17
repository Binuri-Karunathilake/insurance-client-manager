// The morning summary: a short push notification and a fuller email.
// Pure functions, so the job and the "Send a test" button build the same
// message, and it can be tested without sending anything.

import en from "./dictionaries/en.json";
import si from "./dictionaries/si.json";
import { formatDate, formatMoney } from "./format";
import { fill } from "./text";
import type { DueKind, PolicyType } from "./types";

export type DigestItem = {
  kind: DueKind;
  days_left: number;
  due_on: string;
  client_name: string;
  policy_type: PolicyType | null;
  premium: number | null;
  member_name: string | null;
  note: string | null;
};

export type Digest = {
  pushTitle: string;
  pushBody: string;
  subject: string;
  html: string;
  text: string;
};

const dictionaries = { en, si } as const;

function plural(n: number, one: string, many: string) {
  return fill(n === 1 ? one : many, { n });
}

function describe(item: DigestItem, lang: "en" | "si") {
  const d = dictionaries[lang];
  const t = d.digest;
  const type = item.policy_type ? d.policyTypes[item.policy_type] : "";
  switch (item.kind) {
    case "premium":
      return fill(t.premium, { type, amount: item.premium != null ? formatMoney(item.premium, lang) : "" });
    case "renewal":
      return fill(t.renewal, { type });
    case "birthday":
      return item.member_name ? fill(t.familyBirthday, { member: item.member_name }) : t.birthday;
    default:
      return fill(t.followUp, { note: item.note ?? "" });
  }
}

function when(item: DigestItem, lang: "en" | "si") {
  const r = dictionaries[lang].reminders;
  if (item.days_left < -1) return fill(r.daysLate, { n: -item.days_left });
  if (item.days_left === -1) return r.dayLate;
  if (item.days_left === 0) return r.today;
  if (item.days_left === 1) return r.tomorrow;
  return fill(r.inDays, { n: item.days_left });
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Builds the morning message, or null when there's nothing to say (no
 * message is better than a daily "nothing today").
 */
export function buildDigest(
  items: DigestItem[],
  { lang, today, agentName, appUrl }: { lang: "en" | "si"; today: string; agentName: string | null; appUrl: string },
): Digest | null {
  if (items.length === 0) return null;
  const d = dictionaries[lang];
  const t = d.digest;

  const overdue = items.filter((i) => i.days_left < 0);
  const todayItems = items.filter((i) => i.days_left === 0);
  const week = items.filter((i) => i.days_left > 0 && i.days_left <= 7);
  const month = items.filter((i) => i.days_left > 7);

  // Summary counts what's due in the next 7 days, plus anything late.
  const soon = items.filter((i) => i.days_left <= 7);
  const count = (k: DueKind) => soon.filter((i) => i.kind === k && i.days_left >= 0).length;
  const parts = [
    count("premium") && plural(count("premium"), t.summaryPremium, t.summaryPremiums),
    count("renewal") && plural(count("renewal"), t.summaryRenewal, t.summaryRenewals),
    count("birthday") && plural(count("birthday"), t.summaryBirthday, t.summaryBirthdays),
    count("follow_up") && plural(count("follow_up"), t.summaryFollowUp, t.summaryFollowUps),
    overdue.length && fill(t.summaryOverdue, { n: overdue.length }),
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null; // only renewals far ahead: wait for them to come closer
  const summary = parts.join(" · ");

  const line = (i: DigestItem) => `${i.client_name} – ${describe(i, lang)} (${when(i, lang)})`;
  const pushLines = [...overdue, ...todayItems, ...week].slice(0, 3).map(line);
  const extra = overdue.length + todayItems.length + week.length - pushLines.length;
  if (extra > 0) pushLines.push(fill(t.more, { n: extra }));

  const groups: [string, DigestItem[]][] = [
    [t.overdue, overdue],
    [t.today, todayItems],
    [t.week, week],
    [t.month, month.filter((i) => i.kind === "renewal")],
  ];
  const link = `${appUrl.replace(/\/$/, "")}/${lang}/reminders`;
  const greeting = fill(t.greeting, { name: agentName ? `, ${agentName}` : "" });
  const dateLabel = formatDate(today, d.calendar, lang);

  const text = [
    greeting,
    t.intro,
    "",
    ...groups.flatMap(([title, list]) => (list.length ? [title.toUpperCase(), ...list.map((i) => `• ${line(i)}`), ""] : [])),
    `${t.open}: ${link}`,
    "",
    t.footer,
  ].join("\n");

  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:24px 12px;background:#f4f5f7;font-family:Inter,'Noto Sans Sinhala',Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e5ea;border-radius:16px;padding:24px">
<p style="margin:0 0 4px;font-size:13px;color:#6b7280">${escape(dateLabel)}</p>
<h1 style="margin:0 0 8px;font-size:20px;line-height:28px">${escape(greeting)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:22px">${escape(t.intro)}</p>
${groups
  .filter(([, list]) => list.length)
  .map(
    ([title, list]) => `<h2 style="margin:20px 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${title === t.overdue ? "#b91c1c" : "#6b7280"}">${escape(title)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${list
      .map(
        (i) => `<tr><td style="padding:8px 0;border-top:1px solid #e2e5ea;font-size:15px;line-height:22px"><strong>${escape(i.client_name)}</strong><br><span style="color:#6b7280;font-size:13px">${escape(describe(i, lang))}</span></td><td align="right" style="padding:8px 0;border-top:1px solid #e2e5ea;font-size:13px;color:${i.days_left < 0 ? "#b91c1c" : "#6b7280"};white-space:nowrap">${escape(when(i, lang))}</td></tr>`,
      )
      .join("")}</table>`,
  )
  .join("\n")}
<p style="margin:24px 0 0"><a href="${escape(link)}" style="display:inline-block;background:#2346b8;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:12px">${escape(t.open)}</a></p>
</div>
<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#6b7280;text-align:center">${escape(t.footer)}</p>
</body></html>`;

  return {
    pushTitle: fill(t.pushTitle, { summary }),
    pushBody: pushLines.join("\n"),
    subject: fill(t.subject, { date: dateLabel, summary }),
    html,
    text,
  };
}
