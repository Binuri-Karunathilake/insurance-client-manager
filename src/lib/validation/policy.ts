import { z } from "zod";

// Error values are keys into dictionary.policyForm.errors.
export type PolicyErrorKey =
  | "insurerRequired"
  | "numberRequired"
  | "numberTaken"
  | "premiumInvalid"
  | "sumInvalid"
  | "dateInvalid"
  | "dueBeforeStart"
  | "generic";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "dateInvalid")
  .transform((v) => v || null);

// "Rs. 1,500,000" and "1500000" both mean 1500000.
const money = (message: PolicyErrorKey) =>
  z
    .string()
    .transform((v) => v.replace(/rs\.?|,|\s/gi, ""))
    .refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v), message)
    .transform(Number);

export const policySchema = z
  .object({
    client_id: z.string().uuid(),
    insurer_id: z.string().uuid("insurerRequired"),
    type: z.enum(["life", "motor", "health", "property", "other"]),
    policy_number: z
      .string()
      .trim()
      .toUpperCase()
      .min(1, "numberRequired")
      .max(40, "numberRequired"),
    sum_assured: z
      .string()
      .transform((v) => v.replace(/rs\.?|,|\s/gi, ""))
      .refine((v) => v === "" || /^\d{1,12}(\.\d{1,2})?$/.test(v), "sumInvalid")
      .transform((v) => (v ? Number(v) : null)),
    premium: money("premiumInvalid").refine((v) => v > 0, "premiumInvalid"),
    frequency: z.enum(["monthly", "quarterly", "half_yearly", "yearly", "single"]),
    start_date: isoDate,
    next_due_date: optionalDate,
    renewal_date: optionalDate,
    status: z.enum(["active", "pending", "lapsed", "matured", "cancelled"]),
  })
  .superRefine((v, ctx) => {
    if (v.next_due_date && v.next_due_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["next_due_date"], message: "dueBeforeStart" });
    }
    if (v.renewal_date && v.renewal_date < v.start_date) {
      ctx.addIssue({ code: "custom", path: ["renewal_date"], message: "dueBeforeStart" });
    }
  })
  .transform((v) => ({ ...v, next_due_date: v.frequency === "single" ? null : v.next_due_date }));

export type PolicyInput = z.output<typeof policySchema>;

export const POLICY_FIELDS = [
  "client_id",
  "insurer_id",
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

export function policyFromForm(form: FormData) {
  return policySchema.safeParse(Object.fromEntries(POLICY_FIELDS.map((f) => [f, String(form.get(f) ?? "")])));
}
