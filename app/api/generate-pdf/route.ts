/**
 * PDF generation endpoint.
 *
 * PDF rendering approach: @sparticuz/chromium + puppeteer-core.
 * Trade-off vs alternatives:
 *   - Full headless Chrome (~130 MB) exceeds Vercel's 50 MB function limit.
 *   - @sparticuz/chromium ships a Lambda-compatible compressed Chromium binary (~50 MB
 *     compressed, decompressed at runtime). Cold starts take ~3–5 s due to decompression;
 *     warm invocations are fast. For infrequent PDF generation this is acceptable.
 *   - A dedicated rendering service (browserless.io / html-pdf-node) avoids cold starts but
 *     adds external infrastructure and monthly cost — overkill for v1.
 * Decision: @sparticuz/chromium is the right call for now. Revisit if cold starts become
 * a user-facing problem.
 *
 * The template already uses A4 print CSS with page-break-after; Puppeteer honours this.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { rowToAssumptions } from '@/lib/db-assumptions';
import { computeSnapshot, ProposalInputs } from '@/lib/calculator';
import { fillTemplate, AddonSettings } from '@/lib/proposal-template';

async function launchBrowser() {
  // In production (Vercel / Lambda) use @sparticuz/chromium.
  // Locally (dev) fall back to system Chrome / Puppeteer's bundled binary.
  if (process.env.NODE_ENV === 'production') {
    const chromium = (await import('@sparticuz/chromium')).default;
    const puppeteer = (await import('puppeteer-core')).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    const puppeteer = (await import('puppeteer-core')).default;
    // Try common Chrome locations for local dev
    const execPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    return puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: execPaths.find(p => { try { require('fs').accessSync(p); return true; } catch { return false; } }) ?? execPaths[0],
      headless: true,
    });
  }
}

export async function POST(req: NextRequest) {
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { proposalId: string };
  if (!body.proposalId) return NextResponse.json({ error: 'proposalId required' }, { status: 400 });

  // Load proposal
  const { data: proposal, error: propErr } = await supabase
    .from('proposals')
    .select('id, inputs, customers!inner(name, address, phone)')
    .eq('id', body.proposalId)
    .single();

  if (propErr || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  // Load assumptions
  const { data: aRow } = await supabase.from('assumptions').select('*').single();
  const assumptions = aRow ? rowToAssumptions(aRow as Record<string, unknown>) : null;
  if (!assumptions) return NextResponse.json({ error: 'Assumptions not configured' }, { status: 500 });

  // Run calculator
  const inputs = proposal.inputs as ProposalInputs;
  const snapshot = computeSnapshot(inputs, assumptions);

  // Build addon settings
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

  // Load and fill HTML template — fetch as a static asset (works reliably on Vercel)
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : `http://localhost:${process.env.PORT ?? 3000}`;
  let templateHtml: string;
  try {
    const res = await fetch(`${host}/proposal-template.html`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    templateHtml = await res.text();
  } catch (err) {
    return NextResponse.json({ error: `Template fetch failed: ${err instanceof Error ? err.message : err}` }, { status: 500 });
  }

  const customerRaw = proposal.customers as unknown;
  const customer = (Array.isArray(customerRaw) ? customerRaw[0] : customerRaw) as { name: string; address?: string; phone?: string };
  const filledHtml = fillTemplate(templateHtml, snapshot, customer, addon);

  // Render to PDF
  let pdfBuffer: Buffer;
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(filledHtml, { waitUntil: 'networkidle0' });
    pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: `PDF render failed: ${err instanceof Error ? err.message : 'unknown'}` }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }

  // Upload to Supabase Storage
  const storagePath = `proposals/${body.proposalId}/${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from('proposal-pdfs')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });

  if (uploadErr) return NextResponse.json({ error: `Storage upload failed: ${uploadErr.message}` }, { status: 500 });

  // Get signed URL (1 hour)
  const { data: signedData } = await supabase.storage
    .from('proposal-pdfs')
    .createSignedUrl(storagePath, 3600);

  // Record the file
  const { data: fileRow } = await supabase
    .from('proposal_files')
    .insert({ proposal_id: body.proposalId, storage_path: storagePath })
    .select('id')
    .single();

  // Update proposal snapshot
  await supabase
    .from('proposals')
    .update({ computed_snapshot: snapshot as unknown as Record<string, unknown>, status: 'sent' })
    .eq('id', body.proposalId);

  return NextResponse.json({ url: signedData?.signedUrl, path: storagePath, fileId: fileRow?.id });
}
