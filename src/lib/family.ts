// Stored as these keys; shown through dictionary.family.relationships.
export const RELATIONSHIPS = ["wife", "husband", "son", "daughter", "father", "mother", "brother", "sister", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
