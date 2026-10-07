// Saving and loading clients. The storage object is passed in
// (window.localStorage in the browser, a fake object in tests).

export const STORAGE_KEY = 'client-crm.clients';

export function loadClients(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveClients(storage, clients) {
  storage.setItem(STORAGE_KEY, JSON.stringify(clients));
}
