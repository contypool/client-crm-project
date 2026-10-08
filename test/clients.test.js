import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_STATUSES,
  DEFAULT_SORT,
  DEFAULT_STATUS,
  SORT_OPTIONS,
  STATUSES,
  createClient,
  filterClientsByStatus,
  findClientWithPhone,
  getClientStatus,
  getVisibleClients,
  isValidSort,
  isValidStatusFilter,
  normalizePhone,
  removeClient,
  searchClients,
  setClientStatus,
  sortClients,
  updateClient,
  validateClient,
} from '../src/clients.js';

const options = { id: 'client-1', now: new Date('2026-10-07T10:00:00.000Z') };

test('accepts a client with name and phone', () => {
  assert.deepEqual(validateClient({ name: 'Иван Петров', phone: '+7 900 000-00-00' }), {
    valid: true,
    errors: {},
  });
});

test('requires a name', () => {
  const result = validateClient({ name: '', phone: '+7 900 000-00-00' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.name, 'Укажите имя клиента.');
  assert.equal(result.errors.phone, undefined);
});

test('treats a whitespace-only name as empty', () => {
  assert.equal(validateClient({ name: '   ', phone: '123' }).errors.name, 'Укажите имя клиента.');
});

test('requires a phone', () => {
  const result = validateClient({ name: 'ООО Ромашка', phone: '' });
  assert.equal(result.valid, false);
  assert.equal(result.errors.phone, 'Укажите телефон клиента.');
  assert.equal(result.errors.name, undefined);
});

test('treats a whitespace-only phone as empty', () => {
  assert.equal(validateClient({ name: 'Иван', phone: '  ' }).errors.phone, 'Укажите телефон клиента.');
});

test('reports both errors when name and phone are missing', () => {
  const result = validateClient({});
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ['name', 'phone']);
});

test('createClient trims fields and adds id, status "new" and creation date', () => {
  assert.deepEqual(createClient({ name: '  Иван  ', phone: ' 123 ' }, options), {
    id: 'client-1',
    name: 'Иван',
    phone: '123',
    status: 'new',
    createdAt: '2026-10-07T10:00:00.000Z',
  });
});

test('createClient rejects invalid data', () => {
  assert.throws(() => createClient({ name: '', phone: '' }, options), (error) => {
    assert.deepEqual(Object.keys(error.fields).sort(), ['name', 'phone']);
    return true;
  });
});

test('there are three statuses with Russian labels, "new" by default', () => {
  assert.deepEqual(STATUSES, [
    { value: 'new', label: 'Новый' },
    { value: 'in_progress', label: 'В работе' },
    { value: 'done', label: 'Завершён' },
  ]);
  assert.equal(DEFAULT_STATUS, 'new');
});

test('getClientStatus returns the saved status', () => {
  assert.equal(getClientStatus({ status: 'in_progress' }), 'in_progress');
  assert.equal(getClientStatus({ status: 'done' }), 'done');
});

test('getClientStatus treats clients without a valid status as new', () => {
  assert.equal(getClientStatus({ id: 'old', name: 'Иван' }), 'new');
  assert.equal(getClientStatus({ status: null }), 'new');
  assert.equal(getClientStatus({ status: 'Новый' }), 'new');
  assert.equal(getClientStatus({ status: 'archived' }), 'new');
});

const stored = [
  { id: 'a', name: 'Иван', phone: '1', createdAt: '2026-10-07T10:00:00.000Z' },
  { id: 'b', name: 'Пётр', phone: '2', status: 'in_progress', createdAt: '2026-10-07T11:00:00.000Z' },
  { id: 'c', name: 'Анна', phone: '3', status: 'done', createdAt: '2026-10-07T12:00:00.000Z' },
];

test('setClientStatus changes only the given client and keeps other fields', () => {
  const result = setClientStatus(stored, 'a', 'done');
  assert.deepEqual(result[0], { ...stored[0], status: 'done' });
  assert.equal(result[1], stored[1]);
  assert.equal(result[2], stored[2]);
});

test('setClientStatus does not modify the original list', () => {
  const copy = structuredClone(stored);
  setClientStatus(stored, 'b', 'new');
  assert.deepEqual(stored, copy);
});

test('setClientStatus rejects an unknown status', () => {
  assert.throws(() => setClientStatus(stored, 'a', 'archived'), /Неизвестный статус/);
  assert.throws(() => setClientStatus(stored, 'a', undefined), /Неизвестный статус/);
});

test('setClientStatus leaves the list unchanged for an unknown id', () => {
  assert.deepEqual(setClientStatus(stored, 'missing', 'done'), stored);
});

test('filter "all" returns every client', () => {
  assert.deepEqual(filterClientsByStatus(stored, ALL_STATUSES), stored);
});

test('filter by status returns only matching clients', () => {
  assert.deepEqual(filterClientsByStatus(stored, 'in_progress'), [stored[1]]);
  assert.deepEqual(filterClientsByStatus(stored, 'done'), [stored[2]]);
});

test('clients without a status match the "new" filter', () => {
  assert.deepEqual(filterClientsByStatus(stored, 'new'), [stored[0]]);
});

