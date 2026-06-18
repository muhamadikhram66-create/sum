'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sun, Battery, Home, Briefcase, Laptop, Settings2,
  RotateCcw, Info, Mountain, Tag, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  Assumptions, ProfileKey, PROFILES, BATTERY_OPTIONS,
  computeSnapshot, ProposalSnapshot,
} from '@/lib/calculator';
import { createClient } from '@/lib/supabase-browser';

// ─── helpers ─────────────────────────────────────────────────────────────────

function rm(n: number) {
  if (!isFinite(n)) return '—';
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function kwh(n: number) {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-MY', { maximumFractionDigits: 0 }) + ' kWh';
}

// ─── small UI components ──────────────────────────────────────────────────────

function SegButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-1 px-3 py-2 text-sm font-semibold rounded-md transition-colors ' +
        (active ? 'bg-zinc-900 text-amber-400' : 'bg-white text-zinc-500 hover:bg-zinc-100')
      }
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 flex-1 min-w-[140px]">
      <div className="text-xs uppercase tracking-wide text-zinc-500 font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${accent ?? 'text-zinc-900'}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </div>
  );
}

function FlowSegment({ widthPct, color, label, striped }: { widthPct: number; color: string; label: string; striped?: boolean }) {
  if (widthPct <= 0.3) return null;
  return (
    <div
      className="h-full flex items-center justify-center relative"
      style={{
        width: widthPct + '%',
        backgroundColor: color,
        backgroundImage: striped
          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 4px, transparent 4px, transparent 8px)'
          : undefined,
      }}
      title={label}
    >
      {widthPct > 10 && (
        <span className="text-[10px] sm:text-xs font-semibold text-white drop-shadow px-1 truncate">{label}</span>
      )}
    </div>
  );
}

