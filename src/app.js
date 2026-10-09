// Connects the page (form and list) with the domain logic and storage.

import {
  SORT_OPTIONS,
  STATUSES,
  clientsToCsv,
  createClient,
  firstInvalidField,
  getClientStatus,
  getVisibleClients,
  removeClient,
  setClientStatus,
  updateClient,
  validateClient,
} from './clients.js';
import {
  LOAD_PROBLEMS,
  clientsStorageAfterLoad,
  commitClients,
  loadClients,
  loadSort,
  loadStatusFilter,
  openStorage,
  saveSort,
  saveStatusFilter,
} from './storage.js';

const form = document.querySelector('#client-form');
const list = document.querySelector('#client-list');
const emptyMessage = document.querySelector('#empty-message');
const listTitle = document.querySelector('#list-title');
const dataWarning = document.querySelector('#data-warning');
const saveWarning = document.querySelector('#save-warning');
const statusFilter = document.querySelector('#status-filter');
const searchInput = document.querySelector('#search');
const sortSelect = document.querySelector('#sort');
const exportButton = document.querySelector('#export-csv');
const exportMessage = document.querySelector('#export-message');
const errorFields = {
  name: document.querySelector('#name-error'),
  phone: document.querySelector('#phone-error'),
};

const DATA_WARNINGS = {
  [LOAD_PROBLEMS.unreadable]:
    'Сохранённые данные повреждены и не могут быть прочитаны. ' +
    'Копия сохранена в localStorage под ключом client-crm.clients.backup.',
  [LOAD_PROBLEMS.repaired]: 'Часть сохранённых данных была повреждена и исправлена. Исходная копия сохранена.',
  [LOAD_PROBLEMS.unavailable]:
    'Хранилище браузера недоступно. Сохранённые данные не загружены, ' +
    'новые изменения сохранить нельзя: приложение работает только для чтения.',
};

const BACKUP_FAILED_WARNINGS = {
  [LOAD_PROBLEMS.unreadable]:
    'Сохранённые данные повреждены и не могут быть прочитаны. ' +
    'Сохранить их копию не удалось: хранилище браузера переполнено или недоступно. ' +
    'Чтобы не потерять исходные данные, список клиентов открыт только для чтения: ' +
    'изменения не сохраняются. Освободите место в хранилище и перезагрузите страницу.',
  [LOAD_PROBLEMS.repaired]:
    'Часть сохранённых данных повреждена и исправлена только на этой странице. ' +
    'Сохранить копию исходных данных не удалось, поэтому они не перезаписываются: ' +
    'список клиентов открыт только для чтения, изменения не сохраняются. ' +
    'Освободите место в хранилище и перезагрузите страницу.',
};

const SAVE_FAILED_WARNING =
  'Не удалось сохранить изменения: хранилище браузера недоступно или переполнено. Данные остались прежними.';
const READ_ONLY_WARNING = 'Изменения не сохранены: список клиентов открыт только для чтения. Данные остались прежними.';

// null when the browser blocks localStorage.
const storage = openStorage();
const loaded = loadClients(storage);
// null when clients are read-only (no storage, or damaged data without a backup):
// then every change to clients fails and nothing changes.
const clientsStorage = clientsStorageAfterLoad(storage, loaded);
const saveFailedWarning = clientsStorage === null ? READ_ONLY_WARNING : SAVE_FAILED_WARNING;
let clients = loaded.clients;
if (loaded.problem) {
  dataWarning.textContent = (loaded.backupFailed ? BACKUP_FAILED_WARNINGS : DATA_WARNINGS)[loaded.problem];
  dataWarning.hidden = false;
}

// Only one client row can be in edit or delete-confirmation mode at a time.
let editing = null; // { id, name, phone, errors }
let deletingId = null;
let pendingFocus = null; // function that moves focus after the next render

