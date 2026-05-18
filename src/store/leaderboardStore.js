import { JsonStore } from './jsonStore.js';

const store = new JsonStore('leaderboard-history.json');

/**
 * Snapshot shape:
 * {
 *   id: string (UUID),
 *   date: string (ISO),
 *   period: "today" | "week",
 *   isoWeek: number | null,
 *   isoYear: number | null,
 *   rankings: Array<{ rank, username, todaySms, weekSms }>
 * }
 */

export async function getSnapshots() {
  return (await store.read()) ?? [];
}

export async function addSnapshot(snapshot) {
  return store.update((history) => {
    history.push(snapshot);
    // Keep last 100 snapshots to avoid unbounded growth
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    return history;
  }, []);
}

/**
 * Return the most recent snapshot for the given period, excluding the one
 * with the given id (so you can compare against the previous snapshot).
 */
export async function getPreviousSnapshot(period, excludeId = null) {
  const history = await getSnapshots();
  const filtered = history
    .filter((s) => s.period === period && s.id !== excludeId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered[0] || null;
}

/**
 * Return the latest snapshot for a given period (or null).
 */
export async function getLatestSnapshot(period) {
  const history = await getSnapshots();
  const filtered = history
    .filter((s) => s.period === period)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  return filtered[0] || null;
}
