// Connects the page (form and list) with the domain logic and storage.

import {
  STATUSES,
  createClient,
  filterClientsByStatus,
  getClientStatus,
  removeClient,
  setClientStatus,
  updateClient,
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

// Only one client row can be in edit or delete-confirmation mode at a time.
let editing = null; // { id, name, phone, errors }
let deletingId = null;
let pendingFocus = null; // CSS selector inside the list to focus after render

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

function persist(nextClients) {
  clients = nextClients;
  saveClients(window.localStorage, clients);
}

function createButton(text, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}

function actionSelector(action, id) {
  return `[data-action="${action}"][data-client-id="${CSS.escape(id)}"]`;
}

function startEditing(client) {
  editing = { id: client.id, name: client.name, phone: client.phone, errors: {} };
  deletingId = null;
  pendingFocus = '#edit-name';
  render();
}

function cancelEditing() {
  const id = editing.id;
  editing = null;
  pendingFocus = actionSelector('edit', id);
  render();
}

function startDeleting(client) {
  deletingId = client.id;
  editing = null;
  pendingFocus = '[data-action="cancel-delete"]';
  render();
}

function cancelDeleting() {
  const id = deletingId;
  deletingId = null;
  pendingFocus = actionSelector('delete', id);
  render();
}

function createStatusSelect(client) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Статус клиента ${client.name}`);
  appendStatusOptions(select);
  select.value = getClientStatus(client);
  select.addEventListener('change', () => {
    persist(setClientStatus(clients, client.id, select.value));
    render();
  });
  return select;
}

function renderClientView(item, client) {
  const name = document.createElement('strong');
  name.textContent = client.name;
  const phone = document.createElement('span');
  phone.className = 'phone';
  phone.textContent = client.phone;

  const actions = document.createElement('div');
  actions.className = 'actions';
  const editButton = createButton('Редактировать', 'secondary', () => startEditing(client));
  editButton.dataset.action = 'edit';
  editButton.dataset.clientId = client.id;
  const deleteButton = createButton('Удалить', 'danger', () => startDeleting(client));
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.clientId = client.id;
  actions.append(createStatusSelect(client), editButton, deleteButton);

  item.append(name, phone, actions);
}

function renderDeleteConfirmation(item, client) {
  const question = document.createElement('span');
  question.className = 'question';
  question.textContent = `Удалить клиента «${client.name}»?`;

  const actions = document.createElement('div');
  actions.className = 'actions';
  const confirmButton = createButton('Подтвердить', 'danger', () => {
    deletingId = null;
    persist(removeClient(clients, client.id));
    render();
  });
  const cancelButton = createButton('Отмена', 'secondary', cancelDeleting);
  cancelButton.dataset.action = 'cancel-delete';
  actions.append(confirmButton, cancelButton);

  item.append(question, actions);
}

function createEditField(field, labelText, type) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = `edit-${field}`;
  label.textContent = labelText;
  const input = document.createElement('input');
  input.id = `edit-${field}`;
  input.name = field;
  input.type = type;
  input.autocomplete = 'off';
  input.value = editing[field];
  input.setAttribute('aria-describedby', `edit-${field}-error`);
  input.addEventListener('input', () => {
    editing[field] = input.value;
  });
  const error = document.createElement('p');
  error.id = `edit-${field}-error`;
  error.className = 'error';
  error.setAttribute('aria-live', 'polite');
  error.textContent = editing.errors[field] ?? '';
  wrapper.append(label, input, error);
  return wrapper;
}

function renderEditForm(item, client) {
  const editForm = document.createElement('form');
  editForm.className = 'edit-form';
  editForm.noValidate = true;
  editForm.setAttribute('aria-label', `Редактирование клиента ${client.name}`);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const saveButton = document.createElement('button');
  saveButton.type = 'submit';
  saveButton.textContent = 'Сохранить';
  actions.append(saveButton, createButton('Отмена', 'secondary', cancelEditing));

  editForm.append(createEditField('name', 'Имя', 'text'), createEditField('phone', 'Телефон', 'tel'), actions);

  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = { name: editing.name, phone: editing.phone };
    const { valid, errors } = validateClient(input, { clients, exceptId: client.id });
    if (!valid) {
      editing.errors = errors;
      pendingFocus = errors.name ? '#edit-name' : '#edit-phone';
      render();
      return;
    }
    persist(updateClient(clients, client.id, input));
    editing = null;
    pendingFocus = actionSelector('edit', client.id);
    render();
  });

  editForm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cancelEditing();
    }
  });

  item.append(editForm);
}

function render() {
  const visible = filterClientsByStatus(clients, statusFilter.value);
  list.replaceChildren();
  for (const client of visible) {
    const item = document.createElement('li');
    if (editing?.id === client.id) {
      item.className = 'editing';
      renderEditForm(item, client);
    } else if (deletingId === client.id) {
      item.className = 'confirming';
      renderDeleteConfirmation(item, client);
    } else {
      renderClientView(item, client);
    }
    list.append(item);
  }
  emptyMessage.textContent = clients.length === 0 ? 'Пока нет клиентов.' : 'Нет клиентов с этим статусом.';
  emptyMessage.hidden = visible.length > 0;

  if (pendingFocus) {
    list.querySelector(pendingFocus)?.focus();
    pendingFocus = null;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = {
    name: form.elements.name.value,
    phone: form.elements.phone.value,
  };

  const { valid, errors } = validateClient(input, { clients });
  showErrors(errors);
  if (!valid) {
    return;
  }

  const client = createClient(input, { id: crypto.randomUUID(), now: new Date(), clients });
  persist([...clients, client]);
  form.reset();
  form.elements.name.focus();
  render();
});

list.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && deletingId !== null) {
    cancelDeleting();
  }
});

statusFilter.addEventListener('change', () => {
  saveStatusFilter(window.localStorage, statusFilter.value);
  render();
});

appendStatusOptions(statusFilter);
statusFilter.value = loadStatusFilter(window.localStorage);
render();
