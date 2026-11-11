// Row shapes for the tables in supabase/migrations. Keep in step with the SQL.

export type PolicyType = "life" | "motor" | "health" | "property" | "other";
export type PaymentFrequency = "monthly" | "quarterly" | "half_yearly" | "yearly" | "single";
export type PolicyStatus = "active" | "pending" | "lapsed" | "matured" | "cancelled";

export type Client = {
  id: string;
  full_name: string;
  mobile: string;
  whatsapp: string | null;
  nic: string | null;
  date_of_birth: string | null;
  address: string | null;
  preferred_language: "si" | "en";
  created_at: string;
};

export type Insurer = { id: string; name: string; branch: string | null };

export type Policy = {
  id: string;
  client_id: string;
  insurer_id: string | null;
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

export type FamilyMember = {
  id: string;
  client_id: string;
  full_name: string;
  relationship: string;
  date_of_birth: string | null;
};

export type ClientNote = { id: string; client_id: string; body: string; created_at: string };

export type DueKind = "premium" | "renewal" | "birthday" | "follow_up";

export type DueItem = {
  kind: DueKind;
  client_id: string;
  policy_id: string | null;
  family_member_id: string | null;
  follow_up_id: string | null;
  due_on: string;
  days_left: number;
  amount: number | null;
  detail: string | null;
};

/** The one chip shown next to a client in lists. */
export type ClientStatus = "overdue" | "due" | "birthday" | "lapsed";
