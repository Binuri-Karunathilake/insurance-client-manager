// Excel import: matching columns, reading cells and planning what to add.
// Pure functions (no database, no files), so the same rules are easy to
// test and run identically for the preview and the real import.

import { formatPhone, normaliseNic, normalisePhone } from "./phone";
import { RENEWS_YEARLY, nextDueDate, nextRenewalDate } from "./policy-dates";
import type { PaymentFrequency, PolicyStatus, PolicyType } from "./types";

export const MAX_ROWS = 3000;

export const CLIENT_FIELDS = ["full_name", "mobile", "whatsapp", "nic", "date_of_birth", "address", "preferred_language"] as const;
export const POLICY_FIELDS = [
  "insurer",
  "type",
  "policy_number",
  "sum_assured",
  "premium",
  "frequency",
  "start_date",
  "next_due_date",
  "renewal_date",
  "status",
] as const;
export const FIELDS = [...CLIENT_FIELDS, ...POLICY_FIELDS] as const;
export type FieldKey = (typeof FIELDS)[number];

/** Which file column (index) feeds each field; missing = not in the file. */
export type Mapping = Partial<Record<FieldKey, number>>;

// Headings people use for each field, in English and Sinhala. Compared
// after lower-casing and dropping spaces and punctuation. The template's own
// headings (dictionary "import.fields") are in this list.
const ALIASES: Record<FieldKey, string[]> = {
  full_name: ["name", "full name", "client", "client name", "customer", "customer name", "insured", "policy holder", "policyholder", "නම", "සම්පූර්ණ නම", "ගනුදෙනුකරු", "ගනුදෙනුකරුගේ නම"],
  mobile: ["mobile", "mobile no", "mobile number", "phone", "phone no", "phone number", "tel", "telephone", "contact", "contact no", "contact number", "ජංගම", "ජංගම දුරකථනය", "ජංගම අංකය", "දුරකථනය", "දුරකථන අංකය"],
  whatsapp: ["whatsapp", "whatsapp no", "whatsapp number", "wa"],
  nic: ["nic", "nic no", "nic number", "id", "id no", "id number", "national id", "identity card", "හැඳුනුම්පත", "හැඳුනුම්පත් අංකය", "ජාතික හැඳුනුම්පත"],
  date_of_birth: ["date of birth", "dob", "birthday", "birth date", "born", "උපන් දිනය", "උපන්දිනය"],
  address: ["address", "home address", "ලිපිනය"],
  preferred_language: ["language", "preferred language", "භාෂාව"],
  insurer: ["insurer", "insurance company", "company", "insurance", "රක්ෂණ සමාගම", "සමාගම"],
  type: ["type", "policy type", "class", "cover", "වර්ගය", "ඔප්පු වර්ගය"],
  policy_number: ["policy no", "policy number", "policy", "policy num", "ඔප්පු අංකය", "ඔප්පුව"],
  sum_assured: ["sum assured", "sum insured", "cover amount", "රක්ෂිත මුදල"],
  premium: ["premium", "premium rs", "premium amount", "installment", "instalment", "වාරිකය", "වාරික මුදල"],
  frequency: ["pays", "frequency", "mode", "payment mode", "payment frequency", "ගෙවන්නේ", "ගෙවීම් ක්‍රමය"],
  start_date: ["start date", "start", "commencement date", "commencement", "issue date", "date of commencement", "ආරම්භක දිනය", "ආරම්භ දිනය"],
  next_due_date: ["next due", "next due date", "due date", "due", "ඊළඟ ගෙවීම", "ගෙවිය යුතු දිනය"],
  renewal_date: ["renewal", "renewal date", "expiry", "expiry date", "අලුත් කිරීම", "අලුත් කරන දිනය"],
  status: ["status", "policy status", "තත්ත්වය"],
};

const key = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, "");
const aliasIndex = new Map<string, FieldKey>(
  (Object.entries(ALIASES) as [FieldKey, string[]][]).flatMap(([field, names]) => names.map((n) => [key(n), field] as const)),
);

/** Best guess at which column is which, from the heading row. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  headers.forEach((h, i) => {
    const field = aliasIndex.get(key(h));
    if (field && mapping[field] === undefined) mapping[field] = i;
  });
  return mapping;
}

/** The template's headings must always be recognised; used by the tests. */
export function recognises(heading: string): FieldKey | undefined {
  return aliasIndex.get(key(heading));
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31 Feb
  return date.toISOString().slice(0, 10);
}

