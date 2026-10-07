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

export function validateClient(input) {
  const errors = {};
  const name = String(input?.name ?? '').trim();
  const phone = String(input?.phone ?? '').trim();

  if (name === '') {
    errors.name = 'Укажите имя клиента.';
  }
  if (phone === '') {
    errors.phone = 'Укажите телефон клиента.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function createClient(input, { id, now }) {
  const { valid, errors } = validateClient(input);
  if (!valid) {
    const error = new Error('Некорректные данные клиента.');
    error.fields = errors;
    throw error;
  }

  return {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    status: DEFAULT_STATUS,
    createdAt: now.toISOString(),
  };
}
