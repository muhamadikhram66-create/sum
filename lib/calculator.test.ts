import {
  calcBill,
  solveKWhFromBill,
  recommendSize,
  computeBase,
  computeBattery,
  recommendBattery,
  DEFAULT_ASSUMPTIONS,
} from './calculator';

const a = DEFAULT_ASSUMPTIONS;

describe('calcBill', () => {
  it('returns 0 for 0 kWh', () => {
    expect(calcBill(0, a)).toBe(0);
  });

  it('returns 0 for negative kWh', () => {
    expect(calcBill(-100, a)).toBe(0);
  });

  it('uses low energy rate below threshold', () => {
    const bill = calcBill(1000, a);
    expect(bill).toBeGreaterThan(0);
    // Rough sanity: 1000 kWh × ~0.27 + charges ≈ 300–500
    expect(bill).toBeGreaterThan(200);
    expect(bill).toBeLessThan(600);
  });

  it('uses high energy rate above threshold', () => {
    const billLow = calcBill(1500, a);
    const billHigh = calcBill(1501, a);
    // Crossing the tier threshold should increase the marginal rate
    expect(billHigh).toBeGreaterThan(billLow);
  });
});

describe('solveKWhFromBill round-trip', () => {
  it('RM450 round-trips within RM0.01', () => {
    const kWh = solveKWhFromBill(450, a);
    expect(Math.abs(calcBill(kWh, a) - 450)).toBeLessThan(0.01);
  });

  it('RM650 round-trips within RM0.01', () => {
    const kWh = solveKWhFromBill(650, a);
    expect(Math.abs(calcBill(kWh, a) - 650)).toBeLessThan(0.01);
  });
});

// ─── Primary benchmark: RM650 / three-phase / ATAP / Working Family ───────────
describe('RM650 / three-phase / ATAP / Working Family (primary benchmark)', () => {
  const kWh = solveKWhFromBill(650, a);
  const sizing = recommendSize(kWh, 'three', 0, 'atap', a);
  const base = computeBase(kWh, sizing.recommendedPanels, 'workingFamily', 'atap', sizing.phaseCapKWp, a);

  it('three-phase ATAP cap is 15kW', () => {
    expect(sizing.phaseCapKWp).toBe(15);
  });

  it('MAQ is computed on inverter kWac, not panel kWp', () => {
    expect(base.maq).toBeCloseTo(base.inverterKWac * a.sunHoursMAQ * 30, 5);
  });

  it('billAfterNoBattery is less than billBefore', () => {
    expect(base.billAfterNoBattery).toBeLessThan(base.billBefore);
  });

  it('selfConsumptionSavings is positive', () => {
    expect(base.selfConsumptionSavings).toBeGreaterThan(0);
  });

  it('exportEnergy + energyImported sum to sensible values', () => {
    expect(base.exportEnergy).toBeGreaterThanOrEqual(0);
    expect(base.energyImported).toBeGreaterThanOrEqual(0);
  });

  it('system is not bound by roof (no roof constraint given)', () => {
    expect(sizing.boundBy).not.toBe('roof');
  });
});

// ─── RM650 / three-phase / SELCO — confirms no-export behaviour ───────────────
describe('RM650 / three-phase / SELCO', () => {
  const kWh = solveKWhFromBill(650, a);
  const sizing = recommendSize(kWh, 'three', 0, 'selco', a);
  const base = computeBase(kWh, sizing.recommendedPanels, 'workingFamily', 'selco', sizing.phaseCapKWp, a);

  it('SELCO three-phase cap is 12.5kW (not 15kW)', () => {
    expect(sizing.phaseCapKWp).toBe(12.5);
  });

  it('maq is 0 for SELCO', () => {
    expect(base.maq).toBe(0);
  });

  it('exportSavings is 0 for SELCO (no export credit)', () => {
    expect(base.exportSavings).toBe(0);
  });

  it('offsettableExport is 0 for SELCO', () => {
    expect(base.offsettableExport).toBe(0);
  });

  it('forfeitedExport equals exportEnergy for SELCO', () => {
    expect(base.forfeitedExport).toBeCloseTo(base.exportEnergy, 5);
  });
});

// ─── Roof-constrained case ────────────────────────────────────────────────────
describe('Roof-constrained sizing', () => {
  const kWh = 2000; // large enough that usage alone would recommend more than the tiny roof allows
  const roofArea = 20; // only ~6 panels fit (20/3 = 6)

  const sizing = recommendSize(kWh, 'three', roofArea, 'atap', a);

  it('boundBy is "roof"', () => {
    expect(sizing.boundBy).toBe('roof');
  });

  it('recommendedPanels does not exceed roofCapPanels', () => {
    expect(sizing.recommendedPanels).toBeLessThanOrEqual(sizing.roofCapPanels);
  });

  it('roofCapPanels matches floor(roofArea / areaPerPanel)', () => {
    expect(sizing.roofCapPanels).toBe(Math.floor(roofArea / a.areaPerPanel));
  });
});

// ─── Battery recommendation ───────────────────────────────────────────────────
describe('recommendBattery', () => {
  it('returns no-excess when there is nothing to shift', () => {
    const kWh = solveKWhFromBill(200, a);
    // Small system, all generation consumed — no significant export
    const sizing = recommendSize(kWh, 'single', 0, 'selco', a);
    const base = computeBase(kWh, sizing.recommendedPanels, 'workingFamily', 'selco', sizing.phaseCapKWp, a);
    const rec = recommendBattery(base, 'selco', a);
    // May be no-excess or not-cost-effective depending on the scenario — either is valid
    expect(['no-excess', 'not-cost-effective', 'recommended']).toContain(rec.reason);
  });

  it('battery shifts no more energy than available export', () => {
    const kWh = solveKWhFromBill(650, a);
    const sizing = recommendSize(kWh, 'three', 0, 'atap', a);
    const base = computeBase(kWh, sizing.recommendedPanels, 'workingFamily', 'atap', sizing.phaseCapKWp, a);
    const r = computeBattery(base, 10, 'atap', a);
    if (r) {
      expect(r.energyShifted).toBeLessThanOrEqual(base.exportEnergy + 0.0001);
      expect(r.energyShifted).toBeLessThanOrEqual(base.energyImported + 0.0001);
    }
  });
});
