// Firebase Realtime Database sync
// Offline-first: IndexedDB ist primär, Firebase ist Backup-Sync.
// Transaktionen werden sofort lokal gespeichert.
// Wenn WLAN vorhanden, werden ungesyncte Transaktionen im Hintergrund hochgeladen.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, set, onValue, off } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyASocBpF2R-FIs7yXGHpHPjQMSRvG-Yq5c",
  authDomain: "lj-kasse.firebaseapp.com",
  databaseURL: "https://lj-kasse-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lj-kasse",
  storageBucket: "lj-kasse.firebasestorage.app",
  messagingSenderId: "135104492180",
  appId: "1:135104492180:web:6f32c21032b247f7a97a81"
};

let db = null;

function getDB() {
  if (!db) {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
  return db;
}

/**
 * Sync a single transaction to Firebase.
 * Path: /transactions/{deviceId}/{txId}
 * Returns true on success, false on failure (offline etc.)
 */
export async function syncTransactionToFirebase(tx) {
  try {
    const database = getDB();
    const txRef = ref(database, `transactions/${tx.device_id}/${tx.id}`);
    await set(txRef, tx);
    return true;
  } catch (err) {
    console.warn('Firebase sync failed (offline?):', err.message);
    return false;
  }
}

/**
 * Subscribe to all transactions from all devices.
 * Calls onData(transactions[]) whenever data changes.
 * Returns unsubscribe function.
 */
export function subscribeToAllTransactions(onData) {
  try {
    const database = getDB();
    const txRef = ref(database, 'transactions');
    const handler = (snapshot) => {
      const val = snapshot.val();
      if (!val) { onData([]); return; }
      // Flatten: { deviceId: { txId: tx } } → tx[]
      const all = Object.values(val).flatMap((deviceTxs) => Object.values(deviceTxs));
      all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      onData(all);
    };
    onValue(txRef, handler);
    return () => off(txRef, 'value', handler);
  } catch (err) {
    console.warn('Firebase subscribe failed:', err.message);
    return () => {};
  }
}

/**
 * Check if Firebase is reachable (simple connectivity check).
 */
export function isFirebaseAvailable() {
  return db !== null || navigator.onLine;
}
