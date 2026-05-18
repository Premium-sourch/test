import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate, adminOnly } from '../middleware/auth.js';
import {
  getClientsRankedByToday,
  getClientsRankedByWeek,
} from '../store/clientCache.js';
import {
  addSnapshot,
  getPreviousSnapshot,
} from '../store/leaderboardStore.js';

const router = Router();

/**
 * Compute trend for a client by comparing current rank with a previous snapshot.
 */
function computeTrend(username, currentRank, previousSnapshot) {
  if (!previousSnapshot || !previousSnapshot.rankings) return 'same';

  const prevEntry = previousSnapshot.rankings.find((r) => r.username === username);
  if (!prevEntry) return 'up'; // wasn't in previous top 10 → upward entry

  if (currentRank < prevEntry.rank) return 'up';
  if (currentRank > prevEntry.rank) return 'down';
  return 'same';
}

/**
 * GET /api/leaderboard?period=today|week
 * Returns top 10 clients ranked by SMS count with trend.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'today';
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const clients = period === 'week'
      ? getClientsRankedByWeek(limit)
      : getClientsRankedByToday(limit);

    // Fetch previous snapshot for trend calculation
    const previousSnapshot = await getPreviousSnapshot(period);

    const rankings = clients.map((client, index) => {
      const rank = index + 1;
      return {
        rank,
        username: client.username,
        todaySms: client.todaySms || 0,
        weekSms: client.weekSms || 0,
        trend: computeTrend(client.username, rank, previousSnapshot),
      };
    });

    res.json({
      period,
      generatedAt: new Date().toISOString(),
      rankings,
    });
  } catch (err) {
    console.error('[Leaderboard] GET error:', err);
    res.status(500).json({ error: 'Failed to generate leaderboard', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/leaderboard/snapshot
 * Admin-only — saves current rankings for trend calculation.
 */
router.post('/snapshot', authenticate, adminOnly, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const snapshotId = randomUUID();

    // Determine ISO week info
    const d = new Date();
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    const isoYear = d.getUTCFullYear();

    // Snapshot both periods
    const todayClients = getClientsRankedByToday(10);
    const weekClients = getClientsRankedByWeek(10);

    const todaySnapshot = {
      id: randomUUID(),
      date: now,
      period: 'today',
      isoWeek,
      isoYear,
      rankings: todayClients.map((c, i) => ({
        rank: i + 1,
        username: c.username,
        todaySms: c.todaySms || 0,
        weekSms: c.weekSms || 0,
      })),
    };

    const weekSnapshot = {
      id: randomUUID(),
      date: now,
      period: 'week',
      isoWeek,
      isoYear,
      rankings: weekClients.map((c, i) => ({
        rank: i + 1,
        username: c.username,
        todaySms: c.todaySms || 0,
        weekSms: c.weekSms || 0,
      })),
    };

    await addSnapshot(todaySnapshot);
    await addSnapshot(weekSnapshot);

    res.json({
      message: 'Snapshot saved for both periods',
      snapshotDate: now,
      todaySnapshotId: todaySnapshot.id,
      weekSnapshotId: weekSnapshot.id,
    });
  } catch (err) {
    console.error('[Leaderboard] Snapshot error:', err);
    res.status(500).json({ error: 'Failed to save snapshot', code: 'INTERNAL_ERROR' });
  }
});

export default router;
