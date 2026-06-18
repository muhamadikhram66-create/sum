import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import Nav from '@/components/nav';
import SettingsForm from './settings-form';

export default async function AdminSettingsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/calculator');

  const { data: row } = await supabase.from('assumptions').select('*').single();

  return (
    <>
      <Nav role="admin" />
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-zinc-900 mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>
          ADMIN SETTINGS
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Business assumptions — changes here affect all new proposal calculations immediately.
        </p>

        {/* TNB tariff period reminder */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-900">
          <strong>Tariff period reminder:</strong> Malaysia&apos;s current TNB Regulatory Period 4 (RP4) rates run through
          31 December 2027. Review and update the tariff fields below before that date when RP5 rates are gazetted.
          {row?.updated_at && (
            <div className="mt-1 text-xs text-amber-700">
              Last updated: {new Date(row.updated_at as string).toLocaleString('en-MY')}
              {row.updated_by && ` by profile ${row.updated_by}`}
            </div>
          )}
        </div>

        <SettingsForm row={row as Record<string, unknown>} />
      </div>
    </>
  );
}
