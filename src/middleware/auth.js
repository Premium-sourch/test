import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-default-secret';

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 * Attaches req.user on success.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', code: 'AUTH_MISSING' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

/**
 * Admin-only middleware — must be used AFTER authenticate.
 * Checks req.user.role === 'admin' or req.user.isAdmin === true.
 */
export function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
  }
  if (req.user.role !== 'admin' && req.user.isAdmin !== true) {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  next();
}

/**
 * API-key authentication middleware for public /api/v1 endpoints.
 * Expects: X-API-Key: <key>
 */
export async function apiKeyAuthenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header', code: 'API_KEY_MISSING' });
  }

  const { findKeyByKey } = await import('../store/apiKeysStore.js');
  const keyData = await findKeyByKey(apiKey);

  if (!keyData) {
    return res.status(401).json({ error: 'Invalid API key', code: 'API_KEY_INVALID' });
  }

  if (keyData.revoked) {
    return res.status(401).json({ error: 'API key has been revoked', code: 'API_KEY_REVOKED' });
  }

  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'API key has expired', code: 'API_KEY_EXPIRED' });
  }

  req.apiKey = keyData;
  next();
}
