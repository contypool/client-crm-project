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
  } else {
    const duplicate = findClientWithPhone(clients, phone, exceptId);
    if (duplicate) {
      errors.phone = `Этот телефон уже указан у клиента «${duplicate.name}».`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
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
