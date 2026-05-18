import { useState, useEffect, useCallback } from 'react';

interface NumberEntry {
  number: string;
  assignedTo: string | null;
  assignedDate: string | null;
  status: 'active' | 'inactive';
  source: 'auto' | 'manual';
}

interface NumbersResponse {
  numbers: NumberEntry[];
  total: number;
}

function getApiBase(): string {
  return '';
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export default function NumberSection() {
  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [assignNumber, setAssignNumber] = useState('');
  const [assignUsername, setAssignUsername] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchNumbers = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/numbers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: NumbersResponse = await res.json();
      setNumbers(json.numbers);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch numbers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();
  }, [fetchNumbers]);

  const handleAssign = async () => {
    if (!assignNumber.trim() || !assignUsername.trim()) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const token = getToken();
      const res = await fetch(`${getApiBase()}/api/numbers/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: assignUsername.trim(), number: assignNumber.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setActionMessage({ type: 'success', text: `Number ${assignNumber} assigned to ${assignUsername}` });
      setAssignNumber('');
      setAssignUsername('');
      await fetchNumbers();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassign = async (number: string) => {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const token = getToken();
      const res = await fetch(`${getApiBase()}/api/numbers/${encodeURIComponent(number)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setActionMessage({ type: 'success', text: `Number ${number} unassigned` });
      setExpandedRow(null);
      await fetchNumbers();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Filter by search
  const filtered = numbers.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.number.toLowerCase().includes(q) ||
      (n.assignedTo && n.assignedTo.toLowerCase().includes(q)) ||
      n.status.includes(q) ||
      n.source.includes(q)
    );
  });

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Phone Numbers</h2>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} of {numbers.length} numbers
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search numbers or clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full sm:w-72"
          />
        </div>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-900/30 border-emerald-700 text-emerald-300'
              : 'bg-red-900/30 border-red-700 text-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="ml-4 text-current opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Assign form (inline, not modal) */}
      {!loading && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign New Number</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Phone number (e.g. +923001234567)"
              value={assignNumber}
              onChange={(e) => setAssignNumber(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              placeholder="Username"
              value={assignUsername}
              onChange={(e) => setAssignUsername(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleAssign}
              disabled={actionLoading || !assignNumber.trim() || !assignUsername.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {actionLoading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-800/80 border-b border-gray-700">
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Number</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Assigned Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Assigned Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const isExpanded = expandedRow === entry.number;
                return (
                  <>
                    <tr
                      key={entry.number}
                      className="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : entry.number)}
                    >
                      <td className="px-4 py-3">
                        <svg
                          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </td>
                      <td className="px-4 py-3 font-mono text-white text-sm">{entry.number}</td>
                      <td className="px-4 py-3 text-gray-200 text-sm">
                        {entry.assignedTo || <span className="text-gray-500 italic">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{formatDate(entry.assignedDate)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.status === 'active'
                              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.source === 'manual'
                              ? 'bg-indigo-900/40 text-indigo-400 border border-indigo-700/50'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          {entry.source}
                        </span>
                      </td>
                    </tr>

                    {/* Expanded row — inline actions */}
                    {isExpanded && (
                      <tr key={`${entry.number}-expanded`} className="bg-gray-800/30">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="text-sm text-gray-300">
                              <span className="text-gray-500">Number:</span>{' '}
                              <span className="font-mono text-white">{entry.number}</span>
                            </div>
                            <div className="text-sm text-gray-300">
                              <span className="text-gray-500">Client:</span>{' '}
                              <span className="text-white">{entry.assignedTo || 'None'}</span>
                            </div>
                            {entry.assignedTo && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnassign(entry.number);
                                }}
                                disabled={actionLoading}
                                className="px-4 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-700/50 text-red-400 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                              >
                                Unassign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {search ? 'No numbers match your search.' : 'No numbers found. Wait for the next poll cycle.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
