'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Save } from 'lucide-react';

function Field({ label, name, value, onChange, step, suffix, hint }: {
  label: string; name: string; value: number | string; onChange: (v: string) => void;
  step?: string; suffix?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      {hint && <span className="text-[10px] text-zinc-400 ml-1">({hint})</span>}
      <div className="flex items-center mt-0.5">
        <input
          type="number"
          step={step ?? 'any'}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {suffix && <span className="text-xs text-zinc-400 ml-1.5 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

function TextField({ label, name, value, onChange, placeholder }: {
  label: string; name: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <input
        type="text"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-0.5 border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 mb-5">
      <h2 className="font-bold text-sm text-zinc-800 mb-4 pb-2 border-b border-zinc-100">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

type Row = Record<string, unknown>;

export default function SettingsForm({ row }: { row: Row }) {
  const supabase = createClient();

  const n = (key: string) => Number(row[key] ?? 0);
  const s = (key: string) => String(row[key] ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Tariff & Regulatory
  const [yieldFactor, setYieldFactor] = useState(String(n('yield_factor')));
  const [energyRateLow, setEnergyRateLow] = useState(String(n('energy_rate_low')));
  const [energyRateHigh, setEnergyRateHigh] = useState(String(n('energy_rate_high')));
  const [energyTierThreshold, setEnergyTierThreshold] = useState(String(n('energy_tier_threshold')));
  const [capacityRate, setCapacityRate] = useState(String(n('capacity_rate')));
  const [networkRate, setNetworkRate] = useState(String(n('network_rate')));
  const [retailFlat, setRetailFlat] = useState(String(n('retail_flat')));
  const [retailThreshold, setRetailThreshold] = useState(String(n('retail_threshold')));
  const [kwtbbRate, setKwtbbRate] = useState(String(n('kwtbb_rate')));
  const [kwtbbThreshold, setKwtbbThreshold] = useState(String(n('kwtbb_threshold')));
  const [serviceTaxRate, setServiceTaxRate] = useState(String(n('service_tax_rate')));
  const [serviceTaxThreshold, setServiceTaxThreshold] = useState(String(n('service_tax_threshold')));
  const [sunHoursMAQ, setSunHoursMAQ] = useState(String(n('sun_hours_maq')));
  const [dcAcOversizeRatio, setDcAcOversizeRatio] = useState(String(n('dc_ac_oversize_ratio')));
  const [oversizeClippingLoss, setOversizeClippingLoss] = useState(String(n('oversize_clipping_loss_pct')));

  // Pricing
  const [costPerKWp, setCostPerKWp] = useState(String(n('cost_per_kwp')));
  const [markupPct, setMarkupPct] = useState(String(n('markup_pct')));
  const [hybridInverterCost, setHybridInverterCost] = useState(String(n('hybrid_inverter_cost')));
  const [batteryCostPerKWh, setBatteryCostPerKWh] = useState(String(n('battery_cost_per_kwh')));

  // Equipment
  const [batteryDoD, setBatteryDoD] = useState(String(n('battery_dod')));
  const [batteryRoundTripEff, setBatteryRoundTripEff] = useState(String(n('battery_round_trip_eff')));
  const [panelWattage, setPanelWattage] = useState(String(n('panel_wattage')));
  const [areaPerPanel, setAreaPerPanel] = useState(String(n('area_per_panel')));

  // Add-Ons & EPP
  const [addonPrice, setAddonPrice] = useState(String(row['addon_price'] ?? ''));
  const [addonInsuranceYears, setAddonInsuranceYears] = useState(String(row['addon_insurance_years'] ?? ''));
  const [addonOmVisits, setAddonOmVisits] = useState(String(row['addon_om_visits'] ?? ''));
  const [addonWorkmanshipYears, setAddonWorkmanshipYears] = useState(String(row['addon_workmanship_years'] ?? ''));
  const [eppBank1, setEppBank1] = useState(s('epp_bank_1'));
  const [eppBank1Months, setEppBank1Months] = useState(String(row['epp_bank_1_months'] ?? ''));
  const [eppBank2, setEppBank2] = useState(s('epp_bank_2'));
  const [eppBank2Months, setEppBank2Months] = useState(String(row['epp_bank_2_months'] ?? ''));
  const [eppBank3, setEppBank3] = useState(s('epp_bank_3'));
  const [eppBank3Months, setEppBank3Months] = useState(String(row['epp_bank_3_months'] ?? ''));

  function parseN(v: string) { const x = parseFloat(v); return isNaN(x) ? null : x; }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);

    const { data: { user } } = await supabase.auth.getUser();

    const updates = {
      yield_factor: parseN(yieldFactor),
      energy_rate_low: parseN(energyRateLow),
      energy_rate_high: parseN(energyRateHigh),
      energy_tier_threshold: parseN(energyTierThreshold),
      capacity_rate: parseN(capacityRate),
      network_rate: parseN(networkRate),
      retail_flat: parseN(retailFlat),
      retail_threshold: parseN(retailThreshold),
      kwtbb_rate: parseN(kwtbbRate),
      kwtbb_threshold: parseN(kwtbbThreshold),
      service_tax_rate: parseN(serviceTaxRate),
      service_tax_threshold: parseN(serviceTaxThreshold),
      sun_hours_maq: parseN(sunHoursMAQ),
      dc_ac_oversize_ratio: parseN(dcAcOversizeRatio),
      oversize_clipping_loss_pct: parseN(oversizeClippingLoss),
      cost_per_kwp: parseN(costPerKWp),
      markup_pct: parseN(markupPct),
      hybrid_inverter_cost: parseN(hybridInverterCost),
      battery_cost_per_kwh: parseN(batteryCostPerKWh),
      battery_dod: parseN(batteryDoD),
      battery_round_trip_eff: parseN(batteryRoundTripEff),
      panel_wattage: parseN(panelWattage),
      area_per_panel: parseN(areaPerPanel),
      addon_price: parseN(addonPrice),
      addon_insurance_years: parseN(addonInsuranceYears),
      addon_om_visits: parseN(addonOmVisits),
      addon_workmanship_years: parseN(addonWorkmanshipYears),
      epp_bank_1: eppBank1 || null,
      epp_bank_1_months: parseN(eppBank1Months),
      epp_bank_2: eppBank2 || null,
      epp_bank_2_months: parseN(eppBank2Months),
      epp_bank_3: eppBank3 || null,
      epp_bank_3_months: parseN(eppBank3Months),
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    };

    const { error: err } = await supabase
      .from('assumptions')
      .update(updates)
      .eq('id', row['id'] as string);

    if (err) {
      setError(err.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={save}>
      <Section title="Tariff & Regulatory (TNB RP4, effective 1 Jul 2025 – 31 Dec 2027)">
        <Field label="Yield factor" name="yield_factor" value={yieldFactor} onChange={setYieldFactor} suffix="kWh/kWp/mo" />
        <Field label="Energy rate ≤1500 kWh" name="energy_rate_low" value={energyRateLow} onChange={setEnergyRateLow} step="0.0001" suffix="RM/kWh" />
        <Field label="Energy rate >1500 kWh" name="energy_rate_high" value={energyRateHigh} onChange={setEnergyRateHigh} step="0.0001" suffix="RM/kWh" />
        <Field label="Energy tier threshold" name="energy_tier_threshold" value={energyTierThreshold} onChange={setEnergyTierThreshold} suffix="kWh" />
        <Field label="Capacity charge" name="capacity_rate" value={capacityRate} onChange={setCapacityRate} step="0.0001" suffix="RM/kWh" />
        <Field label="Network charge" name="network_rate" value={networkRate} onChange={setNetworkRate} step="0.0001" suffix="RM/kWh" />
        <Field label="Retail flat charge" name="retail_flat" value={retailFlat} onChange={setRetailFlat} suffix="RM" />
        <Field label="Retail threshold" name="retail_threshold" value={retailThreshold} onChange={setRetailThreshold} suffix="kWh" />
        <Field label="KWTBB rate" name="kwtbb_rate" value={kwtbbRate} onChange={setKwtbbRate} step="0.0001" suffix="fraction" />
        <Field label="KWTBB threshold" name="kwtbb_threshold" value={kwtbbThreshold} onChange={setKwtbbThreshold} suffix="kWh" />
        <Field label="Service tax rate" name="service_tax_rate" value={serviceTaxRate} onChange={setServiceTaxRate} step="0.01" suffix="fraction" />
        <Field label="Service tax threshold" name="service_tax_threshold" value={serviceTaxThreshold} onChange={setServiceTaxThreshold} suffix="kWh" />
        <Field label="Sun-hours for MAQ" name="sun_hours_maq" value={sunHoursMAQ} onChange={setSunHoursMAQ} suffix="hrs/day" />
        <Field label="DC:AC oversize ratio" name="dc_ac_oversize_ratio" value={dcAcOversizeRatio} onChange={setDcAcOversizeRatio} step="0.05" suffix="×" />
        <Field label="Oversize clipping loss" name="oversize_clipping_loss_pct" value={oversizeClippingLoss} onChange={setOversizeClippingLoss} step="0.01" suffix="fraction" />
      </Section>

      <Section title="Pricing">
        <Field label="System cost" name="cost_per_kwp" value={costPerKWp} onChange={setCostPerKWp} suffix="RM/kWp" />
        <Field label="Markup" name="markup_pct" value={markupPct} onChange={setMarkupPct} step="0.01" hint="e.g. 0.22 = 22%" suffix="fraction" />
        <Field label="Hybrid inverter cost" name="hybrid_inverter_cost" value={hybridInverterCost} onChange={setHybridInverterCost} suffix="RM flat" />
        <Field label="Battery cost" name="battery_cost_per_kwh" value={batteryCostPerKWh} onChange={setBatteryCostPerKWh} suffix="RM/kWh" />
      </Section>

      <Section title="Equipment">
        <Field label="Panel wattage" name="panel_wattage" value={panelWattage} onChange={setPanelWattage} suffix="W" />
        <Field label="Area per panel" name="area_per_panel" value={areaPerPanel} onChange={setAreaPerPanel} step="0.1" suffix="m²" />
        <Field label="Battery DoD" name="battery_dod" value={batteryDoD} onChange={setBatteryDoD} step="0.01" hint="0–1" />
        <Field label="Battery round-trip eff." name="battery_round_trip_eff" value={batteryRoundTripEff} onChange={setBatteryRoundTripEff} step="0.01" hint="0–1" />
      </Section>

      <Section title="Add-Ons & Financing (EPP)">
        <Field label="Add-on price" name="addon_price" value={addonPrice} onChange={setAddonPrice} suffix="RM" />
        <Field label="Add-on insurance years" name="addon_insurance_years" value={addonInsuranceYears} onChange={setAddonInsuranceYears} suffix="yrs" />
        <Field label="Add-on O&M visits/yr" name="addon_om_visits" value={addonOmVisits} onChange={setAddonOmVisits} suffix="visits/yr" />
        <Field label="Add-on workmanship years" name="addon_workmanship_years" value={addonWorkmanshipYears} onChange={setAddonWorkmanshipYears} suffix="yrs" />
        <div className="col-span-2 sm:col-span-3 grid grid-cols-2 gap-3">
          <TextField label="EPP Bank 1 name" name="epp_bank_1" value={eppBank1} onChange={setEppBank1} placeholder="e.g. Maybank" />
          <Field label="EPP Bank 1 months" name="epp_bank_1_months" value={eppBank1Months} onChange={setEppBank1Months} suffix="mo" />
          <TextField label="EPP Bank 2 name" name="epp_bank_2" value={eppBank2} onChange={setEppBank2} placeholder="e.g. CIMB" />
          <Field label="EPP Bank 2 months" name="epp_bank_2_months" value={eppBank2Months} onChange={setEppBank2Months} suffix="mo" />
          <TextField label="EPP Bank 3 name" name="epp_bank_3" value={eppBank3} onChange={setEppBank3} placeholder="e.g. RHB" />
          <Field label="EPP Bank 3 months" name="epp_bank_3_months" value={eppBank3Months} onChange={setEppBank3Months} suffix="mo" />
        </div>
      </Section>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save assumptions'}
      </button>
    </form>
  );
}
