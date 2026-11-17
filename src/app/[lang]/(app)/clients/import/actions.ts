"use server";

import { requireUser } from "@/lib/auth";
import { getAgencyId } from "@/lib/data/agency";
import { createClient } from "@/lib/supabase/server";
import { colomboToday } from "@/lib/format";
import { FIELDS, MAX_ROWS, isBlank, planImport, readRow, type Existing, type Mapping, type Plan, type RowOutcome } from "@/lib/import";
import { readSpreadsheet, type ReadError } from "@/lib/import-file";

export type ReadResult = { headers: string[]; rows: string[][]; rowNumbers: number[] } | { error: ReadError | "noFile" };

export async function readFileAction(form: FormData): Promise<ReadResult> {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "noFile" };
  return readSpreadsheet(file);
}

export type Input = { headers: string[]; rows: string[][]; rowNumbers: number[]; mapping: Mapping };

/** Never trust what the browser sends back: same limits as reading the file. */
function validInput(input: Input): boolean {
  if (!input || !Array.isArray(input.rows) || !Array.isArray(input.headers)) return false;
  if (input.rows.length > MAX_ROWS || input.headers.length > 200) return false;
  if (!Array.isArray(input.rowNumbers) || input.rowNumbers.length !== input.rows.length || !input.rowNumbers.every(Number.isInteger)) return false;
  if (!input.rows.every((r) => Array.isArray(r) && r.length <= 200 && r.every((c) => typeof c === "string" && c.length <= 1000))) return false;
  return Object.entries(input.mapping ?? {}).every(
    ([k, v]) => (FIELDS as readonly string[]).includes(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) < input.headers.length,
  );
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function all<T>(supabase: Supabase, table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return rows;
  }
}

async function plan(input: Input): Promise<Plan> {
  const today = colomboToday();
  const read = input.rows
    .map((cells, i) => ({ cells, row: input.rowNumbers[i] }))
    .filter(({ cells }) => !isBlank(cells))
    .map(({ cells, row }) => readRow(cells, input.mapping, row, today));

  const supabase = await createClient();
  const [clients, policies, insurers] = await Promise.all([
    all<Existing["clients"][number]>(supabase, "clients", "id, full_name, mobile, nic"),
    all<Existing["policies"][number]>(supabase, "policies", "policy_number, client_id"),
    all<Existing["insurers"][number]>(supabase, "insurers", "id, name"),
  ]);
  return planImport(read, { clients, policies, insurers }, () => crypto.randomUUID());
}

export type CheckResult =
  | {
      counts: { newClients: number; newPolicies: number; skipped: number; problems: number };
      newInsurers: string[];
      problems: Extract<RowOutcome, { kind: "problem" }>[];
      adds: Extract<RowOutcome, { kind: "add" }>[];
      moreAdds: number;
    }
  | { error: "needName" | "needMobile" | "generic" };

const SHOWN = 50;

export async function checkImportAction(input: Input): Promise<CheckResult> {
  await requireUser();
  if (!validInput(input)) return { error: "generic" };
  if (input.mapping.full_name === undefined) return { error: "needName" };
  if (input.mapping.mobile === undefined) return { error: "needMobile" };
  try {
    const p = await plan(input);
    const problems = p.outcomes.filter((o) => o.kind === "problem");
    const adds = p.outcomes.filter((o) => o.kind === "add");
    return {
      counts: {
        newClients: p.clients.length,
        newPolicies: p.policies.length,
        skipped: p.outcomes.filter((o) => o.kind === "skipped").length,
        problems: problems.length,
      },
      newInsurers: p.insurers.map((i) => i.name),
      problems: problems.slice(0, 200),
      adds: adds.slice(0, SHOWN),
      moreAdds: Math.max(0, adds.length - SHOWN),
    };
  } catch {
    return { error: "generic" };
  }
}

export type RunResult = { clients: number; policies: number; insurers: number } | { error: "generic" };

export async function runImportAction(input: Input): Promise<RunResult> {
  await requireUser();
  if (!validInput(input) || input.mapping.full_name === undefined || input.mapping.mobile === undefined) return { error: "generic" };
  try {
    // Planned again from the database as it is now, not from the preview.
    const p = await plan(input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_clients", {
      target_agency: await getAgencyId(),
      new_insurers: p.insurers,
      new_clients: p.clients,
      new_policies: p.policies,
    });
    if (error) return { error: "generic" };
    return data as { clients: number; policies: number; insurers: number };
  } catch {
    return { error: "generic" };
  }
}
