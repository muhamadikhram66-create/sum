'use client';

import { useState } from 'react';
import { FileText, Download, RefreshCw } from 'lucide-react';

interface ProposalFile {
  id: string;
  storage_path: string;
  created_at: string;
}

export default function ProposalActions({
  proposalId,
  files,
}: {
  proposalId: string;
  files: ProposalFile[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localFiles, setLocalFiles] = useState(files);

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Generation failed');
      window.open(json.url, '_blank');
      // prepend new file record to list
      if (json.fileId) {
        setLocalFiles(prev => [{ id: json.fileId, storage_path: json.path, created_at: new Date().toISOString() }, ...prev]);
      }
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5">
      <h2 className="font-bold text-sm text-zinc-800 mb-4">Generated documents</h2>

      {localFiles.length === 0 ? (
        <p className="text-sm text-zinc-400 mb-4">No PDF generated yet.</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {localFiles.map(f => (
            <li key={f.id} className="flex items-center gap-3 text-sm">
              <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <span className="text-zinc-600 flex-1 truncate">{new Date(f.created_at).toLocaleString('en-MY')}</span>
              <a
                href={`/api/download-pdf?path=${encodeURIComponent(f.storage_path)}`}
                target="_blank"
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 font-medium"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        onClick={generate}
        disabled={loading}
        className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Generating…' : 'Generate PDF'}
      </button>
    </div>
  );
}
