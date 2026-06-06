// IndexedDB wrapper for all persistence
// Stores: products, cart (current order), transactions

const DB_NAME = 'kasse';
const DB_VERSION = 1;

let _db = null;

export async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id' });
        ps.createIndex('sort_order', 'sort_order');
      }
      if (!db.objectStoreNames.contains('cart')) {
        db.createObjectStore('cart', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const ts = db.createObjectStore('transactions', { keyPath: 'id' });
        ts.createIndex('timestamp', 'timestamp');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function txStore(storeName, mode = 'readonly') {
  return openDB().then((db) => {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function getProducts() {
  const store = await txStore('products');
  const all = await promisify(store.index('sort_order').getAll());
  return all.filter((p) => p.active !== false);
}

export async function getAllProducts() {
  const store = await txStore('products');
  return promisify(store.index('sort_order').getAll());
}

export async function saveProduct(product) {
  const store = await txStore('products', 'readwrite');
  return promisify(store.put(product));
}

export async function deleteProduct(id) {
  const store = await txStore('products', 'readwrite');
  return promisify(store.delete(id));
}

export async function replaceAllProducts(products) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('products', 'readwrite');
    const store = tx.objectStore('products');
    store.clear();
    products.forEach((p) => store.put(p));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── Cart (current order) ──────────────────────────────────────────────────────

export async function getCart() {
  const store = await txStore('cart');
  return promisify(store.getAll());
}

export async function addToCart(item) {
  // item: { id, product_id, product_name, qty, unit_price_cents, pledge_amount_cents }
  const store = await txStore('cart', 'readwrite');
  return promisify(store.put(item));
}

export async function removeFromCart(id) {
  const store = await txStore('cart', 'readwrite');
  return promisify(store.delete(id));
}

export async function clearCart() {
  const store = await txStore('cart', 'readwrite');
  return promisify(store.clear());
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function saveTransaction(tx) {
  const store = await txStore('transactions', 'readwrite');
  return promisify(store.put(tx));
}

export async function getAllTransactions() {
  const store = await txStore('transactions');
  return promisify(store.index('timestamp').getAll());
}

export async function clearAllTransactions() {
  const store = await txStore('transactions', 'readwrite');
  return promisify(store.clear());
}
