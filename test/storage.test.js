import { test } from 'node:test';
import assert from 'node:assert/strict';

import { removeClient, setClientStatus, updateClient } from '../src/clients.js';
import {
  STATUS_FILTER_KEY,
  STORAGE_KEY,
  loadClients,
  loadStatusFilter,
  saveClients,
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
  assert.deepEqual(loadClients(createMemoryStorage()), []);
});

test('saved clients are restored after a reload', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  // A "reload" is a fresh load from the same storage.
  assert.deepEqual(loadClients(storage), clients);
});

test('saving replaces the previous list', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  saveClients(storage, [clients[1]]);
  assert.deepEqual(loadClients(storage), [clients[1]]);
});

test('stores data as JSON under a fixed key', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), clients);
});

test('returns an empty list when saved data is corrupted', () => {
  assert.deepEqual(loadClients(createMemoryStorage({ [STORAGE_KEY]: '{not json' })), []);
});

test('returns an empty list when saved data is not a list', () => {
  assert.deepEqual(loadClients(createMemoryStorage({ [STORAGE_KEY]: '{"id":"a"}' })), []);
});

test('clients saved before statuses existed load unchanged', () => {
  const legacy = JSON.stringify(clients);
  assert.deepEqual(loadClients(createMemoryStorage({ [STORAGE_KEY]: legacy })), clients);
});

test('a changed status is restored after a reload', () => {
  const storage = createMemoryStorage();
  saveClients(storage, setClientStatus(clients, 'b', 'done'));
  const [first, second] = loadClients(storage);
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
  assert.deepEqual(loadClients(storage), clients);
});

test('an edited client is restored after a reload with the same id, status and createdAt', () => {
  const storage = createMemoryStorage();
  const withStatus = setClientStatus(clients, 'a', 'in_progress');
  saveClients(storage, updateClient(withStatus, 'a', { name: 'Иван Иванов', phone: '+7 900 111-11-11' }));
  const [restored] = loadClients(storage);
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
  saveClients(storage, removeClient(loadClients(storage), 'a'));
  assert.deepEqual(loadClients(storage), [clients[1]]);
});

test('cancelled deletion leaves saved data unchanged', () => {
  const storage = createMemoryStorage();
  saveClients(storage, clients);
  const before = storage.getItem(STORAGE_KEY);
  // Cancelling means removeClient's result is never saved.
  removeClient(loadClients(storage), 'a');
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.deepEqual(loadClients(storage), clients);
});
