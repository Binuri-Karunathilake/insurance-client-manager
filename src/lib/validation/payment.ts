import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/types";

export type PaymentErrorKey = "amount" | "paidOn" | "generic";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The optional details on "Mark as paid". Left empty, the database uses the
 * policy's premium, cash and today. A payment can't be dated in the future
 * or more than a year back.
 */
export function paymentFromForm(form: FormData, today: string) {
  const yearAgo = `${+today.slice(0, 4) - 1}${today.slice(4)}`;
  return z
    .object({
      policy_id: z.string().regex(/^[0-9a-f-]{36}$/i, "generic"),
      amount: z
        .string()
        .trim()
        .transform((s) => s.replace(/[,\s]/g, "").replace(/^(rs\.?|රු\.?)/i, ""))
        .refine((s) => s === "" || (/^\d+(\.\d{1,2})?$/.test(s) && +s > 0 && +s < 1e10), "amount")
        .transform((s) => (s === "" ? null : Number(s))),
      method: z.enum(PAYMENT_METHODS as [string, ...string[]]).catch("cash"),
      paid_on: z
        .string()
        .trim()
        .refine((s) => s === "" || (isoDate.test(s) && s <= today && s >= yearAgo), "paidOn")
        .transform((s) => (s === "" ? null : s)),
    })
    .safeParse({
      policy_id: String(form.get("policy_id") ?? ""),
      amount: String(form.get("amount") ?? ""),
      method: String(form.get("method") ?? "cash"),
      paid_on: String(form.get("paid_on") ?? ""),
    });
}
