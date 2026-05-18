import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAllClients } from '../store/clientCache.js';
import {
  getAllNumbers,
  assignNumber,
  unassignNumber,
  setNumberStatus,
} from '../store/numbersStore.js';

const router = Router();

/**
 * Merge auto-discovered numbers (from clientCache) with manual assignments
 * (from numbers.json).  Manual assignments take precedence for status/date.
 */
async function getMergedNumbers() {
  const clientCache = getAllClients();
  const manualNumbers = await getAllNumbers();

  const merged = {};

  // Auto-discovered numbers from the agent panel
  for (const [username, data] of Object.entries(clientCache)) {
    const numbers = data.numbers || [];
    for (const num of numbers) {
      merged[num] = {
        number: num,
        assignedTo: username,
        assignedDate: data.lastUpdated || null,
        status: 'active',
        source: 'auto',
      };
    }
  }

  // Manual assignments — override auto entries where they overlap
  for (const [number, info] of Object.entries(manualNumbers)) {
    merged[number] = {
      number,
      assignedTo: info.assignedTo,
      assignedDate: info.assignedDate,
      status: info.status || 'active',
      source: 'manual',
    };
  }

  return Object.values(merged);
}

/**
 * GET /api/numbers
 * List all phone numbers (merged auto + manual).
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const allNumbers = await getMergedNumbers();
    res.json({ numbers: allNumbers, total: allNumbers.length });
  } catch (err) {
    console.error('[Numbers] GET all error:', err);
    res.status(500).json({ error: 'Failed to fetch numbers', code: 'INTERNAL_ERROR' });
  }
});

/**
 * GET /api/numbers/:username
 * Get numbers for a specific client.
 */
router.get('/:username', authenticate, async (req, res) => {
  try {
    const allNumbers = await getMergedNumbers();
    const clientNumbers = allNumbers.filter(
      (n) => n.assignedTo === req.params.username
    );
    res.json({ username: req.params.username, numbers: clientNumbers, total: clientNumbers.length });
  } catch (err) {
    console.error('[Numbers] GET by username error:', err);
    res.status(500).json({ error: 'Failed to fetch numbers', code: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/numbers/assign
 * Body: { username, number }
 * Assign a number to a client (stored in numbers.json).
 */
router.post('/assign', authenticate, async (req, res) => {
  try {
    const { username, number } = req.body;

    if (!username || !number) {
      return res.status(400).json({
        error: 'Both username and number are required',
        code: 'VALIDATION_ERROR',
      });
    }

    // Validate phone number format (loose check)
    const cleaned = number.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{7,15}$/.test(cleaned)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        code: 'VALIDATION_ERROR',
      });
    }

    await assignNumber(cleaned, username);

    res.json({
      message: `Number ${cleaned} assigned to ${username}`,
      number: cleaned,
      assignedTo: username,
    });
  } catch (err) {
    console.error('[Numbers] Assign error:', err);
    res.status(500).json({ error: 'Failed to assign number', code: 'INTERNAL_ERROR' });
  }
});

/**
 * DELETE /api/numbers/:number
 * Unassign a number.
 */
router.delete('/:number', authenticate, async (req, res) => {
  try {
    const number = req.params.number;

    await unassignNumber(number);

    res.json({
      message: `Number ${number} unassigned`,
      number,
    });
  } catch (err) {
    console.error('[Numbers] Unassign error:', err);
    res.status(500).json({ error: 'Failed to unassign number', code: 'INTERNAL_ERROR' });
  }
});

export default router;
