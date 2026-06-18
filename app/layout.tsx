import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Summit Energy — Solar Proposal Tool',
  description: 'Solar system sizing and proposal generation for Summit Energy Resources Sdn Bhd',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900" style={{ fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