test('filter returns an empty list when nothing matches', () => {
  assert.deepEqual(filterClientsByStatus([stored[0]], 'done'), []);
});

test('isValidStatusFilter accepts "all" and known statuses only', () => {
  for (const value of ['all', 'new', 'in_progress', 'done']) {
    assert.equal(isValidStatusFilter(value), true);
  }
  for (const value of [null, '', 'Все', 'archived']) {
    assert.equal(isValidStatusFilter(value), false);
  }
});

const directory = [
  { id: 'a', name: 'Иван Петров', phone: '+7 (900) 000-00-00', status: 'done', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: 'b', name: 'ООО Ромашка', phone: '123-45', createdAt: '2026-10-02T10:00:00.000Z' },
];

test('normalizePhone ignores spaces, brackets, dashes and "+"', () => {
  assert.equal(normalizePhone('+7 (900) 000-00-00'), '79000000000');
  assert.equal(normalizePhone(' 12 3-45 '), '12345');
  assert.equal(normalizePhone(undefined), '');
});

test('findClientWithPhone finds a client with the same phone written differently', () => {
  assert.equal(findClientWithPhone(directory, '79000000000'), directory[0]);
  assert.equal(findClientWithPhone(directory, '12345'), directory[1]);
});

test('findClientWithPhone skips the client being edited', () => {
  assert.equal(findClientWithPhone(directory, '+7 900 000 00 00', 'a'), undefined);
  assert.equal(findClientWithPhone(directory, '12345', 'a'), directory[1]);
});

test('findClientWithPhone finds nothing for a new phone or a phone without digits', () => {
  assert.equal(findClientWithPhone(directory, '555'), undefined);
  assert.equal(findClientWithPhone([{ id: 'x', name: 'X', phone: '()' }], '+ -'), undefined);
});

test('validateClient rejects a phone that another client already has', () => {
  const result = validateClient({ name: 'Новый', phone: '7 900 000 00 00' }, { clients: directory });
  assert.equal(result.valid, false);
  assert.equal(result.errors.phone, 'Этот телефон уже указан у клиента «Иван Петров».');
});

test('validateClient does not compare the edited client with itself', () => {
  const result = validateClient({ name: 'Иван', phone: '+7 (900) 000-00-00' }, { clients: directory, exceptId: 'a' });
  assert.deepEqual(result, { valid: true, errors: {} });
});

test('createClient rejects a duplicate phone', () => {
  assert.throws(
    () => createClient({ name: 'Пётр', phone: '123 45' }, { ...options, clients: directory }),
    (error) => error.fields.phone === 'Этот телефон уже указан у клиента «ООО Ромашка».',
  );
});

test('createClient keeps the phone exactly as typed (only trimmed)', () => {
  const client = createClient({ name: 'Пётр', phone: ' +7 (901) 111-22-33 ' }, { ...options, clients: directory });
  assert.equal(client.phone, '+7 (901) 111-22-33');
});

test('updateClient changes name and phone and keeps id, status and createdAt', () => {
  const result = updateClient(directory, 'a', { name: '  Иван Иванов ', phone: ' 8 (900) 111-11-11 ' });
  assert.deepEqual(result[0], {
    id: 'a',
    name: 'Иван Иванов',
    phone: '8 (900) 111-11-11',
    status: 'done',
    createdAt: '2026-10-01T10:00:00.000Z',
  });
});

test('updateClient keeps a missing status missing for clients from stage 1', () => {
  const [, updated] = updateClient(directory, 'b', { name: 'ООО Ромашка', phone: '999' });
  assert.equal('status' in updated, false);
  assert.equal(updated.createdAt, '2026-10-02T10:00:00.000Z');
});

test('updateClient does not touch other clients or the original list', () => {
  const copy = structuredClone(directory);
  const result = updateClient(directory, 'a', { name: 'Иван', phone: '1' });
  assert.equal(result[1], directory[1]);
  assert.deepEqual(directory, copy);
});

test('updateClient allows keeping the same phone', () => {
  const [updated] = updateClient(directory, 'a', { name: 'Иван', phone: '79000000000' });
  assert.equal(updated.phone, '79000000000');
});

test('updateClient rejects empty fields', () => {
  assert.throws(() => updateClient(directory, 'a', { name: ' ', phone: '' }), (error) => {
    assert.deepEqual(Object.keys(error.fields).sort(), ['name', 'phone']);
    return true;
  });
});

test('updateClient rejects a phone of another client', () => {
  assert.throws(
    () => updateClient(directory, 'b', { name: 'ООО Ромашка', phone: '+79000000000' }),
    (error) => error.fields.phone === 'Этот телефон уже указан у клиента «Иван Петров».',
  );
});

test('updateClient leaves the list unchanged for an unknown id', () => {
  assert.deepEqual(updateClient(directory, 'missing', { name: 'X', phone: '555' }), directory);
});

test('removeClient removes only the given client', () => {
  assert.deepEqual(removeClient(directory, 'a'), [directory[1]]);
});

test('removeClient does not modify the original list', () => {
  const copy = structuredClone(directory);
  removeClient(directory, 'b');
  assert.deepEqual(directory, copy);
});

