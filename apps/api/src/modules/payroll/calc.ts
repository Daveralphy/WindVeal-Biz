import type { PayOverrides } from "../../db/schema";

/**
 * Working out one person's monthly pay.
 *
 * For Nigeria (NGN) WindVeal works out the statutory deductions:
 * - Pension (employee part): 8% of basic + housing + transport (Pension Reform Act 2014).
 * - NHF: 2.5% of basic (National Housing Fund Act).
 * - PAYE under the Nigeria Tax Act 2025 (from 1 January 2026). Yearly income after pension and NHF is taxed in bands:
 *   the first ₦800,000 at 0%, the next ₦2,200,000 at 15%, the next ₦9,000,000 at 18%, the next ₦13,000,000 at 21%,
 *   the next ₦25,000,000 at 23%, and anything above ₦50,000,000 at 25%.
 *   A bonus is taxed as extra income in the month it's paid.
 * Rent relief and other reliefs aren't known to WindVeal; HR can type the tax in themselves for anyone they apply to.
 * For other currencies nothing is deducted automatically: HR types the amounts in.
 *
 * Everything is worked out in kobo (whole numbers) so totals always add up.
 */

export const TAX_BANDS: [upTo: number, rate: number][] = [
  [800_000, 0], [3_000_000, 0.15], [12_000_000, 0.18], [25_000_000, 0.21], [50_000_000, 0.23], [Infinity, 0.25],
];
export const SPLIT = { basic: 0.6, housing: 0.25, transport: 0.15 } as const;
export const PENSION_RATE = 0.08;
export const NHF_RATE = 0.025;

/** Yearly tax on a yearly taxable income (naira). */
export function annualTax(income: number): number {
  let tax = 0, from = 0;
  for (const [upTo, rate] of TAX_BANDS) {
    if (income <= from) break;
    tax += (Math.min(income, upTo) - from) * rate;
    from = upTo;
  }
  return tax;
}

/** A salary paid weekly, daily or by the hour, as a month. */
export function monthlyFrom(amount: number, frequency: string | null | undefined): number {
  switch ((frequency ?? "Monthly").toLowerCase()) {
    case "weekly": return (amount * 52) / 12;
    case "fortnightly": return (amount * 26) / 12;
    case "daily": return amount * 22;
    case "hourly": return amount * 8 * 22;
    case "yearly": case "annually": case "annual": return amount / 12;
    default: return amount;
  }
}

export type Slip = {
  basic: string; housing: string; transport: string; otherAllowances: string; bonus: string; gross: string;
  pension: string; nhf: string; paye: string; otherDeductions: string; net: string;
};

const kobo = (naira: number) => Math.round(naira * 100);
const money = (k: number) => (k / 100).toFixed(2);
const given = (o: PayOverrides, k: keyof PayOverrides) => (o[k] != null && o[k] !== "" ? kobo(Number(o[k])) : null);

/** One month's payslip from the monthly salary, with anything HR typed in kept as it is. */
export function computeSlip(monthlySalary: number, currency: string, o: PayOverrides = {}): Slip {
  const salary = kobo(monthlySalary);
  const basic = given(o, "basic") ?? Math.round(salary * SPLIT.basic);
  const housing = given(o, "housing") ?? Math.round(salary * SPLIT.housing);
  // Transport takes what's left of the salary, so the three add up exactly.
  const transport = given(o, "transport") ?? (o.basic == null && o.housing == null ? salary - basic - housing : Math.round(salary * SPLIT.transport));
  const otherAllowances = given(o, "otherAllowances") ?? 0;
  const bonus = given(o, "bonus") ?? 0;
  const regular = basic + housing + transport + otherAllowances;
  const gross = regular + bonus;
  const ngn = currency.toUpperCase() === "NGN";
  const pension = given(o, "pension") ?? (ngn ? Math.round((basic + housing + transport) * PENSION_RATE) : 0);
  const nhf = given(o, "nhf") ?? (ngn ? Math.round(basic * NHF_RATE) : 0);
  let paye = given(o, "paye");
  if (paye == null) {
    if (!ngn) paye = 0;
    else {
      const yearly = (regular - pension - nhf) * 12 / 100;
      const base = annualTax(yearly);
      paye = Math.round((base / 12) * 100) + Math.round((annualTax(yearly + bonus / 100) - base) * 100);
    }
  }
  const otherDeductions = given(o, "otherDeductions") ?? 0;
  const net = gross - pension - nhf - paye - otherDeductions;
  return {
    basic: money(basic), housing: money(housing), transport: money(transport), otherAllowances: money(otherAllowances), bonus: money(bonus),
    gross: money(gross), pension: money(pension), nhf: money(nhf), paye: money(paye), otherDeductions: money(otherDeductions), net: money(net),
  };
}
