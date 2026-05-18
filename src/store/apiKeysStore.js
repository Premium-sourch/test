import { JsonStore } from './jsonStore.js';

const store = new JsonStore('api-keys.json');

/**
 * api-keys.json shape:
 * [
 *   {
 *     id: string (UUID),
 *     key: string (UUID),
 *     secret: string (hex),
 *     label: string,
 *     rateLimit: number (requests per hour),
 *     expiresAt: string (ISO) | null,
 *     createdAt: string (ISO),
 *     totalRequests: number,
 *     lastUsed: string (ISO) | null,
 *     revoked: boolean
 *   }
 * ]
 */

export async function getAllKeys() {
  return (await store.read()) ?? [];
}

export async function addKey(keyData) {
  return store.update((keys) => {
    keys.push(keyData);
    return keys;
  }, []);
}

export async function findKeyByKey(apiKey) {
  const keys = await getAllKeys();
  return keys.find((k) => k.key === apiKey && !k.revoked) || null;
}

export async function findKeyById(keyId) {
  const keys = await getAllKeys();
  return keys.find((k) => k.id === keyId) || null;
}

export async function revokeKey(keyId) {
  return store.update((keys) => {
    const entry = keys.find((k) => k.id === keyId);
    if (entry) {
      entry.revoked = true;
    }
    return keys;
  }, []);
}

export async function incrementKeyUsage(apiKey) {
  return store.update((keys) => {
    const entry = keys.find((k) => k.key === apiKey);
    if (entry) {
      entry.totalRequests = (entry.totalRequests || 0) + 1;
      entry.lastUsed = new Date().toISOString();
    }
    return keys;
  }, []);
}
