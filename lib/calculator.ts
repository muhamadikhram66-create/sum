// Calculation engine — ported faithfully from summit-energy-calculator.jsx.
// All formulas have been cross-checked; do not change without flagging the diff.

export const PROFILES = {
  workingFamily: { label: 'Working Family', day: 0.33, night: 0.67, desc: 'Away during office hours' },
  familyAtHome:  { label: 'Family At Home', day: 0.50, night: 0.50, desc: 'Retirees, kids, or a spouse home most days' },
  workFromHome:  { label: 'Work From Home', day: 0.60, night: 0.40, desc: 'Remote work, higher daytime draw' },
} as const;

export type ProfileKey = keyof typeof PROFILES;

export const BATTERY_PRESETS = [5, 10, 15, 20] as const;
export const BATTERY_OPTIONS = [0, 5, 10, 15, 20] as const;
export const DAYS_IN_MONTH = 30;

export interface Assumptions {
  yieldFactor: number;
  energyRateLow: number;
  energyRateHigh: number;
  energyTierThreshold: number;
  capacityRate: number;
  networkRate: number;
  retailFlat: number;
  retailThreshold: number;
  kwtbbRate: number;
  kwtbbThreshold: number;
  serviceTaxRate: number;
  serviceTaxThreshold: number;
  sunHoursMAQ: number;
  dcAcOversizeRatio: number;
  oversizeClippingLossPct: number;
  costPerKWp: number;
  markupPct: number;
  hybridInverterCost: number;
  batteryCostPerKWh: number;
  batteryDoD: number;
  batteryRoundTripEff: number;
  panelWattage: number;
  areaPerPanel: number;
}

// TNB Regulatory Period 4 rates, effective 1 Jul 2025 – 31 Dec 2027.
// Update via Admin Settings before RP5 is gazetted — not a code change.
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  yieldFactor: 110,
  energyRateLow: 0.2703,
  energyRateHigh: 0.3703,
  energyTierThreshold: 1500,
  capacityRate: 0.0455,
  networkRate: 0.1285,
  retailFlat: 10,
  retailThreshold: 600,
  kwtbbRate: 0.016,
  kwtbbThreshold: 300,
  serviceTaxRate: 0.08,
  serviceTaxThreshold: 600,
  sunHoursMAQ: 5,
  dcAcOversizeRatio: 1.5,
  oversizeClippingLossPct: 0.08,
  costPerKWp: 2100,
  markupPct: 0.22,
  hybridInverterCost: 4100,
  batteryCostPerKWh: 1100,
  batteryDoD: 0.9,
  batteryRoundTripEff: 0.95,
  panelWattage: 630,
  areaPerPanel: 3.0,
};

export function calcBill(kWh: number, a: Assumptions): number {
  if (kWh <= 0) return 0;
  const energyRate = kWh <= a.energyTierThreshold ? a.energyRateLow : a.energyRateHigh;
  const energyCharge = kWh * energyRate;
  const capacityCharge = kWh * a.capacityRate;
  const networkCharge = kWh * a.networkRate;
  const retail = kWh > a.retailThreshold ? a.retailFlat : 0;
  const generationSubtotal = energyCharge + capacityCharge;
  const usageChargeTotal = generationSubtotal + networkCharge + retail;
  const kwtbb = kWh > a.kwtbbThreshold ? (generationSubtotal + networkCharge) * a.kwtbbRate : 0;
  const taxableKWh = Math.max(0, kWh - a.serviceTaxThreshold);
  const perKWhAll = energyRate + a.capacityRate + a.networkRate;
  const serviceTax = kWh > a.serviceTaxThreshold ? perKWhAll * taxableKWh * a.serviceTaxRate : 0;
  return usageChargeTotal + kwtbb + serviceTax;
}

export function energyRateFor(kWh: number, a: Assumptions): number {
  return kWh <= a.energyTierThreshold ? a.energyRateLow : a.energyRateHigh;
}

