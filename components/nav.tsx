'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Mountain, Sun, LogOut, Settings2, FileText, Calculator } from 'lucide-react';
import { createClient } from '@/lib/supabase-browser';

export default function Nav({ role }: { role: 'admin' | 'sales_rep' }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const linkCls = (href: string) =>
    'flex items-center gap-1.5 text-sm font-medium transition-colors ' +
    (pathname.startsWith(href) ? 'text-amber-400' : 'text-zinc-400 hover:text-white');

  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="bg-zinc-900 text-white px-4 sm:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="relative w-7 h-7 flex items-center justify-center">
          <Mountain className="w-6 h-6 text-amber-400" strokeWidth={2.5} />
          <Sun className="w-3 h-3 text-amber-400 absolute -top-0.5 -right-0.5" strokeWidth={3} />
        </div>
        <span className="font-extrabold tracking-tight text-base" style={{ fontFamily: "'Oswald', sans-serif" }}>
          SUMMIT ENERGY
        </span>
      </div>
      <div className="flex items-center gap-5">
        <Link href="/calculator" className={linkCls('/calculator')}>
          <Calculator className="w-4 h-4" /> Calculator
        </Link>
        <Link href="/proposals" className={linkCls('/proposals')}>
          <FileText className="w-4 h-4" /> Proposals
        </Link>
        {role === 'admin' && (
          <Link href="/admin/settings" className={linkCls('/admin')}>
            <Settings2 className="w-4 h-4" /> Settings
          </Link>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
}
