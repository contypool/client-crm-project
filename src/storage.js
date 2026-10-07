// Saving and loading clients. The storage object is passed in
// (window.localStorage in the browser, a fake object in tests).

import { ALL_STATUSES, isValidStatusFilter } from './clients.js';

export const STORAGE_KEY = 'client-crm.clients';
export const STATUS_FILTER_KEY = 'client-crm.status-filter';

export function loadClients(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveClients(storage, clients) {
  storage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

export function loadStatusFilter(storage) {
  const filter = storage.getItem(STATUS_FILTER_KEY);
  return isValidStatusFilter(filter) ? filter : ALL_STATUSES;
}

export function saveStatusFilter(storage, filter) {
  storage.setItem(STATUS_FILTER_KEY, filter);
}
