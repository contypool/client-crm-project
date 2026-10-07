// Domain logic for clients. No DOM or storage access here, so it is easy to test.

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
    createdAt: now.toISOString(),
  };
}