export function solveKWhFromBill(targetBill: number, a: Assumptions): number {
  let lo = 0, hi = 8000;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (calcBill(mid, a) < targetBill) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface SizingResult {
  recommendedPanels: number;
  maxPanels: number;
  phaseCapPanels: number;
  roofCapPanels: number;
  boundBy: 'usage' | 'phase' | 'roof';
  phaseCapKWp: number;
}

export function recommendSize(
  monthlyKWh: number,
  phase: 'single' | 'three',
  roofAreaSqm: number,
  scheme: 'atap' | 'selco',
  a: Assumptions,
): SizingResult {
  const phaseCapKWp = phase === 'single' ? 5 : scheme === 'selco' ? 12.5 : 15;
  const phaseCapPanels = Math.max(1, Math.floor((phaseCapKWp * a.dcAcOversizeRatio * 1000) / a.panelWattage));

  let roofCapPanels = Infinity;
  if (roofAreaSqm > 0) {
    roofCapPanels = Math.max(1, Math.floor(roofAreaSqm / a.areaPerPanel));
  }

  const maxPanels = Math.min(phaseCapPanels, roofCapPanels);
  const targetKWp = monthlyKWh / a.yieldFactor;
  const targetPanels = Math.max(1, Math.round((targetKWp * 1000) / a.panelWattage));
  const recommendedPanels = Math.min(targetPanels, maxPanels);

  let boundBy: 'usage' | 'phase' | 'roof' = 'usage';
  if (maxPanels <= targetPanels) {
    boundBy = phaseCapPanels <= roofCapPanels ? 'phase' : 'roof';
  }

  return { recommendedPanels, maxPanels, phaseCapPanels, roofCapPanels, boundBy, phaseCapKWp };
}

export interface BaseResult {
  size: number;
  inverterKWac: number;
  monthlyGeneration: number;
  selfConsumption: number;
  exportEnergy: number;
  energyImported: number;
  maq: number;
  offsettableExport: number;
  forfeitedExport: number;
  billBefore: number;
  billMid: number;
  billAfterNoBattery: number;
  selfConsumptionSavings: number;
  exportSavings: number;
  maxPossibleShift: number;
}

export function computeBase(
  monthlyKWh: number,
  panelCount: number,
  profileKey: ProfileKey,
  scheme: 'atap' | 'selco',
  phaseCapKWp: number,
  a: Assumptions,
): BaseResult {
  const profile = PROFILES[profileKey];
  const size = (panelCount * a.panelWattage) / 1000;
  const inverterKWac = Math.min(phaseCapKWp, size);
  const oversizedKWp = Math.max(0, size - inverterKWac);
  const monthlyGeneration =
    inverterKWac * a.yieldFactor +
    oversizedKWp * a.yieldFactor * (1 - a.oversizeClippingLossPct);
  const rawSelfConsumption = monthlyGeneration * profile.day;
  const selfConsumption = Math.min(rawSelfConsumption, monthlyKWh, monthlyGeneration);
  const exportEnergy = Math.max(0, monthlyGeneration - selfConsumption);
  const energyImported = Math.max(0, monthlyKWh - selfConsumption);

  let maq = 0, offsettableExport = 0, forfeitedExport = exportEnergy, exportCreditValue = 0;
  if (scheme === 'atap') {
    maq = inverterKWac * a.sunHoursMAQ * DAYS_IN_MONTH; // MAQ on inverter kWac, not panel kWp
    offsettableExport = Math.min(exportEnergy, energyImported, maq);
    forfeitedExport = Math.max(0, exportEnergy - offsettableExport);
    const exportCreditRate = energyRateFor(energyImported, a);
    exportCreditValue = offsettableExport * exportCreditRate;
  }

  const billBefore = calcBill(monthlyKWh, a);
  const billMid = calcBill(energyImported, a);
  const billAfterNoBattery = Math.max(0, billMid - exportCreditValue);
  const selfConsumptionSavings = billBefore - billMid;
  const exportSavings = billMid - billAfterNoBattery;
  const maxPossibleShift = Math.min(exportEnergy, energyImported);

  return {
    size, inverterKWac, monthlyGeneration, selfConsumption, exportEnergy,
    energyImported, maq, offsettableExport, forfeitedExport, billBefore,
    billMid, billAfterNoBattery, selfConsumptionSavings, exportSavings, maxPossibleShift,
  };
}

export interface BatteryResult {
  energyShifted: number;
  billAfter: number;
  batterySavings: number;
  maxMonthlyShift: number;
  newExportEnergy: number;
  newEnergyImported: number;
}

export function computeBattery(
  base: BaseResult,
  batterySizeKWh: number,
  scheme: 'atap' | 'selco',
  a: Assumptions,
): BatteryResult | null {
  if (!batterySizeKWh || batterySizeKWh <= 0) return null;
  const usable = batterySizeKWh * a.batteryDoD;
  const maxMonthlyShift = usable * DAYS_IN_MONTH * a.batteryRoundTripEff;
  const energyShifted = Math.min(base.exportEnergy, base.energyImported, maxMonthlyShift);
  const newExportEnergy = base.exportEnergy - energyShifted;
  const newEnergyImported = base.energyImported - energyShifted;
  const newBillMid = calcBill(newEnergyImported, a);
  let newExportCreditValue = 0;
  if (scheme === 'atap') {
    const newOffsettableExport = Math.min(newExportEnergy, newEnergyImported, base.maq);
    const newExportRate = energyRateFor(newEnergyImported, a);
    newExportCreditValue = newOffsettableExport * newExportRate;
  }
  const billAfter = Math.max(0, newBillMid - newExportCreditValue);
  const batterySavings = base.billAfterNoBattery - billAfter;
  return { energyShifted, billAfter, batterySavings, maxMonthlyShift, newExportEnergy, newEnergyImported };
}

export interface RecommendedBattery {
  size: number;
  result: BatteryResult | null;
  reason: 'no-excess' | 'not-cost-effective' | 'recommended';
  netValue?: number;
}

export function recommendBattery(
  base: BaseResult,
  scheme: 'atap' | 'selco',
  a: Assumptions,
): RecommendedBattery {
  if (base.maxPossibleShift <= 1) return { size: 0, result: null, reason: 'no-excess' };
  const horizonMonths = 120; // 10-year payback horizon matching typical battery warranty
  let best: RecommendedBattery = { size: 0, result: null, netValue: 0, reason: 'not-cost-effective' };
  for (const sizeKWh of BATTERY_PRESETS) {
    const r = computeBattery(base, sizeKWh, scheme, a);
    if (!r) continue;
    const incrementCost = sizeKWh * a.batteryCostPerKWh * (1 + a.markupPct);
    const netValue = r.batterySavings * horizonMonths - incrementCost;
    if (netValue > (best.netValue ?? 0)) {
      best = { size: sizeKWh, result: r, netValue, reason: 'recommended' };
    }
  }
  return best;
}

export interface PackageData {
  title: string;
  tag: string | null;
  listPrice: number;
  price: number;
  monthlySavings: number;
  billAfter: number;
  payback: number;
  includes: string[];
  featured: boolean;
}

export interface ProposalInputs {
  bill: number;
  consumption?: number;
  phase: 'single' | 'three';
  scheme: 'atap' | 'selco';
  roofArea?: number;
  profileKey: ProfileKey;
  panelCountOverride?: number | null;
  batterySizeOverride?: number | null;
  discountMode: 'pct' | 'rm';
  discountValue: number;
}

export interface ProposalSnapshot {
  monthlyKWh: number;
  panelCount: number;
  base: BaseResult;
  sizing: SizingResult;
  effectiveBatterySize: number;
  batteryResult: BatteryResult | null;
  recommendedBattery: RecommendedBattery;
  packages: PackageData[];
  bill: number;
  phase: 'single' | 'three';
  scheme: 'atap' | 'selco';
  profileKey: ProfileKey;
  assumptions: Assumptions;
  savingsHeadline: string;
}

export function computeSnapshot(inputs: ProposalInputs, a: Assumptions): ProposalSnapshot {
  const monthlyKWh =
    inputs.consumption && inputs.consumption > 0
      ? inputs.consumption
      : solveKWhFromBill(Math.max(0, inputs.bill), a);

  const sizing = recommendSize(monthlyKWh, inputs.phase, inputs.roofArea ?? 0, inputs.scheme, a);
  const panelCount = Math.min(inputs.panelCountOverride ?? sizing.recommendedPanels, sizing.maxPanels);
  const base = computeBase(monthlyKWh, panelCount, inputs.profileKey, inputs.scheme, sizing.phaseCapKWp, a);
  const recommendedBattery = recommendBattery(base, inputs.scheme, a);
  const effectiveBatterySize = inputs.batterySizeOverride ?? recommendedBattery.size;
  const batteryResult = computeBattery(base, effectiveBatterySize, inputs.scheme, a);

  const applyDiscount = (listPrice: number) => {
    if (!inputs.discountValue || inputs.discountValue <= 0) return listPrice;
    if (inputs.discountMode === 'pct') return Math.max(0, listPrice * (1 - inputs.discountValue / 100));
    return Math.max(0, listPrice - inputs.discountValue);
  };

  const battSize = effectiveBatterySize;
  const essentialCost = base.size * a.costPerKWp;
  const hybridCost = essentialCost + a.hybridInverterCost;
  const fullCost = hybridCost + battSize * a.batteryCostPerKWh;
  const essentialList = essentialCost * (1 + a.markupPct);
  const hybridList = hybridCost * (1 + a.markupPct);
  const fullList = battSize > 0 ? fullCost * (1 + a.markupPct) : hybridList;

  const essentialFinal = applyDiscount(essentialList);
  const hybridFinal = applyDiscount(hybridList);
  const fullFinal = applyDiscount(fullList);

  const billBeforeActual = Math.max(0, inputs.bill);
  const noBatterySavings = Math.max(0, billBeforeActual - base.billAfterNoBattery);
  const fullSavings = noBatterySavings + (batteryResult ? batteryResult.batterySavings : 0);
  const fullBillAfter = batteryResult ? batteryResult.billAfter : base.billAfterNoBattery;

  const isManualBattery =
    inputs.batterySizeOverride != null && inputs.batterySizeOverride !== recommendedBattery.size;

  const packages: PackageData[] = [
    {
      title: 'Essential',
      tag: 'Fast Payback',
      listPrice: essentialList,
      price: essentialFinal,
      monthlySavings: noBatterySavings,
      billAfter: base.billAfterNoBattery,
      payback: essentialFinal / (noBatterySavings * 12 || 1),
      includes: [
        `String inverter (${base.inverterKWac.toFixed(1)}kW)`,
        `${base.size.toFixed(2)} kWp · ${panelCount} panels`,
        inputs.scheme === 'atap' ? 'Solar ATAP application' : 'SELCO registration (no export)',
        'Online monitoring app',
      ],
      featured: false,
    },
    {
      title: 'Hybrid Ready',
      tag: null,
      listPrice: hybridList,
      price: hybridFinal,
      monthlySavings: noBatterySavings,
      billAfter: base.billAfterNoBattery,
      payback: hybridFinal / (noBatterySavings * 12 || 1),
      includes: [
        `Battery-ready hybrid inverter (${base.inverterKWac.toFixed(1)}kW)`,
        `${base.size.toFixed(2)} kWp · ${panelCount} panels`,
        'Add a battery anytime later',
        'Online monitoring app',
      ],
      featured: false,
    },
    {
      title: 'Full Independence',
      tag: battSize > 0
        ? (isManualBattery ? 'Your Selection' : 'Designed For You')
        : 'Not Recommended Here',
      listPrice: battSize > 0 ? fullList : hybridList,
      price: battSize > 0 ? fullFinal : hybridFinal,
      monthlySavings: battSize > 0 ? fullSavings : noBatterySavings,
      billAfter: battSize > 0 ? fullBillAfter : base.billAfterNoBattery,
      payback:
        (battSize > 0 ? fullFinal : hybridFinal) /
        ((battSize > 0 ? fullSavings : noBatterySavings) * 12 || 1),
      includes:
        battSize > 0
          ? [
              'Hybrid inverter + BESS',
              `${battSize} kWh battery storage`,
              'Backup power (limited load)',
              isManualBattery && recommendedBattery.size !== battSize
                ? recommendedBattery.size === 0
                  ? "Chosen for backup power — doesn't clear the 10-yr payback bar on bill savings alone"
                  : `Chosen over the ${recommendedBattery.size}kWh cost-optimal recommendation`
                : 'Highest savings, most resilient',
            ]
          : recommendedBattery.reason === 'no-excess'
          ? [
              'This usage profile leaves little excess solar to store',
              'A battery here would add cost without adding savings',
              'Step the battery up above to explore anyway',
            ]
          : [
              'At current battery pricing, no size pays back within 10 years here',
              'Still worth it for blackout backup power — a non-financial call',
              'Step the battery up above to explore anyway',
            ],
      featured: battSize > 0,
    },
  ];

  const essSavings = packages[0].monthlySavings;
  const fulSavings = packages[2].monthlySavings;
  const savingsHeadline =
    Math.abs(essSavings - fulSavings) < 0.5
      ? `RM${Math.round(essSavings)}`
      : `RM${Math.round(essSavings)} – RM${Math.round(fulSavings)}`;

  return {
    monthlyKWh, panelCount, base, sizing,
    effectiveBatterySize, batteryResult, recommendedBattery,
    packages, bill: inputs.bill, phase: inputs.phase,
    scheme: inputs.scheme, profileKey: inputs.profileKey,
    assumptions: a, savingsHeadline,
  };
}
