import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEY, loadClients, saveClients } from '../src/storage.js';

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
