import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import Nav from '@/components/nav';
import { FileText, Plus } from 'lucide-react';

function statusBadge(status: string) {
  const cls: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    sent: 'bg-blue-50 text-blue-700',
    accepted: 'bg-green-50 text-green-700',
    rejected: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${cls[status] ?? cls.draft}`}>
      {status}
    </span>
  );
}

interface Props {
  searchParams: { q?: string };
}

export default async function ProposalsPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role ?? 'sales_rep') as 'admin' | 'sales_rep';

  const q = searchParams.q ?? '';

  let query = supabase
    .from('proposals')
    .select(`
      id, status, created_at, inputs,
      customers!inner(id, name, phone),
      profiles!proposals_created_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (role !== 'admin') {
    query = query.eq('created_by', user.id);
  }

  if (q) {
    query = query.ilike('customers.name', `%${q}%`);
  }

  const { data: proposals } = await query;

  return (
    <>
      <Nav role={role} />
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-zinc-900" style={{ fontFamily: "'Oswald', sans-serif" }}>
            PROPOSALS
          </h1>
          <Link
            href="/calculator"
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> New proposal
          </Link>
        </div>

        {/* Search */}
        <form className="mb-5">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by customer name…"
            className="w-full sm:w-80 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </form>

        {(!proposals || proposals.length === 0) ? (
          <div className="text-center py-20 text-zinc-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{q ? 'No proposals match that search.' : 'No proposals yet — create one from the calculator.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Bill</th>
                  {role === 'admin' && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Rep</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p: Record<string, unknown>, i: number) => {
                  const customer = p.customers as { id: string; name: string; phone?: string };
                  const repProfile = p.profiles as { full_name: string } | null;
                  const inputs = p.inputs as { bill?: number } | null;
                  const date = new Date(p.created_at as string).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
                  return (
                    <tr key={p.id as string} className={`border-b border-zinc-100 hover:bg-zinc-50 ${i % 2 === 0 ? '' : 'bg-zinc-50/30'}`}>
                      <td className="px-4 py-3 font-medium text-zinc-900">{customer?.name}</td>
                      <td className="px-4 py-3 text-zinc-500 tabular-nums">{date}</td>
                      <td className="px-4 py-3">{statusBadge(p.status as string)}</td>
                      <td className="px-4 py-3 text-zinc-500 tabular-nums">
                        {inputs?.bill != null ? `RM ${Math.round(inputs.bill)}` : '—'}
                      </td>
                      {role === 'admin' && (
                        <td className="px-4 py-3 text-zinc-500">{repProfile?.full_name ?? '—'}</td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/calculator?proposalId=${p.id as string}`}
                          className="text-xs font-medium text-amber-600 hover:text-amber-700 mr-3"
                        >
                          Open
                        </Link>
                        <Link
                          href={`/proposals/${p.id as string}`}
                          className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
