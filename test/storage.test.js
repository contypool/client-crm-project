import { test } from 'node:test';
import assert from 'node:assert/strict';

import { removeClient, setClientStatus, updateClient } from '../src/clients.js';
import {
  SORT_KEY,
  STATUS_FILTER_KEY,
  BACKUP_KEY,
  LOAD_PROBLEMS,
  STORAGE_KEY,
  loadClients,
  loadSort,
  loadStatusFilter,
  saveClients,
  saveSort,
  saveStatusFilter,
} from '../src/storage.js';

// In-memory stand-in for window.localStorage.
function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const clients = [
  { id: 'a', name: 'Иван Петров', phone: '+7 900 000-00-00', createdAt: '2026-10-07T10:00:00.000Z' },
  { id: 'b', name: 'ООО Ромашка', phone: '123', createdAt: '2026-10-07T11:00:00.000Z' },
];

test('returns an empty list when nothing is saved yet', () => {
  assert.deepEqual(loadClients(createMemoryStorage()).clients, []);
});

test('saved clients are restored after a reload', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  // A "reload" is a fresh load from the same storage.
  assert.deepEqual(loadClients(storage).clients, clients);
});

test('saving replaces the previous list', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  saveClients(storage, [clients[1]]);
  assert.deepEqual(loadClients(storage).clients, [clients[1]]);
});

test('stores data as JSON under a fixed key', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), clients);
});

test('clients saved before statuses existed load unchanged', () => {
  const legacy = JSON.stringify(clients);
  assert.deepEqual(loadClients(createMemoryStorage({ [STORAGE_KEY]: legacy })).clients, clients);
});

test('a changed status is restored after a reload', () => {
  const storage = createMemoryStorage();
  saveClients(storage, setClientStatus(clients, 'b', 'done'));
  const [first, second] = loadClients(storage).clients;
  assert.equal(first.status, undefined);
  assert.equal(second.status, 'done');
});

test('status filter is "all" when nothing is saved yet', () => {
  assert.equal(loadStatusFilter(createMemoryStorage()), 'all');
});

test('saved status filter is restored after a reload', () => {
  const storage = createMemoryStorage();
  saveStatusFilter(storage, 'in_progress');
  assert.equal(loadStatusFilter(storage), 'in_progress');
});

test('an unknown saved status filter falls back to "all"', () => {
  assert.equal(loadStatusFilter(createMemoryStorage({ [STATUS_FILTER_KEY]: 'archived' })), 'all');
});

test('saving the status filter does not touch saved clients', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  saveStatusFilter(storage, 'done');
  assert.notEqual(STATUS_FILTER_KEY, STORAGE_KEY);
  assert.deepEqual(loadClients(storage).clients, clients);
});

test('an edited client is restored after a reload with the same id, status and createdAt', () => {
  const storage = createMemoryStorage();
  const withStatus = setClientStatus(clients, 'a', 'in_progress');
  saveClients(storage, updateClient(withStatus, 'a', { name: 'Иван Иванов', phone: '+7 900 111-11-11' }));
  const [restored] = loadClients(storage).clients;
  assert.deepEqual(restored, {
    id: 'a',
    name: 'Иван Иванов',
    phone: '+7 900 111-11-11',
    status: 'in_progress',
    createdAt: '2026-10-07T10:00:00.000Z',
  });
});

test('a removed client is gone after a reload, others stay', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  saveClients(storage, removeClient(loadClients(storage).clients, 'a'));
  assert.deepEqual(loadClients(storage).clients, [clients[1]]);
});

test('cancelled deletion leaves saved data unchanged', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  const before = storage.getItem(STORAGE_KEY);
  // Cancelling means removeClient's result is never saved.
  removeClient(loadClients(storage).clients, 'a');
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.deepEqual(loadClients(storage).clients, clients);
});

test('sort is the default when nothing is saved yet', () => {
  assert.equal(loadSort(createMemoryStorage()), 'created-asc');
});

test('saved sort is restored after a reload', () => {
  const storage = createMemoryStorage();
  saveSort(storage, 'name-desc');
  assert.equal(loadSort(storage), 'name-desc');
});

test('an unknown saved sort falls back to the default', () => {
  assert.equal(loadSort(createMemoryStorage({ [SORT_KEY]: 'price' })), 'created-asc');
});

test('saving the sort does not touch clients or the status filter', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  saveStatusFilter(storage, 'done');
  saveSort(storage, 'name-asc');
  assert.equal(new Set([SORT_KEY, STATUS_FILTER_KEY, STORAGE_KEY]).size, 3);
  assert.deepEqual(loadClients(storage).clients, clients);
  assert.equal(loadStatusFilter(storage), 'done');
});

// Predictable ids for repaired clients.
function idGenerator() {
  let next = 0;
  return () => `new-${++next}`;
}

test('empty storage loads without a problem and without a backup', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadClients(storage), { clients: [], problem: null });
  assert.equal(storage.getItem(BACKUP_KEY), null);
});

test('valid data loads without a problem and without a backup', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  assert.deepEqual(loadClients(storage), { clients, problem: null });
  assert.equal(storage.getItem(BACKUP_KEY), null);
});

test('unreadable JSON is backed up and not overwritten', () => {
  const raw = '{not json';
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
  assert.deepEqual(loadClients(storage), { clients: [], problem: LOAD_PROBLEMS.unreadable });
  assert.equal(storage.getItem(BACKUP_KEY), raw);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('saved data that is not a list is treated as unreadable', () => {
  for (const raw of ['{"id":"a"}', '"text"', 'null', '42', '']) {
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    assert.deepEqual(loadClients(storage), { clients: [], problem: LOAD_PROBLEMS.unreadable }, raw);
    assert.equal(storage.getItem(BACKUP_KEY), raw);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('a list with broken entries is repaired, backed up and saved', () => {
  const raw = JSON.stringify([null, clients[0], 5, { name: 'Без id', phone: 7 }]);
  const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
  const result = loadClients(storage, idGenerator());

  const expected = [clients[0], { name: 'Без id', phone: '7', id: 'new-1' }];
  assert.deepEqual(result, { clients: expected, problem: LOAD_PROBLEMS.repaired });
  assert.equal(storage.getItem(BACKUP_KEY), raw);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), expected);
});

test('repaired data loads without a problem on the next reload', () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: '[null, {"name":"A","phone":"1"}]' });
  loadClients(storage, idGenerator());
  assert.equal(loadClients(storage).problem, null);
});

test('a newer damaged string replaces the previous backup', () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: 'old broken', [BACKUP_KEY]: 'older' });
  loadClients(storage);
  assert.equal(storage.getItem(BACKUP_KEY), 'old broken');
});