function fullYear(y: number, today: string): number {
  if (y >= 100) return y;
  const thisYear = +today.slice(2, 4);
  return y > thisYear ? 1900 + y : 2000 + y;
}

/**
 * A date as people type it in Sri Lanka: 14/03/1979, 14-03-1979, 14.03.1979,
 * 1979-03-14, 14 Mar 1979, 14-Mar-79, or an Excel date number. Day comes
 * before month. "" if empty, null if it can't be read.
 */
export function parseDate(raw: string, today: string): string | "" | null {
  const s = raw.trim();
  if (!s) return "";
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) return iso(fullYear(+m[3], today), +m[2], +m[1]);
  if ((m = s.match(/^(\d{1,2})[-/. ]([a-z]{3,9})[-/., ]+(\d{2}|\d{4})$/i))) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? iso(fullYear(+m[3], today), month, +m[1]) : null;
  }
  // Excel stores dates as days since 30 Dec 1899.
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const days = Math.floor(+s);
    if (days > 0 && days < 80000) return new Date(Date.UTC(1899, 11, 30 + days)).toISOString().slice(0, 10);
  }
  return null;
}

/** "Rs. 1,500,000.00" -> 1500000. "" if empty, null if not a number. */
export function parseMoney(raw: string): number | "" | null {
  const s = raw.replace(/rs\.?|රු\.?|lkr|,|\s/gi, "");
  if (!s) return "";
  return /^\d{1,12}(\.\d{1,2})?$/.test(s) ? Number(s) : null;
}

function pick<T extends string>(raw: string, table: [RegExp, T][]): T | null {
  const s = raw.trim().toLowerCase();
  for (const [pattern, value] of table) if (pattern.test(s)) return value;
  return null;
}

export function parseFrequency(raw: string): PaymentFrequency | null {
  // Whole-cell matches, so "sometimes" isn't read as "s" (single).
  return pick(raw.replace(/[.]/g, "").replace(/\s+/g, " "), [
    [/^(m|monthly|month|per month|\/ ?month|every month|මාසික|මාසිකව|මසකට|\/ ?මසකට)$/, "monthly"],
    [/^(q|quarterly|quarter|every 3 months|3 months|කාර්තුමය|මාස 3කට වරක්|කාර්තුවකට|\/ ?කාර්තුවකට|මාස 3කට)$/, "quarterly"],
    [/^(h|hy|half[- ]?yearly|half[- ]?year|semi[- ]?annual(ly)?|every 6 months|6 months|අර්ධ වාර්ෂික|මාස 6කට වරක්|මාස 6කට|\/ ?මාස 6කට)$/, "half_yearly"],
    [/^(y|a|yearly|annual|annually|year|per year|\/ ?year|every year|වාර්ෂික|වාර්ෂිකව|වසරකට|\/ ?වසරකට)$/, "yearly"],
    [/^(s|single|single premium|once|one time|එක් වරක්|එක් වරක් ගෙවීම|තනි වාරිකය)$/, "single"],
  ]);
}

export function parseType(raw: string): PolicyType | null {
  return pick(raw, [
    [/life|ජීවිත/, "life"],
    [/motor|vehicle|car|bike|van|lorry|three ?wheel|මෝටර්|වාහන/, "motor"],
    [/health|medical|hospital|surgical|සෞඛ්‍ය|සෞඛ්ය|වෛද්‍ය/, "health"],
    [/property|fire|home|house|building|දේපල|දේපළ|ගිනි|නිවාස/, "property"],
    [/other|වෙනත්/, "other"],
  ]);
}

export function parseStatus(raw: string): PolicyStatus | null {
  return pick(raw, [
    [/^(active|in ?force|current|ක්‍රියාත්මක)/, "active"],
    [/^(pending|proposal|new|අපේක්ෂිත)/, "pending"],
    [/^(lapsed|lapse|අවලංගු)/, "lapsed"],
    [/^(matured|maturity|කල් පිරුණ)/, "matured"],
    [/^(cancel|surrender|අහෝසි)/, "cancelled"],
  ]);
}

