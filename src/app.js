// Connects the page (form and list) with the domain logic and storage.

import { createClient, validateClient } from './clients.js';
import { loadClients, saveClients } from './storage.js';

const form = document.querySelector('#client-form');
const list = document.querySelector('#client-list');
const emptyMessage = document.querySelector('#empty-message');
const errorFields = {
  name: document.querySelector('#name-error'),
  phone: document.querySelector('#phone-error'),
};

let clients = loadClients(window.localStorage);

function showErrors(errors) {
  for (const [field, element] of Object.entries(errorFields)) {
    element.textContent = errors[field] ?? '';
  }
}

function render() {
  list.replaceChildren();
  for (const client of clients) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = client.name;
    const phone = document.createElement('span');
    phone.textContent = client.phone;
    item.append(name, phone);
    list.append(item);
  }
  emptyMessage.hidden = clients.length > 0;
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

render();
