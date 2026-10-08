// Saving and loading clients. The storage object is passed in
// (window.localStorage in the browser, a fake object in tests).

import {
  ALL_STATUSES,
  DEFAULT_SORT,
  isValidSort,
  isValidStatusFilter,
  normalizeStoredClients,
} from './clients.js';

export const STORAGE_KEY = 'client-crm.clients';
export const BACKUP_KEY = 'client-crm.clients.backup';
export const STATUS_FILTER_KEY = 'client-crm.status-filter';
export const SORT_KEY = 'client-crm.sort';

// What went wrong with the saved list, if anything.
export const LOAD_PROBLEMS = {
  unreadable: 'unreadable', // not JSON or not a list: nothing could be loaded
  repaired: 'repaired', // some entries were broken and have been fixed
};

// Returns { clients, problem }. Damaged data is never lost silently: the original
// string is copied to BACKUP_KEY first. Unreadable data stays under STORAGE_KEY
// until the next save; a repaired list is saved right away.
export function loadClients(storage, createId = () => crypto.randomUUID()) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return { clients: [], problem: null };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = undefined;
  }

  if (!Array.isArray(data)) {
    storage.setItem(BACKUP_KEY, raw);
    return { clients: [], problem: LOAD_PROBLEMS.unreadable };
  }

  const { clients, changed } = normalizeStoredClients(data, createId);
  if (!changed) {
    return { clients, problem: null };
  }

  storage.setItem(BACKUP_KEY, raw);
  saveClients(storage, clients);
  return { clients, problem: LOAD_PROBLEMS.repaired };
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

export function loadSort(storage) {
  const sort = storage.getItem(SORT_KEY);
  return isValidSort(sort) ? sort : DEFAULT_SORT;
}

export function saveSort(storage, sort) {
  storage.setItem(SORT_KEY, sort);
}
