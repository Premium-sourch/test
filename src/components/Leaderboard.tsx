import { useState, useEffect, useCallback } from 'react';

interface LeaderboardEntry {
  rank: number;
  username: string;
  todaySms: number;
  weekSms: number;
  trend: 'up' | 'down' | 'same';
}

interface LeaderboardResponse {
  period: string;
  generatedAt: string;
  rankings: LeaderboardEntry[];
}

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function getApiBase(): string {
  return ''; // Same origin; change if API is on a different host
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center text-emerald-400">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        <span className="text-xs font-medium">Up</span>
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center text-red-400">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-xs font-medium">Down</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-gray-500">
      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
      <span className="text-xs font-medium">Same</span>
    </span>
  );
}

export default function Leaderboard() {
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [prevRanks, setPrevRanks] = useState<Map<string, number>>(new Map());

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/leaderboard?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const json: LeaderboardResponse = await res.json();

      // Store previous ranks for animation
      setPrevRanks((prev) => {
        const next = new Map(prev);
        for (const entry of json.rankings) {
          // Will use current ranks as "previous" next time
        }
        return next;
      });

      setData(json);
      setLastUpdated(json.generatedAt);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch leaderboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="w-full">
      <style>{`
        @keyframes rankSlideUp {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes rankSlideDown {
          from { transform: translateY(-12px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes rankFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .rank-up    { animation: rankSlideUp   0.4s ease-out; }
        .rank-down  { animation: rankSlideDown 0.4s ease-out; }
        .rank-same  { animation: rankFadeIn    0.3s ease-out; }
      `}</style>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">SMS Leaderboard</h2>
          <p className="text-sm text-gray-400 mt-1">
            Last updated: {formatTime(lastUpdated)}
          </p>
        </div>

        {/* Period Toggle */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === 'today'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === 'week'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            This Week
          </button>
        </div>
      </div>

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

      {/* Table */}
      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-800/80 border-b border-gray-700">
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16">Rank</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Today SMS</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Week SMS</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-center w-28">Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.rankings.map((entry) => {
                const animClass =
                  entry.trend === 'up'
                    ? 'rank-up'
                    : entry.trend === 'down'
                    ? 'rank-down'
                    : 'rank-same';

                return (
                  <tr
                    key={entry.username}
                    className={`border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors ${animClass}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getMedal(entry.rank) && (
                          <span className="text-lg">{getMedal(entry.rank)}</span>
                        )}
                        <span
                          className={`font-bold ${
                            entry.rank <= 3 ? 'text-yellow-400' : 'text-gray-300'
                          }`}
                        >
                          #{entry.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{entry.username}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-200 font-mono">
                        {entry.todaySms.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-200 font-mono">
                        {entry.weekSms.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TrendArrow trend={entry.trend} />
                    </td>
                  </tr>
                );
              })}
              {data.rankings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No data available yet. Wait for the next poll cycle.
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
