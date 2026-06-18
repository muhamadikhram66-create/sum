import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { rowToAssumptions } from '@/lib/db-assumptions';
import { computeSnapshot, ProposalInputs } from '@/lib/calculator';
import { fillTemplate, AddonSettings } from '@/lib/proposal-template';
import templateHtml from '@/lib/proposal-template-html';

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (_n: string, _v: string, _o: CookieOptions) => {},
        remove: (_n: string, _o: CookieOptions) => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const proposalId = req.nextUrl.searchParams.get('proposalId');
  if (!proposalId) return new NextResponse('proposalId required', { status: 400 });

  const { data: proposal } = await supabase
    .from('proposals')
    .select('id, inputs, customers!inner(name, address, phone)')
    .eq('id', proposalId)
    .single();
  if (!proposal) return new NextResponse('Not found', { status: 404 });

  const { data: aRow } = await supabase.from('assumptions').select('*').single();
  const assumptions = aRow ? rowToAssumptions(aRow as Record<string, unknown>) : null;
  if (!assumptions) return new NextResponse('Assumptions not configured', { status: 500 });

  const inputs = proposal.inputs as ProposalInputs;
  const snapshot = computeSnapshot(inputs, assumptions);

  const addon: AddonSettings = {
    addon_price: aRow?.['addon_price'] as number | null,
    addon_insurance_years: aRow?.['addon_insurance_years'] as number | null,
    addon_om_visits: aRow?.['addon_om_visits'] as number | null,
    addon_workmanship_years: aRow?.['addon_workmanship_years'] as number | null,
    epp_bank_1: aRow?.['epp_bank_1'] as string | null,
    epp_bank_1_months: aRow?.['epp_bank_1_months'] as number | null,
    epp_bank_2: aRow?.['epp_bank_2'] as string | null,
    epp_bank_2_months: aRow?.['epp_bank_2_months'] as number | null,
    epp_bank_3: aRow?.['epp_bank_3'] as string | null,
    epp_bank_3_months: aRow?.['epp_bank_3_months'] as number | null,
  };

  const customerRaw = proposal.customers as unknown;
  const customer = (Array.isArray(customerRaw) ? customerRaw[0] : customerRaw) as { name: string; address?: string; phone?: string };

  const filled = fillTemplate(templateHtml, snapshot, customer, addon);

  // Inject auto-print script so opening the page triggers the print dialog
  const html = filled.replace(
    '</body>',
    `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},600);});</script></body>`
  );

  // Mark proposal as sent
  await supabase.from('proposals').update({ status: 'sent', computed_snapshot: snapshot as unknown as Record<string, unknown> }).eq('id', proposalId);

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
