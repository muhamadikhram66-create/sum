import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Nav from '@/components/nav';
import ProposalActions from './proposal-actions';

interface Props {
  params: { id: string };
}

export default async function ProposalDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role ?? 'sales_rep') as 'admin' | 'sales_rep';

  const { data: proposal } = await supabase
    .from('proposals')
    .select(`
      id, status, created_at, inputs, computed_snapshot,
      customers!inner(id, name, address, phone),
      profiles!proposals_created_by_fkey(full_name)
    `)
    .eq('id', params.id)
    .single();

  if (!proposal) notFound();

  const { data: files } = await supabase
    .from('proposal_files')
    .select('id, storage_path, created_at')
    .eq('proposal_id', params.id)
    .order('created_at', { ascending: false });

  const customerRaw = proposal.customers as unknown;
  const customer = (Array.isArray(customerRaw) ? customerRaw[0] : customerRaw) as { id: string; name: string; address?: string; phone?: string };
  const inputs = proposal.inputs as { bill?: number; phase?: string; scheme?: string };
  const date = new Date(proposal.created_at as string).toLocaleDateString('en-MY', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <>
      <Nav role={role} />
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/proposals" className="text-sm text-zinc-400 hover:text-zinc-700">← Proposals</Link>
          <span className="text-zinc-200">|</span>
          <span className="text-sm font-semibold text-zinc-700">{customer.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-zinc-900" style={{ fontFamily: "'Oswald', sans-serif" }}>
                {customer.name}
              </h1>
              {customer.address && <p className="text-sm text-zinc-500 mt-0.5">{customer.address}</p>}
              {customer.phone && <p className="text-sm text-zinc-500">{customer.phone}</p>}
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-400">{date}</div>
              <div className="mt-1">
                <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {proposal.status as string}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-zinc-400">Monthly bill</span><div className="font-semibold">RM {Math.round(inputs?.bill ?? 0)}</div></div>
            <div><span className="text-zinc-400">Phase</span><div className="font-semibold capitalize">{inputs?.phase ?? '—'}</div></div>
            <div><span className="text-zinc-400">Scheme</span><div className="font-semibold uppercase">{inputs?.scheme ?? '—'}</div></div>
          </div>
        </div>

        <ProposalActions proposalId={params.id} files={files ?? []} />

        <div className="flex gap-3">
          <Link
            href={`/calculator?proposalId=${params.id}`}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold px-5 py-2 rounded-lg text-sm transition-colors"
          >
            Open in calculator
          </Link>
        </div>
      </div>
    </>
  );
}