function AssumptionField({ label, value, onChange, step, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: string; suffix?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
      <div className="flex items-center mt-0.5">
        <input
          type="number"
          step={step ?? 'any'}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full border border-zinc-300 rounded-md px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {suffix && <span className="text-xs text-zinc-400 ml-1.5 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  );
}

// ─── package card ─────────────────────────────────────────────────────────────

function PackageCard({
  title, tag, listPrice, price, monthlySavings, billAfter, payback, includes, featured, extra,
}: {
  title: string; tag: string | null; listPrice: number; price: number;
  monthlySavings: number; billAfter: number; payback: number;
  includes: string[]; featured: boolean; extra?: React.ReactNode;
}) {
  const hasDiscount = listPrice > price + 0.5;
  return (
    <div className={
      'rounded-xl p-5 flex-1 min-w-[220px] flex flex-col ' +
      (featured ? 'bg-zinc-900 text-white ring-2 ring-amber-500' : 'bg-white border border-zinc-200')
    }>
      {tag && (
        <span className="self-start text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-zinc-900 px-2 py-0.5 rounded-full mb-2">
          {tag}
        </span>
      )}
      <h3 className="font-extrabold text-lg" style={{ fontFamily: "'Oswald', sans-serif" }}>{title}</h3>
      {extra}
      {hasDiscount && <div className="text-sm text-zinc-400 line-through tabular-nums mt-2">{rm(listPrice)}</div>}
      <div className={`text-2xl font-bold tabular-nums ${hasDiscount ? '' : 'mt-2 '}${featured ? 'text-amber-400' : 'text-zinc-900'}`}>
        {rm(price)}
      </div>
      <div className={`text-xs mt-0.5 ${featured ? 'text-zinc-400' : 'text-zinc-400'}`}>
        {hasDiscount ? rm(listPrice - price) + ' discount applied' : 'installed, before discounts'}
      </div>
      <div className={`mt-4 pt-4 border-t space-y-1.5 ${featured ? 'border-zinc-700' : 'border-zinc-100'}`}>
        <div className="flex justify-between text-sm">
          <span className={featured ? 'text-zinc-400' : 'text-zinc-500'}>Monthly savings</span>
          <span className="font-semibold tabular-nums">{rm(monthlySavings)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className={featured ? 'text-zinc-400' : 'text-zinc-500'}>Bill after</span>
          <span className="font-semibold tabular-nums">{rm(billAfter)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className={featured ? 'text-zinc-400' : 'text-zinc-500'}>Payback</span>
          <span className="font-semibold tabular-nums">{isFinite(payback) ? payback.toFixed(1) + ' yrs' : '—'}</span>
        </div>
      </div>
      <ul className={`mt-4 space-y-1 text-xs flex-1 ${featured ? 'text-zinc-300' : 'text-zinc-500'}`}>
        {includes.map((item, idx) => (
          <li key={idx} className="flex gap-1.5">
            <span className={featured ? 'text-amber-400' : 'text-amber-500'}>+</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── customer modal ───────────────────────────────────────────────────────────

function CustomerModal({
  onSave, onClose,
}: {
  onSave: (c: { name: string; address: string; phone: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Customer name is required.'); return; }
    setSaving(true);
    try { await onSave({ name: name.trim(), address: address.trim(), phone: phone.trim() }); }
    catch (ex: unknown) { setErr(ex instanceof Error ? ex.message : 'Save failed'); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="font-bold text-zinc-900 mb-4">Save proposal — customer details</h2>
        {err && <p className="text-sm text-red-600 mb-3 bg-red-50 rounded p-2">{err}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 font-medium">Customer name *</label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full mt-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium">Address</label>
            <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
              className="w-full mt-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 font-medium">Phone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full mt-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-zinc-300 rounded-md py-2 text-sm text-zinc-600 hover:bg-zinc-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-md py-2 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export interface CalcClientProps {
  assumptions: Assumptions;
  role: 'admin' | 'sales_rep';
  proposalId?: string | null;
  initialInputs?: Partial<{
    bill: number;
    consumption: number;
    phase: 'single' | 'three';
    scheme: 'atap' | 'selco';
    roofArea: number;
    profileKey: ProfileKey;
    panelCountOverride: number | null;
    batterySizeOverride: number | null;
    discountMode: 'pct' | 'rm';
    discountValue: number;
  }>;
}

export default function CalculatorClient({ assumptions: serverAssumptions, role, proposalId, initialInputs }: CalcClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // inputs
  const [bill, setBill] = useState(initialInputs?.bill ?? 450);
  const [consumption, setConsumption] = useState(initialInputs?.consumption ? String(initialInputs.consumption) : '');
  const [phase, setPhase] = useState<'single' | 'three'>(initialInputs?.phase ?? 'single');
  const [scheme, setScheme] = useState<'atap' | 'selco'>(initialInputs?.scheme ?? 'atap');
  const [roofArea, setRoofArea] = useState(initialInputs?.roofArea ? String(initialInputs.roofArea) : '');
  const [profileKey, setProfileKey] = useState<ProfileKey>(initialInputs?.profileKey ?? 'workingFamily');
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [assumptions, setAssumptions] = useState<Assumptions>(serverAssumptions);
  const [discountMode, setDiscountMode] = useState<'pct' | 'rm'>(initialInputs?.discountMode ?? 'pct');
  const [discountValue, setDiscountValue] = useState(initialInputs?.discountValue ?? 0);
  const [panelCountOverride, setPanelCountOverride] = useState<number | null>(initialInputs?.panelCountOverride ?? null);
  const [batterySizeOverride, setBatterySizeOverride] = useState<number | null>(initialInputs?.batterySizeOverride ?? null);

  // UI state
  const [showModal, setShowModal] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [savedProposalId, setSavedProposalId] = useState<string | null>(proposalId ?? null);

  const setA = (key: keyof Assumptions) => (val: number) =>
    setAssumptions(prev => ({ ...prev, [key]: isNaN(val) ? prev[key] : val }));

  const enteredKWh = parseFloat(consumption);
  const hasActualKWh = consumption !== '' && !isNaN(enteredKWh) && enteredKWh > 0;

  const inputs = useMemo(() => ({
    bill,
    consumption: hasActualKWh ? enteredKWh : undefined,
    phase,
    scheme,
    roofArea: parseFloat(roofArea) || 0,
    profileKey,
    panelCountOverride,
    batterySizeOverride,
    discountMode,
    discountValue,
  }), [bill, hasActualKWh, enteredKWh, phase, scheme, roofArea, profileKey, panelCountOverride, batterySizeOverride, discountMode, discountValue]);

  const snap: ProposalSnapshot = useMemo(() => computeSnapshot(inputs, assumptions), [inputs, assumptions]);

  // Reset overrides when core inputs change
  useEffect(() => { setPanelCountOverride(null); }, [snap.monthlyKWh, phase, roofArea, scheme]);
  useEffect(() => { setBatterySizeOverride(null); }, [snap.monthlyKWh, phase, roofArea, scheme, snap.panelCount]);

  const { base, sizing, packages, recommendedBattery, effectiveBatterySize, batteryResult } = snap;
  const isManualBattery = batterySizeOverride !== null && batterySizeOverride !== recommendedBattery.size;

  const boundByText = {
    phase: `capped by your phase's ${scheme === 'atap' ? 'Solar ATAP' : 'SELCO'} limit`,
    roof: 'capped by available roof space',
    usage: 'sized to match typical usage',
  }[sizing.boundBy];

  const flowTotal = Math.max(base.monthlyGeneration, base.selfConsumption + base.exportEnergy, 1);
  const selfPct = (base.selfConsumption / flowTotal) * 100;
  const creditedPct = (base.offsettableExport / flowTotal) * 100;
  const forfeitedPct = (base.forfeitedExport / flowTotal) * 100;

  function stepBattery(dir: 1 | -1) {
    const idx = BATTERY_OPTIONS.indexOf(effectiveBatterySize as (typeof BATTERY_OPTIONS)[number]);
    const newIdx = Math.min(BATTERY_OPTIONS.length - 1, Math.max(0, idx + dir));
    setBatterySizeOverride(BATTERY_OPTIONS[newIdx]);
  }

  async function saveProposal(customer: { name: string; address: string; phone: string }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: cust, error: custErr } = await supabase
      .from('customers')
      .insert({ name: customer.name, address: customer.address, phone: customer.phone, created_by: user.id })
      .select('id')
      .single();
    if (custErr) throw custErr;

    const proposalInputs = { bill, consumption: hasActualKWh ? enteredKWh : undefined, phase, scheme, roofArea: parseFloat(roofArea) || undefined, profileKey, panelCountOverride, batterySizeOverride, discountMode, discountValue };
    const { data: prop, error: propErr } = await supabase
      .from('proposals')
      .insert({ customer_id: cust.id, created_by: user.id, inputs: proposalInputs, status: 'draft' })
      .select('id')
      .single();
    if (propErr) throw propErr;

    setSavedProposalId(prop.id);
    setShowModal(false);
    router.replace(`/calculator?proposalId=${prop.id}`);
  }

  async function generatePDF() {
    if (!savedProposalId) return;
    setPdfLoading(true);
    setPdfError('');
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: savedProposalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'PDF generation failed');
      window.open(json.url, '_blank');
    } catch (ex: unknown) {
      setPdfError(ex instanceof Error ? ex.message : 'PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  }

  // battery stepper UI (rendered inside the "Full Independence" package card)
  const batteryStepper = (
    <div className="mb-3 pb-3 border-b border-dashed border-zinc-700/40">
      <div className="flex items-center gap-2">
        <button
          onClick={() => stepBattery(-1)}
          disabled={effectiveBatterySize <= BATTERY_OPTIONS[0]}
          className={`w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
            effectiveBatterySize > 0 ? 'bg-zinc-800 text-amber-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >−</button>
        <div className={`flex-1 text-center text-sm font-semibold tabular-nums ${effectiveBatterySize > 0 ? 'text-white' : 'text-zinc-500'}`}>
          {effectiveBatterySize > 0 ? `${effectiveBatterySize} kWh battery` : 'No battery'}
        </div>
        <button
          onClick={() => stepBattery(1)}
          disabled={effectiveBatterySize >= BATTERY_OPTIONS[BATTERY_OPTIONS.length - 1]}
          className={`w-6 h-6 rounded-full text-sm font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed ${
            effectiveBatterySize > 0 ? 'bg-zinc-800 text-amber-400 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >+</button>
      </div>
      {isManualBattery && (
        <button
          onClick={() => setBatterySizeOverride(null)}
          className={`flex items-center gap-1 text-[11px] mt-1.5 mx-auto ${
            effectiveBatterySize > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-700'
          }`}
        >
          <RotateCcw className="w-3 h-3" />
          Reset to recommended ({recommendedBattery.size > 0 ? `${recommendedBattery.size}kWh` : 'none'})
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      {showModal && (
        <CustomerModal
          onSave={saveProposal}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-6 space-y-6">

        {/* Input card */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="text-xs text-zinc-500 font-medium mb-3">
            Both figures are printed on the customer&apos;s TNB bill — key in whatever&apos;s on hand
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 font-medium">Monthly bill</label>
              <div className="flex items-center mt-1">
                <span className="text-zinc-400 mr-2 font-semibold">RM</span>
                <input
                  type="number"
                  value={bill}
                  onChange={e => setBill(parseFloat(e.target.value) || 0)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Consumption (optional)</label>
              <div className="flex items-center mt-1">
                <input
                  type="number"
                  placeholder="from bill"
                  value={consumption}
                  onChange={e => setConsumption(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-2 text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-zinc-400 ml-2 font-semibold">kWh</span>
              </div>
            </div>
          </div>
          <div className="text-xs text-zinc-400 mt-2 mb-4">
            {hasActualKWh
              ? `Sizing off the ${kwh(snap.monthlyKWh)} you entered — most accurate.`
              : `≈ ${kwh(snap.monthlyKWh)} estimated from the bill — AFA & EEI excluded. Enter the kWh from the bill for precision.`}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-500 font-medium">Electrical phase</label>
              <div className="flex gap-1 bg-zinc-100 rounded-md p-1 mt-1">
                <SegButton active={phase === 'single'} onClick={() => setPhase('single')}>Single</SegButton>
                <SegButton active={phase === 'three'} onClick={() => setPhase('three')}>Three</SegButton>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500 font-medium">Roof area (optional)</label>
              <div className="flex items-center mt-1">
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={roofArea}
                  onChange={e => setRoofArea(e.target.value)}
                  className="w-full border border-zinc-300 rounded-md px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-xs text-zinc-400 ml-1.5">m²</span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-zinc-500 font-medium">Solar scheme</label>
            <div className="flex gap-1 bg-zinc-100 rounded-md p-1 mt-1">
              <SegButton active={scheme === 'atap'} onClick={() => setScheme('atap')}>Solar ATAP</SegButton>
              <SegButton active={scheme === 'selco'} onClick={() => setScheme('selco')}>SELCO</SegButton>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {scheme === 'atap'
                ? 'Export earns bill credit at the Energy Charge rate. 10-year SEDA contract, RM7.50/kW application fee, TNB meter swap (2–6 weeks).'
                : 'No export allowed — unused generation is clipped. Lighter registration, no SEDA contract, no meter swap wait. Three-phase cap is 12.5kW (vs 15kW for ATAP).'}
            </div>
          </div>

          <label className="text-xs text-zinc-500 font-medium">Usage profile</label>
          <div className="grid grid-cols-3 gap-2 mt-1.5">
            {(Object.entries(PROFILES) as [ProfileKey, typeof PROFILES[ProfileKey]][]).map(([key, p]) => {
              const icons: Record<ProfileKey, React.ElementType> = {
                workingFamily: Briefcase,
                familyAtHome: Home,
                workFromHome: Laptop,
              };
              const Icon = icons[key];
              const active = profileKey === key;
              return (
                <button
                  key={key}
                  onClick={() => setProfileKey(key)}
                  className={`rounded-lg p-2.5 text-left border transition-colors ${
                    active ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-1 ${active ? 'text-amber-600' : 'text-zinc-400'}`} />
                  <div className="text-xs font-semibold text-zinc-800 leading-tight">{p.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    {Math.round(p.day * 100)}% day / {Math.round(p.night * 100)}% night
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hero result */}
        <div className="bg-zinc-900 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wide text-zinc-400 font-semibold">Recommended system</div>
            {panelCountOverride !== null && panelCountOverride !== sizing.recommendedPanels && (
              <button onClick={() => setPanelCountOverride(null)} className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300">
                <RotateCcw className="w-3 h-3" /> Reset to {sizing.recommendedPanels}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => setPanelCountOverride(Math.max(1, snap.panelCount - 1))}
              disabled={snap.panelCount <= 1}
              className="w-8 h-8 rounded-full bg-zinc-800 text-amber-400 text-lg font-bold flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >−</button>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl font-extrabold tabular-nums" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {base.size.toFixed(2)} kWp
              </span>
              <span className="text-xs text-zinc-400">
                {snap.panelCount} × {assumptions.panelWattage}W panels · {base.inverterKWac.toFixed(1)}kW inverter · {boundByText}
              </span>
            </div>
            <button
              onClick={() => setPanelCountOverride(Math.min(sizing.maxPanels, snap.panelCount + 1))}
              disabled={snap.panelCount >= sizing.maxPanels}
              className="w-8 h-8 rounded-full bg-zinc-800 text-amber-400 text-lg font-bold flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >+</button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div>
              <div className="text-[11px] text-zinc-400">Bill before</div>
              <div className="text-lg font-bold tabular-nums">{rm(Math.max(0, bill))}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">Bill after</div>
              <div className="text-lg font-bold tabular-nums text-amber-400">{rm(packages[0].billAfter)}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-400">You save monthly</div>
              <div className="text-lg font-bold tabular-nums text-amber-400">{rm(packages[0].monthlySavings)}</div>
            </div>
          </div>
        </div>

        {/* Energy flow */}
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-zinc-800">Where this month&apos;s generation goes</h3>
            <span className="text-xs text-zinc-400 tabular-nums">{kwh(base.monthlyGeneration)} generated</span>
          </div>
          <div className="h-8 rounded-md overflow-hidden flex w-full bg-zinc-100">
            <FlowSegment widthPct={selfPct} color="#d97706" label="Self-consumed" />
            {scheme === 'atap' && <FlowSegment widthPct={creditedPct} color="#fbbf24" label="Exported, credited" />}
            <FlowSegment widthPct={forfeitedPct} color="#a8a29e" striped
              label={scheme === 'atap' ? 'Exported, forfeited' : 'Clipped, not exported'} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-zinc-500">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: '#d97706' }} />Self-consumed: {kwh(base.selfConsumption)}</span>
            {scheme === 'atap' && (
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: '#fbbf24' }} />Credited export: {kwh(base.offsettableExport)}</span>
            )}
            {base.forfeitedExport > 1 && (
              <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: '#a8a29e' }} />{scheme === 'atap' ? 'Forfeited' : 'Clipped (SELCO)'}: {kwh(base.forfeitedExport)}</span>
            )}
          </div>
          {base.forfeitedExport > 1 && (
            <div className="flex gap-1.5 mt-3 text-xs text-zinc-500 bg-zinc-50 rounded-md p-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-zinc-400" />
              <span>
                {scheme === 'atap'
                  ? "This much export exceeds what you actually import that month and is forfeited under Solar ATAP rules — it's shown here instead of hidden, and it's exactly the gap a battery can close."
                  : "SELCO does not allow any export to the grid, so this much generation is clipped and wasted entirely — every bit of it is recoverable with a correctly sized battery."}
              </span>
            </div>
          )}
        </div>

        {/* Savings breakdown */}
        <div className="flex flex-wrap gap-3">
          <StatCard label="Self-consumption savings" value={rm(base.selfConsumptionSavings)} sub="avoids the full retail bundle" />
          <StatCard label="Export savings" value={rm(base.exportSavings)}
            sub={scheme === 'atap' ? 'energy charge line only, capped' : 'not applicable — SELCO disallows export'} />
          <StatCard
            label={effectiveBatterySize > 0 ? 'Battery savings' : 'Battery savings (if added)'}
            value={rm(batteryResult ? batteryResult.batterySavings : 0)}
            sub={
              effectiveBatterySize > 0
                ? `${effectiveBatterySize} kWh ${isManualBattery ? 'selected' : 'recommended'}`
                : recommendedBattery.reason === 'no-excess' ? 'no meaningful excess to shift' : 'no size pays back within 10 yrs'
            }
            accent="text-amber-600"
          />
        </div>

        {/* Packages */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-bold text-zinc-800" style={{ fontFamily: "'Oswald', sans-serif" }}>PACKAGE COMPARISON</h3>
            <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-md px-2 py-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs text-zinc-500 font-medium">Discount</span>
              <div className="flex gap-0.5 bg-zinc-100 rounded p-0.5">
                <button onClick={() => setDiscountMode('pct')} className={`text-xs px-2 py-0.5 rounded ${discountMode === 'pct' ? 'bg-zinc-900 text-amber-400' : 'text-zinc-500'}`}>%</button>
                <button onClick={() => setDiscountMode('rm')} className={`text-xs px-2 py-0.5 rounded ${discountMode === 'rm' ? 'bg-zinc-900 text-amber-400' : 'text-zinc-500'}`}>RM</button>
              </div>
              <input
                type="number"
                value={discountValue}
                onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                className="w-16 border border-zinc-300 rounded px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            {packages.map((p, i) => (
              <PackageCard
                key={i}
                {...p}
                extra={i === 2 ? batteryStepper : undefined}
              />
            ))}
          </div>
          <div className="text-[11px] text-zinc-400 mt-2">
            List price = (system + battery/inverter cost) × (1 + markup). Discount applies on top to get the final selling price.
          </div>
        </div>

        {/* Save / PDF actions */}
        <div className="flex flex-wrap gap-3">
          {!savedProposalId ? (
            <button
              onClick={() => setShowModal(true)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold px-6 py-2.5 rounded-lg transition-colors"
            >
              Save proposal
            </button>
          ) : (
            <>
              <button
                onClick={generatePDF}
                disabled={pdfLoading}
                className="bg-zinc-900 hover:bg-zinc-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {pdfLoading ? 'Generating PDF…' : 'Generate & download PDF'}
              </button>
              {pdfError && <span className="text-sm text-red-600 self-center">{pdfError}</span>}
            </>
          )}
        </div>

        {/* Assumptions panel (visible to all, write-back only for admin) */}
        <div>
          <button
            onClick={() => setShowAssumptions(s => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-amber-600 transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            {showAssumptions ? 'Hide' : 'Show'} assumptions
            {showAssumptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showAssumptions && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5 mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-zinc-800">
                  {role === 'admin' ? 'Admin assumptions' : 'Assumptions (read-only — contact admin to change)'}
                </h3>
                {role === 'admin' && (
                  <button
                    onClick={() => setAssumptions(serverAssumptions)}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-amber-600"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset to saved
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {role === 'admin' ? (
                  <>
                    <AssumptionField label="Yield factor" value={assumptions.yieldFactor} onChange={setA('yieldFactor')} suffix="kWh/kWp/mo" />
                    <AssumptionField label="Energy rate (≤1500kWh)" value={assumptions.energyRateLow} onChange={setA('energyRateLow')} step="0.0001" suffix="RM/kWh" />
                    <AssumptionField label="Energy rate (>1500kWh)" value={assumptions.energyRateHigh} onChange={setA('energyRateHigh')} step="0.0001" suffix="RM/kWh" />
                    <AssumptionField label="Capacity charge" value={assumptions.capacityRate} onChange={setA('capacityRate')} step="0.0001" suffix="RM/kWh" />
                    <AssumptionField label="Network charge" value={assumptions.networkRate} onChange={setA('networkRate')} step="0.0001" suffix="RM/kWh" />
                    <AssumptionField label="Sun-hours (MAQ)" value={assumptions.sunHoursMAQ} onChange={setA('sunHoursMAQ')} suffix="hrs/day" />
                    <AssumptionField label="DC:AC oversize ratio" value={assumptions.dcAcOversizeRatio} onChange={setA('dcAcOversizeRatio')} step="0.05" suffix="× inverter" />
                    <AssumptionField label="Oversize clipping loss" value={Math.round(assumptions.oversizeClippingLossPct * 1000) / 10} onChange={v => setA('oversizeClippingLossPct')(v / 100)} suffix="%" />
                    <AssumptionField label="System cost" value={assumptions.costPerKWp} onChange={setA('costPerKWp')} suffix="RM/kWp" />
                    <AssumptionField label="Markup" value={Math.round(assumptions.markupPct * 1000) / 10} onChange={v => setA('markupPct')(v / 100)} suffix="%" />
                    <AssumptionField label="Hybrid inverter cost" value={assumptions.hybridInverterCost} onChange={setA('hybridInverterCost')} suffix="RM flat" />
                    <AssumptionField label="Battery cost" value={assumptions.batteryCostPerKWh} onChange={setA('batteryCostPerKWh')} suffix="RM/kWh" />
                    <AssumptionField label="Battery DoD" value={assumptions.batteryDoD} onChange={setA('batteryDoD')} step="0.01" suffix="0–1" />
                    <AssumptionField label="Battery round-trip eff." value={assumptions.batteryRoundTripEff} onChange={setA('batteryRoundTripEff')} step="0.01" suffix="0–1" />
                    <AssumptionField label="Panel wattage" value={assumptions.panelWattage} onChange={setA('panelWattage')} suffix="W" />
                  </>
                ) : (
                  <div className="col-span-3 text-xs text-zinc-500 space-y-1">
                    <div>Yield factor: <strong>{assumptions.yieldFactor} kWh/kWp/mo</strong></div>
                    <div>Energy rate: <strong>RM{assumptions.energyRateLow}/kWh (≤1500 kWh), RM{assumptions.energyRateHigh}/kWh (&gt;1500 kWh)</strong></div>
                    <div>System cost: <strong>RM{assumptions.costPerKWp}/kWp</strong> · Markup: <strong>{Math.round(assumptions.markupPct * 100)}%</strong></div>
                    <div>Battery: <strong>RM{assumptions.batteryCostPerKWh}/kWh</strong> · Panel: <strong>{assumptions.panelWattage}W</strong></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-[11px] text-zinc-400 leading-relaxed pt-2">
          Estimates only — based on advised usage patterns, current Solar ATAP rules, and the TNB tariff schedule effective July 2025.
          Actual savings vary with site conditions, real consumption behaviour, and future tariff or policy changes. Not a binding quotation.
        </div>
      </div>
    </div>
  );
}
