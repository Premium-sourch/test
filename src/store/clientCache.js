/**
 * Shared in-memory cache for client data.
 * Populated by the 30-minute poller that scrapes http://51.210.208.26/ints/
 *
 * Expected shape per client:
 * {
 *   username: string,
 *   todaySms: number,
 *   weekSms: number,
 *   numbers: string[],        // phone numbers from agent panel
 *   lastUpdated: string       // ISO timestamp
 * }
 */

const cache = new Map();

export function getClientCache() {
  return cache;
}

export function setClient(username, data) {
  cache.set(username, {
    ...data,
    username,
    lastUpdated: new Date().toISOString(),
  });
}

export function getClient(username) {
  return cache.get(username) || null;
}

export function removeClient(username) {
  cache.delete(username);
}

export function getAllClients() {
  return Object.fromEntries(cache);
}

export function getClientUsernames() {
  return [...cache.keys()];
}

/**
 * Return an array of all clients sorted by todaySms descending.
 */
export function getClientsRankedByToday(limit = 10) {
  const clients = [...cache.values()];
  clients.sort((a, b) => (b.todaySms || 0) - (a.todaySms || 0));
  return clients.slice(0, limit);
}

/**
 * Return an array of all clients sorted by weekSms descending.
 */
export function getClientsRankedByWeek(limit = 10) {
  const clients = [...cache.values()];
  clients.sort((a, b) => (b.weekSms || 0) - (a.weekSms || 0));
  return clients.slice(0, limit);
}

/**
 * Clear the entire cache (used during full refresh from poller).
 */
export function clearCache() {
  cache.clear();
}