function appendOptions(select, options) {
  for (const { value, label } of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function setInvalid(input, message) {
  if (message) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

function showErrors(errors) {
  for (const [field, element] of Object.entries(errorFields)) {
    element.textContent = errors[field] ?? '';
    setInvalid(form.elements[field], errors[field]);
  }
}

// Returns true when the change was saved. Otherwise `clients` stays as it was
// and a warning is shown; the caller then keeps the form or row as it is.
function persist(nextClients) {
  const result = commitClients(clientsStorage, clients, nextClients);
  clients = result.clients;
  saveWarning.textContent = result.saved ? '' : saveFailedWarning;
  saveWarning.hidden = result.saved;
  return result.saved;
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

function focusLater(selector) {
  pendingFocus = () => list.querySelector(selector)?.focus();
}

function renderedClientIds() {
  return [...list.children].map((item) => item.dataset.clientId);
}

// After a change the client's row may be gone (deleted or hidden by the filter).
// Then focus moves to the next client, or the previous one if it was last,
// or to the list heading when the list is empty.
function focusClientOrNeighbor(id, action, previousIds) {
  pendingFocus = () => {
    const own = list.querySelector(actionSelector(action, id));
    if (own) {
      own.focus();
      return;
    }
    const index = previousIds.indexOf(id);
    const neighbors = [...previousIds.slice(index + 1), ...previousIds.slice(0, index).reverse()];
    for (const neighborId of neighbors) {
      const button = list.querySelector(actionSelector('edit', neighborId));
      if (button) {
        button.focus();
        return;
      }
    }
    listTitle.focus();
  };
}

function startEditing(client) {
  editing = { id: client.id, name: client.name, phone: client.phone, errors: {} };
  deletingId = null;
  focusLater('#edit-name');
  render();
}

function cancelEditing() {
  const id = editing.id;
  editing = null;
  focusLater(actionSelector('edit', id));
  render();
}

function startDeleting(client) {
  deletingId = client.id;
  editing = null;
  focusLater('[data-action="cancel-delete"]');
  render();
}

function cancelDeleting() {
  const id = deletingId;
  deletingId = null;
  focusLater(actionSelector('delete', id));
  render();
}

function createStatusSelect(client) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `Статус клиента ${client.name}`);
  select.dataset.action = 'status';
  select.dataset.clientId = client.id;
  appendOptions(select, STATUSES);
  select.value = getClientStatus(client);
  select.addEventListener('change', () => {
    const previousIds = renderedClientIds();
    // If saving fails, render() puts the previous status back into the select.
    persist(setClientStatus(clients, client.id, select.value));
    focusClientOrNeighbor(client.id, 'status', previousIds);
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
    const previousIds = renderedClientIds();
    if (!persist(removeClient(clients, client.id))) {
      return;
    }
    deletingId = null;
    focusClientOrNeighbor(client.id, 'delete', previousIds);
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
  setInvalid(input, editing.errors[field]);
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
      focusLater(`#edit-${firstInvalidField(errors)}`);
      render();
      return;
    }
    const previousIds = renderedClientIds();
    if (!persist(updateClient(clients, client.id, input))) {
      return; // the edit form stays open with the typed values
    }
    editing = null;
    // The edited client may no longer match the search.
    focusClientOrNeighbor(client.id, 'edit', previousIds);
    render();
  });

  editForm.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      cancelEditing();
    }
  });

  item.append(editForm);
}

function emptyText() {
  if (clients.length === 0) {
    return 'Пока нет клиентов.';
  }
  return searchInput.value.trim() === '' ? 'Нет клиентов с этим статусом.' : 'Ничего не найдено.';
}

function render() {
  const visible = getVisibleClients(clients, {
    query: searchInput.value,
    status: statusFilter.value,
    sort: sortSelect.value,
  });
  list.replaceChildren();
  for (const client of visible) {
    const item = document.createElement('li');
    item.dataset.clientId = client.id;
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
  emptyMessage.textContent = emptyText();
  emptyMessage.hidden = visible.length > 0;

  if (pendingFocus) {
    const moveFocus = pendingFocus;
    pendingFocus = null;
    moveFocus();
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
    form.elements[firstInvalidField(errors)].focus();
    return;
  }

  const client = createClient(input, { id: crypto.randomUUID(), now: new Date(), clients });
  if (!persist([...clients, client])) {
    return; // the typed name and phone stay in the form
  }
  form.reset();
  form.elements.name.focus();
  render();
});

list.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && deletingId !== null) {
    cancelDeleting();
  }
});

// If the filter or sort cannot be saved, it still applies until the page is reloaded.
statusFilter.addEventListener('change', () => {
  saveStatusFilter(storage, statusFilter.value);
  render();
});

sortSelect.addEventListener('change', () => {
  saveSort(storage, sortSelect.value);
  render();
});

// The search query is intentionally not saved between reloads.
searchInput.addEventListener('input', render);

exportButton.addEventListener('click', () => {
  if (clients.length === 0) {
    exportMessage.textContent = 'Нечего экспортировать: список клиентов пуст.';
    exportMessage.hidden = false;
    return;
  }

  let url;
  let link;
  try {
    const file = new Blob([clientsToCsv(clients)], { type: 'text/csv;charset=utf-8' });
    url = URL.createObjectURL(file);
    link = document.createElement('a');
    link.href = url;
    link.download = 'clients.csv';
    document.body.append(link);
    link.click();
    exportMessage.textContent = 'Файл clients.csv подготовлен к скачиванию.';
    exportMessage.hidden = false;
  } catch (error) {
    console.error('Не удалось экспортировать клиентов в CSV.', error);
    exportMessage.textContent = 'Не удалось подготовить CSV-файл. Попробуйте ещё раз.';
    exportMessage.hidden = false;
  } finally {
    setTimeout(() => {
      link?.remove();
      if (url) {
        URL.revokeObjectURL(url);
      }
    }, 1000);
  }
});

appendOptions(statusFilter, STATUSES);
appendOptions(sortSelect, SORT_OPTIONS);
statusFilter.value = loadStatusFilter(storage);
sortSelect.value = loadSort(storage);
render();
