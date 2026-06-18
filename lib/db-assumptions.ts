import { Assumptions, DEFAULT_ASSUMPTIONS } from './calculator';

// Maps snake_case DB columns to camelCase Assumptions keys.
export function rowToAssumptions(row: Record<string, unknown>): Assumptions {
  return {
    yieldFactor:              Number(row.yield_factor             ?? DEFAULT_ASSUMPTIONS.yieldFactor),
    energyRateLow:            Number(row.energy_rate_low          ?? DEFAULT_ASSUMPTIONS.energyRateLow),
    energyRateHigh:           Number(row.energy_rate_high         ?? DEFAULT_ASSUMPTIONS.energyRateHigh),
    energyTierThreshold:      Number(row.energy_tier_threshold    ?? DEFAULT_ASSUMPTIONS.energyTierThreshold),
    capacityRate:             Number(row.capacity_rate            ?? DEFAULT_ASSUMPTIONS.capacityRate),
    networkRate:              Number(row.network_rate             ?? DEFAULT_ASSUMPTIONS.networkRate),
    retailFlat:               Number(row.retail_flat              ?? DEFAULT_ASSUMPTIONS.retailFlat),
    retailThreshold:          Number(row.retail_threshold         ?? DEFAULT_ASSUMPTIONS.retailThreshold),
    kwtbbRate:                Number(row.kwtbb_rate               ?? DEFAULT_ASSUMPTIONS.kwtbbRate),
    kwtbbThreshold:           Number(row.kwtbb_threshold          ?? DEFAULT_ASSUMPTIONS.kwtbbThreshold),
    serviceTaxRate:           Number(row.service_tax_rate         ?? DEFAULT_ASSUMPTIONS.serviceTaxRate),
    serviceTaxThreshold:      Number(row.service_tax_threshold    ?? DEFAULT_ASSUMPTIONS.serviceTaxThreshold),
    sunHoursMAQ:              Number(row.sun_hours_maq            ?? DEFAULT_ASSUMPTIONS.sunHoursMAQ),
    dcAcOversizeRatio:        Number(row.dc_ac_oversize_ratio     ?? DEFAULT_ASSUMPTIONS.dcAcOversizeRatio),
    oversizeClippingLossPct:  Number(row.oversize_clipping_loss_pct ?? DEFAULT_ASSUMPTIONS.oversizeClippingLossPct),
    costPerKWp:               Number(row.cost_per_kwp             ?? DEFAULT_ASSUMPTIONS.costPerKWp),
    markupPct:                Number(row.markup_pct               ?? DEFAULT_ASSUMPTIONS.markupPct),
    hybridInverterCost:       Number(row.hybrid_inverter_cost     ?? DEFAULT_ASSUMPTIONS.hybridInverterCost),
    batteryCostPerKWh:        Number(row.battery_cost_per_kwh     ?? DEFAULT_ASSUMPTIONS.batteryCostPerKWh),
    batteryDoD:               Number(row.battery_dod              ?? DEFAULT_ASSUMPTIONS.batteryDoD),
    batteryRoundTripEff:      Number(row.battery_round_trip_eff   ?? DEFAULT_ASSUMPTIONS.batteryRoundTripEff),
    panelWattage:             Number(row.panel_wattage            ?? DEFAULT_ASSUMPTIONS.panelWattage),
    areaPerPanel:             Number(row.area_per_panel           ?? DEFAULT_ASSUMPTIONS.areaPerPanel),
  };
}
