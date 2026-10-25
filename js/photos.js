// Scrapbook photos, kept in the browser's IndexedDB because ordinary browser
// storage is far too small for pictures. Each photo is shrunk and stored twice:
// a large copy for viewing and a small one for the scrapbook pages.

const DB_NAME = 'family-fun-wheel';
const STORE = 'photos';
const FULL_SIZE = 1600;
const THUMB_SIZE = 480;
const urls = new Map();
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run(mode, work) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That photo couldn't be opened. Try a different one."));
    };
    img.src = url;
  });
}

function shrink(img, max) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("That photo couldn't be saved."))), 'image/jpeg', 0.82);
  });
}

export async function addPhoto(file, id) {
  const { img, url } = await loadImage(file);
  try {
    const [full, thumb] = await Promise.all([shrink(img, FULL_SIZE), shrink(img, THUMB_SIZE)]);
    await run('readwrite', (store) => store.put({ id, full, thumb, at: Date.now() }));
  } catch (err) {
    throw err instanceof Error && err.message.startsWith('That photo') ? err : new Error("This phone wouldn't save the photo. Is it low on space?");
  } finally {
    URL.revokeObjectURL(url);
  }
  // Ask the browser not to clear the photos when the phone needs space.
  navigator.storage?.persist?.().catch(() => {});
  return id;
}

// A URL to show a stored photo, or null if it isn't on this phone.
export async function photoUrl(id, size = 'thumb') {
  const key = `${id}:${size}`;
  if (urls.has(key)) return urls.get(key);
  const record = await run('readonly', (store) => store.get(id)).catch(() => null);
  if (!record?.[size]) return null;
  const url = URL.createObjectURL(record[size]);
  urls.set(key, url);
  return url;
}

function forget(id) {
  for (const size of ['thumb', 'full']) {
    const key = `${id}:${size}`;
    if (urls.has(key)) {
      URL.revokeObjectURL(urls.get(key));
      urls.delete(key);
    }
  }
}

export async function deletePhotos(ids) {
  if (!ids.length) return;
  ids.forEach(forget);
  await run('readwrite', (store) => {
    ids.forEach((id) => store.delete(id));
  }).catch(() => {});
}

export async function deleteAllPhotos() {
  urls.forEach((url) => URL.revokeObjectURL(url));
  urls.clear();
  await run('readwrite', (store) => store.clear()).catch(() => {});
}
