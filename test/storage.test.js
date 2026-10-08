import { test } from 'node:test';
import assert from 'node:assert/strict';

import { removeClient, setClientStatus, updateClient } from '../src/clients.js';
import {
  SORT_KEY,
  STATUS_FILTER_KEY,
  BACKUP_KEY,
  LOAD_PROBLEMS,
  STORAGE_KEY,
  clientsStorageAfterLoad,
  commitClients,
  loadClients,
  loadSort,
  loadStatusFilter,
  openStorage,
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

// Storage whose getItem and/or setItem throw, like a blocked or full localStorage.
// `failingKeys` limits setItem failures to these keys (all keys when omitted).
function createFailingStorage(initial = {}, { getItem = false, setItem = false, failingKeys } = {}) {
  const storage = createMemoryStorage(initial);
  const { getItem: read, setItem: write } = storage;
  return {
    getItem: (key) => {
      if (getItem) {
        throw new DOMException('Access is denied', 'SecurityError');
      }
      return read(key);
    },
    setItem: (key, value) => {
      if (setItem && (!failingKeys || failingKeys.includes(key))) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      write(key, value);
    },
  };
}

test('openStorage returns null when access to the storage is blocked', () => {
  const blocked = () => {
    throw new DOMException('Access is denied', 'SecurityError');
  };
  assert.equal(openStorage(blocked), null);
});

test('openStorage returns the storage when it is available', () => {
  const storage = createMemoryStorage();
  assert.equal(openStorage(() => storage), storage);
});

test('without storage nothing is loaded and the problem is reported', () => {
  assert.deepEqual(loadClients(null), { clients: [], problem: LOAD_PROBLEMS.unavailable });
});

test('a throwing getItem does not stop loading clients', () => {
  const storage = createFailingStorage({ [STORAGE_KEY]: JSON.stringify(clients) }, { getItem: true });
  assert.deepEqual(loadClients(storage), { clients: [], problem: LOAD_PROBLEMS.unavailable });
});

test('status filter and sort fall back to defaults when they cannot be read', () => {
  const storage = createFailingStorage({ [STATUS_FILTER_KEY]: 'done', [SORT_KEY]: 'name-asc' }, { getItem: true });
  for (const target of [storage, null]) {
    assert.equal(loadStatusFilter(target), loadStatusFilter(createMemoryStorage()));
    assert.equal(loadSort(target), loadSort(createMemoryStorage()));
  }
});

test('unreadable data still loads when the backup cannot be written', () => {
  const raw = '{not json';
  const storage = createFailingStorage({ [STORAGE_KEY]: raw }, { setItem: true });
  assert.deepEqual(loadClients(storage), { clients: [], problem: LOAD_PROBLEMS.unreadable, backupFailed: true });
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(BACKUP_KEY), null);
});

test('repaired data is not saved over the original when the backup cannot be written', () => {
  const raw = JSON.stringify([null, clients[0]]);
  const storage = createFailingStorage({ [STORAGE_KEY]: raw }, { setItem: true, failingKeys: [BACKUP_KEY] });
  const result = loadClients(storage, idGenerator());

  assert.deepEqual(result, { clients: [clients[0]], problem: LOAD_PROBLEMS.repaired, backupFailed: true });
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(BACKUP_KEY), null);
});

