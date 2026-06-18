import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set: (_n: string, _v: string, _o: CookieOptions) => {},
      remove: (_n: string, _o: CookieOptions) => {},
    } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const path = req.nextUrl.searchParams.get('path');
  if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 });

  const { data } = await supabase.storage
    .from('proposal-pdfs')
    .createSignedUrl(path, 300);

  if (!data?.signedUrl) return NextResponse.json({ error: 'Could not get signed URL' }, { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
