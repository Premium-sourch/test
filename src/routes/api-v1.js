import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate, adminOnly, apiKeyAuthenticate } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rateLimiter.js';
import {
  getClientsRankedByToday,
  getClientsRankedByWeek,
  getClient,
  getAllClients,
} from '../store/clientCache.js';
import { getPreviousSnapshot } from '../store/leaderboardStore.js';
import {
  getAllKeys,
  addKey,
  findKeyById,
  revokeKey,
  incrementKeyUsage,
} from '../store/apiKeysStore.js';
import { getMergedNumbers } from './numbers.js';

const router = Router();

/* ──────────────────────────────────────────────
   API KEY MANAGEMENT (admin-only, JWT-protected)
   ────────────────────────────────────────────── */

/**
 * POST /api/v1/auth/generate-key
 * Body: { label, rateLimit, expiresAt }
 */
router.post('/auth/generate-key', authenticate, adminOnly, async (req, res) => {
  try {
    const { label, rateLimit, expiresAt } = req.body;

    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'label is required', code: 'VALIDATION_ERROR' });
    }

    const keyData = {
      id: randomUUID(),
      key: randomUUID(),
      secret: randomUUID() + randomUUID(),
      label: label.trim(),
      rateLimit: Number(rateLimit) || 100,
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
      totalRequests: 0,
      lastUsed: null,
      revoked: false,
    };

    await addKey(keyData);

    res.status(201).json({
      message: 'API key generated',
      key: keyData.key,
      secret: keyData.secret,
      id: keyData.id,
      label: keyData.label,
      rateLimit: keyData.rateLimit,
      expiresAt: keyData.expiresAt,
    });
  } catch (err) {
    console.error('[API v1] Generate key error:', err);
    res.status(500).json({ error: 'Failed to generate key', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/v1/auth/keys
 * List all API keys with usage stats.
 */
router.get('/auth/keys', authenticate, adminOnly, async (req, res) => {
  try {
    const keys = await getAllKeys();
    const safeKeys = keys.map(({ secret, ...rest }) => rest);
    res.json({ keys: safeKeys, total: safeKeys.length });
  } catch (err) {
    console.error('[API v1] List keys error:', err);
    res.status(500).json({ error: 'Failed to list keys', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/v1/auth/keys/:keyId
 * Revoke an API key.
 */
router.delete('/auth/keys/:keyId', authenticate, adminOnly, async (req, res) => {
  try {
    const keyId = req.params.keyId;
    const existing = await findKeyById(keyId);

    if (!existing) {
      return res.status(404).json({ error: 'Key not found', code: 'NOT_FOUND' });
    }

    await revokeKey(keyId);
    res.json({ message: 'API key revoked', keyId });
  } catch (err) {
    console.error('[API v1] Revoke key error:', err);
    res.status(500).json({ error: 'Failed to revoke key', code: 'INTERNAL_ERROR' });
  }
});

/* ──────────────────────────────────────
   PUBLIC ENDPOINTS (API-key-protected)
   ────────────────────────────────────── */

// All public endpoints below require a valid API key + rate limit check
router.use(apiKeyAuthenticate, rateLimitMiddleware, async (req, res, next) => {
  // Track usage
  try {
    await incrementKeyUsage(req.apiKey.key);
  } catch { /* non-critical */ }
  next();
});

function computeTrend(username, currentRank, previousSnapshot) {
  if (!previousSnapshot || !previousSnapshot.rankings) return 'same';
  const prevEntry = previousSnapshot.rankings.find((r) => r.username === username);
  if (!prevEntry) return 'up';
  if (currentRank < prevEntry.rank) return 'up';
  if (currentRank > prevEntry.rank) return 'down';
  return 'same';
}

/**
 * GET /api/v1/leaderboard?period=today|week&limit=10
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'today';
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);

    const clients = period === 'week'
      ? getClientsRankedByWeek(limit)
      : getClientsRankedByToday(limit);

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
    console.error('[API v1] Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to generate leaderboard', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/v1/clients
 * List all client usernames with today/week SMS counts.
 */
router.get('/clients', async (req, res) => {
  try {
    const cache = getAllClients();
    const clients = Object.values(cache).map((c) => ({
      username: c.username,
      todaySms: c.todaySms || 0,
      weekSms: c.weekSms || 0,
    }));

    res.json({ clients, total: clients.length });
  } catch (err) {
    console.error('[API v1] Clients error:', err);
    res.status(500).json({ error: 'Failed to list clients', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/v1/clients/:username/stats
 * Detailed stats for one client.
 */
router.get('/clients/:username/stats', async (req, res) => {
  try {
    const client = getClient(req.params.username);

    if (!client) {
      return res.status(404).json({ error: 'Client not found', code: 'NOT_FOUND' });
    }

    // Also try to get numbers from the merged store
    const allNumbers = await getMergedNumbers();
    const clientNumbers = allNumbers.filter((n) => n.assignedTo === client.username);

    res.json({
      username: client.username,
      todaySms: client.todaySms || 0,
      weekSms: client.weekSms || 0,
      numbers: clientNumbers.map((n) => n.number),
      numberCount: clientNumbers.length,
      lastUpdated: client.lastUpdated || null,
    });
  } catch (err) {
    console.error('[API v1] Client stats error:', err);
    res.status(500).json({ error: 'Failed to fetch client stats', code: 'INTERNAL_ERROR' });
  }
});

export default router;