test('repaired data still loads when saving the repaired list fails', () => {
  const raw = JSON.stringify([null, clients[0]]);
  const storage = createFailingStorage({ [STORAGE_KEY]: raw }, { setItem: true, failingKeys: [STORAGE_KEY] });
  const result = loadClients(storage, idGenerator());

  assert.deepEqual(result, { clients: [clients[0]], problem: LOAD_PROBLEMS.repaired });
  assert.equal(storage.getItem(BACKUP_KEY), raw);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('saveClients reports success', () => {
  const storage = createMemoryStorage();
  assert.equal(saveClients(storage, clients), true);
  assert.deepEqual(loadClients(storage).clients, clients);
});

test('saveClients reports failure and keeps the previously saved list when setItem throws', () => {
  const saved = JSON.stringify(clients);
  const storage = createFailingStorage({ [STORAGE_KEY]: saved }, { setItem: true });
  assert.equal(saveClients(storage, [clients[0]]), false);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('saveClients reports failure without storage', () => {
  assert.equal(saveClients(null, clients), false);
});

test('status filter and sort report failure when they cannot be saved', () => {
  const storage = createFailingStorage({}, { setItem: true });
  for (const target of [storage, null]) {
    assert.equal(saveStatusFilter(target, 'done'), false);
    assert.equal(saveSort(target, 'name-asc'), false);
  }
  assert.equal(saveStatusFilter(createMemoryStorage(), 'done'), true);
  assert.equal(saveSort(createMemoryStorage(), 'name-asc'), true);
});

test('commitClients returns the new list after a successful save', () => {
  const storage = createMemoryStorage();
  const next = [...clients];
  const result = commitClients(storage, [], next);
  assert.equal(result.saved, true);
  assert.equal(result.clients, next);
  assert.deepEqual(loadClients(storage).clients, next);
});

test('commitClients keeps the current list unchanged when saving fails', () => {
  const current = [clients[0]];
  const next = [...current, clients[1]];
  for (const storage of [createFailingStorage({}, { setItem: true }), null]) {
    const result = commitClients(storage, current, next);
    assert.equal(result.saved, false);
    assert.equal(result.clients, current);
    assert.deepEqual(current, [clients[0]]);
  }
});

// Strict mode: when damaged data could not be backed up, the client list is read-only.

test('clients stay writable after a normal load, a backed-up repair or a backed-up unreadable load', () => {
  const cases = [
    createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(clients) }),
    createMemoryStorage({ [STORAGE_KEY]: JSON.stringify([null, clients[0]]) }),
    createMemoryStorage({ [STORAGE_KEY]: '{not json' }),
    createMemoryStorage(),
  ];
  for (const storage of cases) {
    const loaded = loadClients(storage, idGenerator());
    assert.equal(clientsStorageAfterLoad(storage, loaded), storage);
  }
});

test('clients are read-only when the storage is unavailable', () => {
  assert.equal(clientsStorageAfterLoad(null, loadClients(null)), null);
  const storage = createFailingStorage({}, { getItem: true });
  assert.equal(clientsStorageAfterLoad(storage, loadClients(storage)), null);
});

test('clients are read-only when unreadable data could not be backed up', () => {
  const storage = createFailingStorage({ [STORAGE_KEY]: '{not json' }, { setItem: true, failingKeys: [BACKUP_KEY] });
  assert.equal(clientsStorageAfterLoad(storage, loadClients(storage)), null);
});

test('clients are read-only when repaired data could not be backed up', () => {
  const storage = createFailingStorage(
    { [STORAGE_KEY]: JSON.stringify([null, clients[0]]) },
    { setItem: true, failingKeys: [BACKUP_KEY] },
  );
  assert.equal(clientsStorageAfterLoad(storage, loadClients(storage, idGenerator())), null);
});

test('no change to clients overwrites damaged data that has no backup', () => {
  for (const raw of ['{not json', JSON.stringify([null, clients[0]])]) {
    // Only the backup fails: saving the client list itself would work.
    const storage = createFailingStorage({ [STORAGE_KEY]: raw }, { setItem: true, failingKeys: [BACKUP_KEY] });
    const loaded = loadClients(storage, idGenerator());
    const target = clientsStorageAfterLoad(storage, loaded);

    const changes = [
      [...loaded.clients, clients[1]], // add
      loaded.clients.map((client) => ({ ...client, name: 'Новое имя' })), // edit
      loaded.clients.map((client) => ({ ...client, status: 'done' })), // status
      [], // delete
    ];
    for (const next of changes) {
      const result = commitClients(target, loaded.clients, next);
      assert.equal(result.saved, false, raw);
      assert.equal(result.clients, loaded.clients, raw);
    }
    assert.equal(storage.getItem(STORAGE_KEY), raw, raw);
    assert.equal(storage.getItem(BACKUP_KEY), null, raw);
  }
});

test('status filter and sort can still be saved when clients are read-only', () => {
  const raw = '{not json';
  const storage = createFailingStorage({ [STORAGE_KEY]: raw }, { setItem: true, failingKeys: [BACKUP_KEY] });
  loadClients(storage);
  assert.equal(saveStatusFilter(storage, 'done'), true);
  assert.equal(saveSort(storage, 'name-asc'), true);
  assert.equal(loadStatusFilter(storage), 'done');
  assert.equal(loadSort(storage), 'name-asc');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
