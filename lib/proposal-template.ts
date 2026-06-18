import { ProposalSnapshot } from './calculator';

function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('en-MY', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function rm(n: number): string { return `RM ${fmtNum(Math.round(n))}`; }
function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function dateStr(d: Date): string {
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' });
}

export type AddonSettings = {
  addon_price?: number | null;
  addon_insurance_years?: number | null;
  addon_om_visits?: number | null;
  addon_workmanship_years?: number | null;
  epp_bank_1?: string | null;
  epp_bank_1_months?: number | null;
  epp_bank_2?: string | null;
  epp_bank_2_months?: number | null;
  epp_bank_3?: string | null;
  epp_bank_3_months?: number | null;
};

const ASK = 'Ask your Summit Energy representative';

function addonVal(v: string | number | null | undefined): string {
  return v != null ? String(v) : ASK;
}

export function fillTemplate(
  html: string,
  snapshot: ProposalSnapshot,
  customer: { name: string; address?: string | null; phone?: string | null },
  addon: AddonSettings = {},
): string {
  const { base, packages, effectiveBatterySize, batteryResult, bill, phase, scheme, panelCount } = snapshot;
  const a = snapshot.assumptions;
  const today = new Date();
  const validUntil = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

  const totalGen = Math.max(base.monthlyGeneration, 1);
  const [ess, , ful] = packages;
  const hyb = packages[1];

  const tokens: Record<string, string> = {
    customer_name: customer.name,
    customer_address: customer.address ?? '',
    customer_phone: customer.phone ?? '',
    proposal_date: dateStr(today),
    valid_until_date: dateStr(validUntil),
    monthly_bill: rm(Math.max(0, bill)),
    phase_label: phase === 'single' ? 'Single Phase' : 'Three Phase',
    scheme_label: scheme === 'atap' ? 'Solar ATAP' : 'SELCO',
    system_size_kwp: base.size.toFixed(2),
    panel_count: String(panelCount),
    panel_wattage: String(a.panelWattage),
    inverter_kwac: base.inverterKWac.toFixed(1),
    monthly_generation: fmtNum(Math.round(base.monthlyGeneration)),
    direct_consumption_pct: pct(base.selfConsumption / totalGen),
    export_pct: pct((base.offsettableExport + base.forfeitedExport) / totalGen),
    stored_pct: batteryResult ? pct(batteryResult.energyShifted / totalGen) : '0%',
    battery_size_kwh: effectiveBatterySize > 0 ? String(effectiveBatterySize) : 'None',
    savings_headline: snapshot.savingsHeadline,

    ess_original_price: rm(ess.listPrice),
    ess_final_price: rm(ess.price),
    ess_payback: isFinite(ess.payback) ? `${ess.payback.toFixed(1)} yrs` : '—',
    ess_bill_after: rm(ess.billAfter),
    ess_monthly_savings: rm(ess.monthlySavings),
    ess_bill_reduction_pct: pct(1 - ess.billAfter / Math.max(bill, 1)),
    ess_1yr_saving: rm(ess.monthlySavings * 12),
    ess_10yr_saving: rm(ess.monthlySavings * 120),

    hyb_original_price: rm(hyb.listPrice),
    hyb_final_price: rm(hyb.price),
    hyb_payback: isFinite(hyb.payback) ? `${hyb.payback.toFixed(1)} yrs` : '—',
    hyb_bill_after: rm(hyb.billAfter),
    hyb_monthly_savings: rm(hyb.monthlySavings),
    hyb_bill_reduction_pct: pct(1 - hyb.billAfter / Math.max(bill, 1)),
    hyb_1yr_saving: rm(hyb.monthlySavings * 12),
    hyb_10yr_saving: rm(hyb.monthlySavings * 120),

    ful_original_price: rm(ful.listPrice),
    ful_final_price: rm(ful.price),
    ful_payback: isFinite(ful.payback) ? `${ful.payback.toFixed(1)} yrs` : '—',
    ful_bill_after: rm(ful.billAfter),
    ful_monthly_savings: rm(ful.monthlySavings),
    ful_bill_reduction_pct: pct(1 - ful.billAfter / Math.max(bill, 1)),
    ful_1yr_saving: rm(ful.monthlySavings * 12),
    ful_10yr_saving: rm(ful.monthlySavings * 120),

    addon_price: addon.addon_price != null ? rm(Number(addon.addon_price)) : ASK,
    addon_insurance_years: addonVal(addon.addon_insurance_years),
    addon_om_visits: addonVal(addon.addon_om_visits),
    addon_workmanship_years: addonVal(addon.addon_workmanship_years),
    epp_tenure_months: addonVal(addon.epp_bank_1_months),
    epp_bank_1: addonVal(addon.epp_bank_1),
    epp_bank_1_months: addonVal(addon.epp_bank_1_months),
    epp_bank_2: addonVal(addon.epp_bank_2),
    epp_bank_2_months: addonVal(addon.epp_bank_2_months),
    epp_bank_3: addonVal(addon.epp_bank_3),
    epp_bank_3_months: addonVal(addon.epp_bank_3_months),
  };

  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? `{{${key}}}`);
}
