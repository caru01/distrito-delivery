const DATABASE_NAME = 'distrito-delivery-operational';
const STORE_NAME = 'location-points';
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No fue posible abrir la cola GPS'));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let value;
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || new Error('Falló la cola GPS'));
      transaction.onabort = () => reject(transaction.error || new Error('Se canceló la cola GPS'));
      value = operation(store);
    });
  } finally {
    database.close();
  }
}

export async function enqueueLocation(point, limit = 2000) {
  await withStore('readwrite', (store) => store.put(point));
  await trimLocationQueue(limit);
}

export async function listQueuedLocations(limit = 100) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const index = transaction.objectStore(STORE_NAME).index('capturedAt');
      const request = index.openCursor();
      const rows = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || rows.length >= limit) return resolve(rows);
        rows.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error || new Error('No fue posible leer la cola GPS'));
    });
  } finally {
    database.close();
  }
}

export async function removeQueuedLocations(ids) {
  if (!ids?.length) return;
  await withStore('readwrite', (store) => ids.forEach((id) => store.delete(id)));
}

export async function countQueuedLocations() {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(Number(request.result || 0));
      request.onerror = () => reject(request.error || new Error('No fue posible contar la cola GPS'));
    });
  } finally {
    database.close();
  }
}

export async function trimLocationQueue(limit = 2000) {
  const safeLimit = Math.min(Math.max(Number(limit) || 2000, 100), 20000);
  const count = await countQueuedLocations();
  if (count <= safeLimit) return;
  const remove = await listQueuedLocations(count - safeLimit);
  await removeQueuedLocations(remove.map((point) => point.id));
}
