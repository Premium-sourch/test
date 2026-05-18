import { JsonStore } from './jsonStore.js';

const store = new JsonStore('numbers.json');

/**
 * numbers.json shape:
 * {
 *   "+1234567890": {
 *     assignedTo: "username" | null,
 *     assignedDate: "2024-01-15T10:30:00.000Z" | null,
 *     status: "active" | "inactive"
 *   },
 *   ...
 * }
 */

export async function getAllNumbers() {
  return (await store.read()) ?? {};
}

export async function assignNumber(number, username) {
  return store.update((data) => {
    data[number] = {
      assignedTo: username,
      assignedDate: new Date().toISOString(),
      status: 'active',
    };
    return data;
  }, {});
}

export async function unassignNumber(number) {
  return store.update((data) => {
    if (data[number]) {
      data[number].assignedTo = null;
      data[number].assignedDate = null;
      data[number].status = 'inactive';
    }
    return data;
  }, {});
}

export async function getNumber(number) {
  const data = await getAllNumbers();
  return data[number] || null;
}

export async function setNumberStatus(number, status) {
  return store.update((data) => {
    if (data[number]) {
      data[number].status = status;
    }
    return data;
  }, {});
}
