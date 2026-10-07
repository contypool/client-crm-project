import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createClient, validateClient } from '../src/clients.js';

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

test('createClient trims fields and adds id and creation date', () => {
  assert.deepEqual(createClient({ name: '  Иван  ', phone: ' 123 ' }, options), {
    id: 'client-1',
    name: 'Иван',
    phone: '123',
    createdAt: '2026-10-07T10:00:00.000Z',
  });
});

test('createClient rejects invalid data', () => {
  assert.throws(() => createClient({ name: '', phone: '' }, options), (error) => {
    assert.deepEqual(Object.keys(error.fields).sort(), ['name', 'phone']);
    return true;
  });
});
