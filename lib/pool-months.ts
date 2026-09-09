// Les valeurs `pool_month` renvoyees par l'API 42 sont les noms de mois en
// anglais, en minuscules (ex: "july", "august").
export const POOL_MONTHS: { value: string; label: string }[] = [
  { value: "january", label: "Janvier" },
  { value: "february", label: "Fevrier" },
  { value: "march", label: "Mars" },
  { value: "april", label: "Avril" },
  { value: "may", label: "Mai" },
  { value: "june", label: "Juin" },
  { value: "july", label: "Juillet" },
  { value: "august", label: "Aout" },
  { value: "september", label: "Septembre" },
  { value: "october", label: "Octobre" },
  { value: "november", label: "Novembre" },
  { value: "december", label: "Decembre" },
];

export const POOL_MONTH_LABELS: Record<string, string> = Object.fromEntries(
  POOL_MONTHS.map((m) => [m.value, m.label]),
);

export function poolMonthLabel(month: string): string {
  return POOL_MONTH_LABELS[month] ?? month;
}

export function isPiscineCursus(name: string): boolean {
  return /piscine/i.test(name);
}
