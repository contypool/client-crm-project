// Connects the page (form and list) with the domain logic and storage.

import {
  STATUSES,
  createClient,
  filterClientsByStatus,
  getClientStatus,
  setClientStatus,
  validateClient,
} from './clients.js';
import { loadClients, loadStatusFilter, saveClients, saveStatusFilter } from './storage.js';

const form = document.querySelector('#client-form');
const list = document.querySelector('#client-list');
const emptyMessage = document.querySelector('#empty-message');
const statusFilter = document.querySelector('#status-filter');
const errorFields = {
  name: document.querySelector('#name-error'),
  phone: document.querySelector('#phone-error'),
};

let clients = loadClients(window.localStorage);

function appendStatusOptions(select) {
  for (const { value, label } of STATUSES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function showErrors(errors) {
  for (const [field, element] of Object.entries(errorFields)) {
    element.textContent = errors[field] ?? '';
  }
}

function createStatusSelect(client) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Статус клиента ${client.name}`);
  appendStatusOptions(select);
  select.value = getClientStatus(client);
  select.addEventListener('change', () => {
    clients = setClientStatus(clients, client.id, select.value);
    saveClients(window.localStorage, clients);
    render();
  });
  return select;
}

function render() {
  const visible = filterClientsByStatus(clients, statusFilter.value);
  list.replaceChildren();
  for (const client of visible) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = client.name;
    const phone = document.createElement('span');
    phone.textContent = client.phone;
    item.append(name, phone, createStatusSelect(client));
    list.append(item);
  }
  emptyMessage.textContent = clients.length === 0 ? 'Пока нет клиентов.' : 'Нет клиентов с этим статусом.';
  emptyMessage.hidden = visible.length > 0;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    name: form.elements.name.value,
    phone: form.elements.phone.value,
  };

  const { valid, errors } = validateClient(input);
  showErrors(errors);
  if (!valid) {
    return;
  }

  const client = createClient(input, { id: crypto.randomUUID(), now: new Date() });
  clients = [...clients, client];
  saveClients(window.localStorage, clients);
  form.reset();
  form.elements.name.focus();
  render();
});

statusFilter.addEventListener('change', () => {
  saveStatusFilter(window.localStorage, statusFilter.value);
  render();
});

appendStatusOptions(statusFilter);
statusFilter.value = loadStatusFilter(window.localStorage);
render();
