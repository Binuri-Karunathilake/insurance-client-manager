import { z } from "zod";
import { formatPhone, normaliseNic, normalisePhone } from "@/lib/phone";

// Error values are keys into dictionary.clientForm.errors, so the form can
// show them in either language.
export type ClientErrorKey =
  | "nameRequired"
  | "mobileInvalid"
  | "whatsappInvalid"
  | "nicInvalid"
  | "dobInvalid"
  | "nicTaken"
  | "generic";

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => v || null);

export const clientSchema = z
  .object({
    full_name: z.string().trim().min(1, "nameRequired").max(120, "nameRequired"),
    mobile: z
      .string()
      .refine((v) => normalisePhone(v) !== null, "mobileInvalid")
      .transform((v) => formatPhone(v)),
    same_whatsapp: z.boolean(),
    whatsapp: z.string().trim(),
    nic: z
      .string()
      .trim()
      .refine((v) => v === "" || normaliseNic(v) !== null, "nicInvalid")
      .transform((v) => (v ? normaliseNic(v) : null)),
    date_of_birth: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v > "1900-01-01" && new Date(v) <= new Date()), "dobInvalid")
      .transform((v) => v || null),
    address: optionalText,
    preferred_language: z.enum(["si", "en"]),
  })
  .superRefine((v, ctx) => {
    if (!v.same_whatsapp && normalisePhone(v.whatsapp) === null) {
      ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "whatsappInvalid" });
    }
  })
  .transform(({ same_whatsapp, whatsapp, ...rest }) => ({
    ...rest,
    // null means "same as mobile"
    whatsapp: same_whatsapp ? null : formatPhone(whatsapp),
  }));

export type ClientInput = z.output<typeof clientSchema>;

export function clientFromForm(form: FormData) {
  const text = (name: string) => String(form.get(name) ?? "");
  return clientSchema.safeParse({
    full_name: text("full_name"),
    mobile: text("mobile"),
    same_whatsapp: form.get("same_whatsapp") === "on",
    whatsapp: text("whatsapp"),
    nic: text("nic"),
    date_of_birth: text("date_of_birth"),
    address: text("address"),
    preferred_language: text("preferred_language") === "en" ? "en" : "si",
  });
}
