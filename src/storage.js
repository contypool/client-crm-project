// Saving and loading clients. The storage object is passed in
// (window.localStorage in the browser, a fake object in tests).
// Storage errors (blocked storage, full quota) never throw out of this module:
// loads fall back to defaults and saves report false.

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
  unavailable: 'unavailable', // storage cannot be read at all
  unreadable: 'unreadable', // not JSON or not a list: nothing could be loaded
  repaired: 'repaired', // some entries were broken and have been fixed
};

// Returns the browser storage, or null when the browser blocks access to it
// (reading window.localStorage then throws a SecurityError).
export function openStorage(getStorage = () => window.localStorage) {
  try {
    return getStorage() ?? null;
  } catch {
    return null;
  }
}

// Returns the stored string (or null when nothing is stored), or undefined when it cannot be read.
function readItem(storage, key) {
  if (storage === null) {
    return undefined;
  }
  try {
    return storage.getItem(key);
  } catch {
    return undefined;
  }
}

// Returns true when the value was written.
function writeItem(storage, key, value) {
  if (storage === null) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// Returns { clients, problem }, plus backupFailed: true when the backup could not be written.
// Damaged data is never lost silently: the original string is copied to BACKUP_KEY first.
// Unreadable data stays under STORAGE_KEY until the next save; a repaired list is saved
// right away, but only after the backup succeeded.
export function loadClients(storage, createId = () => crypto.randomUUID()) {
  const raw = readItem(storage, STORAGE_KEY);
  if (raw === undefined) {
    return { clients: [], problem: LOAD_PROBLEMS.unavailable };
  }
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
    return withBackupResult({ clients: [], problem: LOAD_PROBLEMS.unreadable }, writeItem(storage, BACKUP_KEY, raw));
  }

  const { clients, changed } = normalizeStoredClients(data, createId);
  if (!changed) {
    return { clients, problem: null };
  }

  const backedUp = writeItem(storage, BACKUP_KEY, raw);
  if (backedUp) {
    saveClients(storage, clients);
  }
  return withBackupResult({ clients, problem: LOAD_PROBLEMS.repaired }, backedUp);
}

function withBackupResult(result, backedUp) {
  return backedUp ? result : { ...result, backupFailed: true };
}

// Returns the storage the client list may be saved to, or null when clients are read-only:
// storage is unavailable, or damaged data could not be backed up and must not be overwritten.
// Pass the result of loadClients. The status filter and sort are saved separately and stay writable.
export function clientsStorageAfterLoad(storage, loaded) {
  if (loaded.problem === LOAD_PROBLEMS.unavailable || loaded.backupFailed) {
    return null;
  }
  return storage;
}

// Returns true when the list was saved.
export function saveClients(storage, clients) {
  return writeItem(storage, STORAGE_KEY, JSON.stringify(clients));
}

// Saves `next` and returns { clients, saved }. When saving fails, `clients` is the
// unchanged `current` list, so nothing unsaved is kept in memory.
export function commitClients(storage, current, next) {
  return saveClients(storage, next) ? { clients: next, saved: true } : { clients: current, saved: false };
}

export function loadStatusFilter(storage) {
  const filter = readItem(storage, STATUS_FILTER_KEY);
  return isValidStatusFilter(filter) ? filter : ALL_STATUSES;
}

// Returns true when the filter was saved.
export function saveStatusFilter(storage, filter) {
  return writeItem(storage, STATUS_FILTER_KEY, filter);
}

export function loadSort(storage) {
  const sort = readItem(storage, SORT_KEY);
  return isValidSort(sort) ? sort : DEFAULT_SORT;
}

// Returns true when the sort was saved.
export function saveSort(storage, sort) {
  return writeItem(storage, SORT_KEY, sort);
}