function parseLanguage(raw: string): "si" | "en" | null {
  return pick(raw, [
    [/^(si|sinhala|සිංහල)$/, "si"],
    [/^(en|english|ඉංග්‍රීසි)$/, "en"],
  ]);
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Problem keys; dictionary "import.problems" has the wording. */
export type Problem =
  | "nameMissing"
  | "mobileInvalid"
  | "whatsappInvalid"
  | "nicInvalid"
  | "dobInvalid"
  | "typeInvalid"
  | "premiumInvalid"
  | "sumInvalid"
  | "frequencyInvalid"
  | "dateInvalid"
  | "startMissing"
  | "dueBeforeStart"
  | "statusInvalid"
  | "policyRepeated"
  | "policyTaken";

export type ClientRecord = {
  full_name: string;
  mobile: string;
  whatsapp: string | null;
  nic: string | null;
  date_of_birth: string | null;
  address: string | null;
  preferred_language: "si" | "en";
};

export type PolicyRecord = {
  insurer: string | null;
  policy_number: string;
  type: PolicyType;
  sum_assured: number | null;
  premium: number;
  frequency: PaymentFrequency;
  start_date: string;
  next_due_date: string | null;
  renewal_date: string | null;
  status: PolicyStatus;
};

export type ReadRow = { row: number; name: string; client: ClientRecord | null; policy: PolicyRecord | null; problems: Problem[] };

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** One spreadsheet row -> a client and maybe a policy, or the problems found. */
export function readRow(cells: string[], mapping: Mapping, row: number, today: string): ReadRow {
  const get = (f: FieldKey) => (mapping[f] === undefined ? "" : clean(cells[mapping[f]!]));
  const problems: Problem[] = [];

  const full_name = get("full_name");
  if (!full_name || full_name.length > 120) problems.push("nameMissing");

  const mobileRaw = get("mobile");
  if (!normalisePhone(mobileRaw)) problems.push("mobileInvalid");

  const whatsappRaw = get("whatsapp");
  if (whatsappRaw && !normalisePhone(whatsappRaw)) problems.push("whatsappInvalid");
  const sameAsMobile = !whatsappRaw || normalisePhone(whatsappRaw) === normalisePhone(mobileRaw);

  const nicRaw = get("nic");
  const nic = nicRaw ? normaliseNic(nicRaw) : null;
  if (nicRaw && !nic) problems.push("nicInvalid");

  const dob = parseDate(get("date_of_birth"), today);
  if (dob === null || (dob && dob > today)) problems.push("dobInvalid");

  const client: ClientRecord = {
    full_name,
    mobile: formatPhone(mobileRaw),
    whatsapp: sameAsMobile ? null : formatPhone(whatsappRaw),
    nic,
    date_of_birth: dob || null,
    address: get("address").slice(0, 300) || null,
    preferred_language: parseLanguage(get("preferred_language")) ?? "si",
  };

  // A policy only when the row has a policy number.
  let policy: PolicyRecord | null = null;
  const policy_number = get("policy_number").toUpperCase().slice(0, 40);
  if (policy_number) {
    const typeRaw = get("type");
    const type = typeRaw ? parseType(typeRaw) : "other";
    if (!type) problems.push("typeInvalid");

    const premium = parseMoney(get("premium"));
    if (premium === "" || premium === null || premium <= 0) problems.push("premiumInvalid");
    const sum = parseMoney(get("sum_assured"));
    if (sum === null) problems.push("sumInvalid");

    // If "Pays" is empty: life policies are usually monthly, the rest yearly.
    const freqRaw = get("frequency");
    const frequency = freqRaw ? parseFrequency(freqRaw) : type === "life" ? "monthly" : "yearly";
    if (!frequency) problems.push("frequencyInvalid");

    const statusRaw = get("status");
    const status = statusRaw ? parseStatus(statusRaw) : "active";
    if (!status) problems.push("statusInvalid");

    const start = parseDate(get("start_date"), today);
    const due = parseDate(get("next_due_date"), today);
    const renewal = parseDate(get("renewal_date"), today);
    if (start === null || due === null || renewal === null) problems.push("dateInvalid");
    // No start date: count from the next due date, which falls on the same day of the month.
    const startDate = start || due || null;
    if (start === "" && !due) problems.push("startMissing");
    if (startDate && ((due && due < startDate) || (renewal && renewal < startDate))) problems.push("dueBeforeStart");

    if (type && frequency && status && startDate && typeof premium === "number" && premium > 0 && sum !== null) {
      // Same rules as the policy form: dates follow the start date unless given.
      const next_due_date = frequency === "single" ? null : due || nextDueDate(startDate, frequency, today);
      const renewal_date = renewal || (RENEWS_YEARLY.includes(type) ? nextRenewalDate(startDate, today) : null);
      policy = {
        insurer: get("insurer").slice(0, 80) || null,
        policy_number,
        type,
        sum_assured: sum === "" ? null : sum,
        premium,
        frequency,
        start_date: startDate,
        next_due_date,
        renewal_date,
        status,
      };
    }
  }

  return { row, name: full_name, client: problems.length ? null : client, policy: problems.length ? null : policy, problems };
}

/** Rows with nothing in them (spacer rows, totals left blank). */
export function isBlank(cells: string[]): boolean {
  return cells.every((c) => !clean(c));
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type Existing = {
  clients: { id: string; full_name: string; mobile: string; nic: string | null }[];
  /** Policy numbers already in the app, with the client each belongs to. */
  policies: { policy_number: string; client_id: string }[];
  insurers: { id: string; name: string }[];
};

export type RowOutcome =
  | { row: number; name: string; kind: "problem"; problems: Problem[] }
  | { row: number; name: string; kind: "skipped" } // already in the app
  | { row: number; name: string; kind: "add"; newClient: boolean; policy: string | null };

export type Plan = {
  outcomes: RowOutcome[];
  insurers: { id: string; name: string }[];
  clients: (ClientRecord & { id: string })[];
  policies: (Omit<PolicyRecord, "insurer"> & { client_id: string; insurer_id: string | null })[];
};

const digits = (s: string) => s.replace(/\D/g, "");
const nameKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** One person: same NIC, or same mobile and name. */
const personKeys = (c: { full_name: string; mobile: string; nic: string | null }) =>
  [c.nic ? `nic:${c.nic.toUpperCase()}` : null, `phone:${normalisePhone(c.mobile) ?? digits(c.mobile)}:${nameKey(c.full_name)}`].filter(
    Boolean,
  ) as string[];

/**
 * What an import would add. Rows for a client already in the app (same NIC,
 * or same mobile and name) add only their policies; policies whose number is
 * already in the app are skipped, so running the same file twice adds nothing.
 */
export function planImport(rows: ReadRow[], existing: Existing, newId: () => string): Plan {
  const people = new Map<string, string>(); // person key -> client id
  for (const c of existing.clients) for (const k of personKeys(c)) people.set(k, c.id);
  const owners = new Map(existing.policies.map((p) => [p.policy_number.toUpperCase(), p.client_id]));
  const insurerIds = new Map(existing.insurers.map((i) => [i.name.toLowerCase(), i.id]));

  const plan: Plan = { outcomes: [], insurers: [], clients: [], policies: [] };
  const numbersInFile = new Set<string>();

  for (const r of rows) {
    if (!r.client) {
      plan.outcomes.push({ row: r.row, name: r.name, kind: "problem", problems: r.problems });
      continue;
    }
    const name = r.client.full_name;
    if (r.policy && numbersInFile.has(r.policy.policy_number)) {
      plan.outcomes.push({ row: r.row, name, kind: "problem", problems: ["policyRepeated"] });
      continue;
    }

    const keys = personKeys(r.client);
    let clientId = keys.map((k) => people.get(k)).find(Boolean);
    const newClient = !clientId;

    // A policy number already in the app under someone else: probably a typo.
    const owner = r.policy ? owners.get(r.policy.policy_number) : undefined;
    if (owner && owner !== clientId) {
      plan.outcomes.push({ row: r.row, name, kind: "problem", problems: ["policyTaken"] });
      continue;
    }
    const policyIsNew = r.policy && !owner;
    if (!newClient && !policyIsNew) {
      plan.outcomes.push({ row: r.row, name, kind: "skipped" });
      continue;
    }

    if (!clientId) {
      clientId = newId();
      plan.clients.push({ ...r.client, id: clientId });
    }
    for (const k of keys) if (!people.has(k)) people.set(k, clientId);

    if (r.policy && policyIsNew) {
      numbersInFile.add(r.policy.policy_number);
      let insurerId: string | null = null;
      if (r.policy.insurer) {
        const k = r.policy.insurer.toLowerCase();
        insurerId = insurerIds.get(k) ?? null;
        if (!insurerId) {
          insurerId = newId();
          insurerIds.set(k, insurerId);
          plan.insurers.push({ id: insurerId, name: r.policy.insurer });
        }
      }
      const { insurer, ...policy } = r.policy;
      void insurer; // stored as insurer_id
      plan.policies.push({ ...policy, client_id: clientId, insurer_id: insurerId });
    }
    plan.outcomes.push({ row: r.row, name, kind: "add", newClient, policy: r.policy && policyIsNew ? r.policy.policy_number : null });
  }
  return plan;
}
