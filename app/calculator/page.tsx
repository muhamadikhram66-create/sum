import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { rowToAssumptions } from '@/lib/db-assumptions';
import { DEFAULT_ASSUMPTIONS } from '@/lib/calculator';
import Nav from '@/components/nav';
import CalculatorClient from './calculator-client';

interface Props {
  searchParams: { proposalId?: string };
}

export default async function CalculatorPage({ searchParams }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role ?? 'sales_rep') as 'admin' | 'sales_rep';

  // Load assumptions from DB
  const { data: aRow } = await supabase.from('assumptions').select('*').single();
  const assumptions = aRow ? rowToAssumptions(aRow as Record<string, unknown>) : DEFAULT_ASSUMPTIONS;

  // Pre-fill from saved proposal if ?proposalId= is given
  let initialInputs: Record<string, unknown> | undefined;
  let proposalId: string | null = null;

  if (searchParams.proposalId) {
    const { data: prop } = await supabase
      .from('proposals')
      .select('id, inputs')
      .eq('id', searchParams.proposalId)
      .single();

    if (prop) {
      proposalId = prop.id as string;
      initialInputs = prop.inputs as Record<string, unknown>;
    }
  }

  return (
    <>
      <Nav role={role} />
      <CalculatorClient
        assumptions={assumptions}
        role={role}
        proposalId={proposalId}
        initialInputs={initialInputs as Parameters<typeof CalculatorClient>[0]['initialInputs']}
      />
    </>
  );
}
