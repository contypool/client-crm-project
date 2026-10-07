import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_STATUSES,
  DEFAULT_STATUS,
  STATUSES,
  createClient,
  filterClientsByStatus,
  getClientStatus,
  isValidStatusFilter,
  setClientStatus,
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