test('removeClient leaves the list unchanged for an unknown id', () => {
  assert.deepEqual(removeClient(directory, 'missing'), directory);
});

const people = [
  { id: '1', name: 'Жанна', phone: '+7 (900) 111-22-33', status: 'done', createdAt: '2026-10-03T10:00:00.000Z' },
  { id: '2', name: 'алексей', phone: '8 900 444 55 66', status: 'in_progress', createdAt: '2026-10-01T10:00:00.000Z' },
  { id: '3', name: 'Ёлка', phone: '123-45', createdAt: '2026-10-04T10:00:00.000Z' },
  { id: '4', name: 'Елена', phone: '(555) 000', status: 'in_progress', createdAt: '2026-10-02T10:00:00.000Z' },
];
const names = (list) => list.map((client) => client.name);

test('search by name ignores case and matches part of the name', () => {
  assert.deepEqual(names(searchClients(people, 'ЖАН')), ['Жанна']);
  assert.deepEqual(names(searchClients(people, 'Алекс')), ['алексей']);
  assert.deepEqual(names(searchClients(people, 'ЁЛ')), ['Ёлка']);
});

test('search by phone ignores spaces, brackets, dashes and "+"', () => {
  assert.deepEqual(names(searchClients(people, '900-111')), ['Жанна']);
  assert.deepEqual(names(searchClients(people, '(444) 55')), ['алексей']);
  assert.deepEqual(names(searchClients(people, '+7 900 111 22 33')), ['Жанна']);
  assert.deepEqual(names(searchClients(people, '900')), ['Жанна', 'алексей']);
});

test('search uses the shared phone normalization', () => {
  const query = ' (12) 3-45 ';
  assert.equal(normalizePhone(query), '12345');
  assert.deepEqual(names(searchClients(people, query)), ['Ёлка']);
});

test('an empty or whitespace-only query returns all clients', () => {
  assert.equal(searchClients(people, ''), people);
  assert.equal(searchClients(people, '   '), people);
  assert.equal(searchClients(people, undefined), people);
});

test('search returns an empty list when nothing matches', () => {
  assert.deepEqual(searchClients(people, 'Зинаида'), []);
  assert.deepEqual(searchClients(people, '777'), []);
});

test('search does not match every phone for a query of separators only', () => {
  assert.deepEqual(searchClients(people, '+ -'), []);
});

test('sort options and default sort', () => {
  assert.deepEqual(SORT_OPTIONS.map((option) => option.value), ['created-asc', 'created-desc', 'name-asc', 'name-desc']);
  assert.equal(DEFAULT_SORT, 'created-asc');
  assert.equal(isValidSort('name-asc'), true);
  assert.equal(isValidSort('price'), false);
  assert.equal(isValidSort(null), false);
});

test('sort by name A–Я uses Russian collation, ignores case and puts Ё after Е', () => {
  assert.deepEqual(names(sortClients(people, 'name-asc')), ['алексей', 'Елена', 'Ёлка', 'Жанна']);
});

test('sort by name Я–А reverses the order', () => {
  assert.deepEqual(names(sortClients(people, 'name-desc')), ['Жанна', 'Ёлка', 'Елена', 'алексей']);
});

test('sort by creation date in both directions', () => {
  assert.deepEqual(names(sortClients(people, 'created-asc')), ['алексей', 'Елена', 'Жанна', 'Ёлка']);
  assert.deepEqual(names(sortClients(people, 'created-desc')), ['Ёлка', 'Жанна', 'Елена', 'алексей']);
});

test('clients with the same name are ordered by creation date', () => {
  const twins = [
    { id: 'b', name: 'Иван', createdAt: '2026-10-02T10:00:00.000Z' },
    { id: 'a', name: 'иван', createdAt: '2026-10-01T10:00:00.000Z' },
  ];
  assert.deepEqual(sortClients(twins, 'name-asc').map((client) => client.id), ['a', 'b']);
});

test('an unknown sort falls back to the default', () => {
  assert.deepEqual(sortClients(people, 'price'), sortClients(people, DEFAULT_SORT));
});

test('sorting returns a new array and does not change the original list', () => {
  const copy = structuredClone(people);
  const sorted = sortClients(people, 'name-asc');
  assert.notEqual(sorted, people);
  assert.deepEqual(people, copy);
});

test('search, status filter and sort work together', () => {
  const visible = getVisibleClients(people, { query: '900', status: 'in_progress', sort: 'name-asc' });
  assert.deepEqual(names(visible), ['алексей']);

  const inProgress = getVisibleClients(people, { query: '', status: 'in_progress', sort: 'name-desc' });
  assert.deepEqual(names(inProgress), ['Елена', 'алексей']);

  const all = getVisibleClients(people, { query: 'е', status: 'all', sort: 'name-asc' });
  assert.deepEqual(names(all), ['алексей', 'Елена']);
});

test('getVisibleClients does not change the original list', () => {
  const copy = structuredClone(people);
  getVisibleClients(people, { query: '', status: 'all', sort: 'name-desc' });
  assert.deepEqual(people, copy);
});
