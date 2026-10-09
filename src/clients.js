// Domain logic for clients. No DOM or storage access here, so it is easy to test.

// Statuses are stored as codes; the Russian labels live only here.
export const STATUSES = [
  { value: 'new', label: 'Новый' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Завершён' },
];

export const DEFAULT_STATUS = 'new';
export const ALL_STATUSES = 'all';

export function isValidStatus(status) {
  return STATUSES.some((item) => item.value === status);
}

// Clients saved before statuses existed (or with an unknown value) count as new.
export function getClientStatus(client) {
  return isValidStatus(client?.status) ? client.status : DEFAULT_STATUS;
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function clientsToCsv(clients) {
  const rows = [
    ['Имя', 'Телефон', 'Статус', 'Дата создания'],
    ...clients.map((client) => [
      client.name,
      client.phone,
      STATUSES.find((status) => status.value === getClientStatus(client)).label,
      client.createdAt,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function setClientStatus(clients, id, status) {
  if (!isValidStatus(status)) {
    throw new Error('Неизвестный статус клиента.');
  }
  return clients.map((client) => (client.id === id ? { ...client, status } : client));
}

export function isValidStatusFilter(filter) {
  return filter === ALL_STATUSES || isValidStatus(filter);
}

export function filterClientsByStatus(clients, filter) {
  if (filter === ALL_STATUSES) {
    return clients;
  }
  return clients.filter((client) => getClientStatus(client) === filter);
}

// Repairs a list read from storage: drops entries that are not objects, gives every
// client a unique non-empty id and makes name and phone strings. Other fields
// (status, createdAt, ...) are kept as is. Returns a new array; `changed` tells
// whether anything had to be repaired.
export function normalizeStoredClients(data, createId) {
  const seenIds = new Set();
  const clients = [];
  let changed = false;

  for (const item of data) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      changed = true;
      continue;
    }

    const client = { ...item };
    let repaired = false;
    if (typeof client.id !== 'string' || client.id === '' || seenIds.has(client.id)) {
      client.id = createId();
      repaired = true;
    }
    for (const field of ['name', 'phone']) {
      if (typeof client[field] !== 'string') {
        client[field] = typeof client[field] === 'number' ? String(client[field]) : '';
        repaired = true;
      }
    }

    seenIds.add(client.id);
    clients.push(repaired ? client : item);
    changed ||= repaired;
  }

  return { clients, changed };
}

// Phones are compared without spaces, brackets, dashes and "+",
// but stored and shown exactly as the user typed them.
export function normalizePhone(phone) {
  return String(phone ?? '').replace(/[\s()+-]/g, '');
}

// Returns another client with the same phone, ignoring the client with exceptId.
export function findClientWithPhone(clients, phone, exceptId) {
  const normalized = normalizePhone(phone);
  if (normalized === '') {
    return undefined;
  }
  return clients.find((client) => client.id !== exceptId && normalizePhone(client.phone) === normalized);
}

// `clients` and `exceptId` enable the duplicate phone check;
// exceptId is the client being edited, so it is not compared with itself.
export function validateClient(input, { clients = [], exceptId } = {}) {
  const errors = {};
  const name = String(input?.name ?? '').trim();
  const phone = String(input?.phone ?? '').trim();

  if (name === '') {
    errors.name = 'Укажите имя клиента.';
  }
  if (phone === '') {
    errors.phone = 'Укажите телефон клиента.';
  } else if (!/^\d+$/.test(normalizePhone(phone))) {
    // After removing the allowed formatting only digits may remain, at least one.
    errors.phone = 'Телефон может содержать только цифры, пробелы, скобки, дефисы и знак +.';
  } else {
    const duplicate = findClientWithPhone(clients, phone, exceptId);
    if (duplicate) {
      errors.phone = `Этот телефон уже указан у клиента «${duplicate.name}».`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Client form fields in the order they appear on the page.
export const CLIENT_FIELDS = ['name', 'phone'];

// The field that should get focus after a failed validation, or null.
export function firstInvalidField(errors) {
  return CLIENT_FIELDS.find((field) => errors?.[field]) ?? null;
}

function assertValid(input, options) {
  const { valid, errors } = validateClient(input, options);
  if (!valid) {
    const error = new Error('Некорректные данные клиента.');
    error.fields = errors;
    throw error;
  }
}

export function createClient(input, { id, now, clients = [] }) {
  assertValid(input, { clients });

  return {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    status: DEFAULT_STATUS,
    createdAt: now.toISOString(),
  };
}

// Changes only name and phone; id, status, createdAt and any other fields are kept.
export function updateClient(clients, id, input) {
  assertValid(input, { clients, exceptId: id });
  const name = input.name.trim();
  const phone = input.phone.trim();
  return clients.map((client) => (client.id === id ? { ...client, name, phone } : client));
}

export function removeClient(clients, id) {
  return clients.filter((client) => client.id !== id);
}

// Search matches the name (case-insensitive) or the phone (normalized, so any format works).
export function searchClients(clients, query) {
  const text = String(query ?? '').trim().toLocaleLowerCase('ru');
  if (text === '') {
    return clients;
  }
  const phone = normalizePhone(text);
  return clients.filter(
    (client) =>
      String(client.name ?? '').toLocaleLowerCase('ru').includes(text) ||
      (phone !== '' && normalizePhone(client.phone).includes(phone)),
  );
}

export const SORT_OPTIONS = [
  { value: 'created-asc', label: 'Сначала старые' },
  { value: 'created-desc', label: 'Сначала новые' },
  { value: 'name-asc', label: 'По имени: А–Я' },
  { value: 'name-desc', label: 'По имени: Я–А' },
];

export const DEFAULT_SORT = 'created-asc';

export function isValidSort(sort) {
  return SORT_OPTIONS.some((item) => item.value === sort);
}

const nameCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

function compareCreated(a, b) {
  return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
}

function compareNames(a, b) {
  return nameCollator.compare(String(a.name ?? ''), String(b.name ?? '')) || compareCreated(a, b);
}

const comparators = {
  'created-asc': compareCreated,
  'created-desc': (a, b) => compareCreated(b, a),
  'name-asc': compareNames,
  'name-desc': (a, b) => compareNames(b, a),
};

// Returns a new array; the original list is never reordered.
export function sortClients(clients, sort) {
  const compare = comparators[isValidSort(sort) ? sort : DEFAULT_SORT];
  return [...clients].sort(compare);
}

export function getVisibleClients(clients, { query, status, sort }) {
  return sortClients(filterClientsByStatus(searchClients(clients, query), status), sort);
}
