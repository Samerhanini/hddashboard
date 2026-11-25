// Filter-input rules from reference/datasets.json -> each dataset's "rules".
// Every API route checks its inputs against these before using them.

export const RULES = {
  project_id: /^[0-9]{1,25}$/,
  crmq: /^[\p{L}\p{M}\p{N} .@-]{2,40}$/u,
  bldg: /^[A-Za-z0-9 ]{2,30}$/,
} as const;

export type RuleName = keyof typeof RULES;

export function isValid(rule: RuleName, value: unknown): value is string {
  return typeof value === 'string' && RULES[rule].test(value);
}
