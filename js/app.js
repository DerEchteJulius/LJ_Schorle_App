// Main app entry point — routing, state, event wiring

import { getProducts, getAllProducts, getCart, addToCart, removeFromCart, clearCart, saveTransaction, getAllTransactions, clearAllTransactions, saveProduct, deleteProduct } from './db.js';
import { computeTotal, computeChange, generateId, getDeviceId, getDeviceName, setDeviceName, getDeviceLabel, getLastBackup, parseToCents, formatCents } from './cart.js';
import { renderProductGrid, renderOrderList, renderTotal, updateBackupTimestamp, showToast, openPaymentDialog, renderProductSettings, renderStats } from './ui.js';
import { exportCSV, exportConfig, importConfig } from './export.js';

// ── State ─────────────────────────────────────────────────────────────────────

let currentView = 'order'; // 'order' | 'stats' | 'settings'
let products = [];
let cartItems = [];

// ── Boot ──────────────────────────────────────────────────────────────────────

async function init() {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });
    } catch (_) { /* offline or file:// — ignore */ }
  }

  // First-run setup: device name
  if (!getDeviceName() && !localStorage.getItem('setup_done')) {
    showSetupScreen();
    return;
  }

  await loadAndRender();
  setupNav();
  setupBeforeUnload();
}

// ── First-run Setup ───────────────────────────────────────────────────────────

function showSetupScreen() {
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('setup-save').addEventListener('click', async () => {
    const name = document.getElementById('setup-device-name').value.trim();
    setDeviceName(name || 'Gerät');
    localStorage.setItem('setup_done', '1');
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    await loadAndRender();
    setupNav();
    setupBeforeUnload();
  });
}

// ── Load & Render ─────────────────────────────────────────────────────────────

async function loadAndRender() {
  products = await getProducts();
  cartItems = await getCart();

  renderProductGrid(products, handleProductClick, handlePfandClick);
  renderOrderList(cartItems, handleRemoveItem);
  renderTotal(computeTotal(cartItems));
  updateBackupTimestamp(getLastBackup());

  document.getElementById('device-label').textContent = getDeviceLabel();
}

// ── Order View: Product Tap ───────────────────────────────────────────────────

async function handleProductClick(product) {
  // Getränk buchen
  const existing = cartItems.find((i) => i.product_id === product.id && i.qty > 0);
  if (existing) {
    existing.qty++;
    await addToCart(existing);
  } else {
    const item = {
      id: generateId(),
      product_id: product.id,
      product_name: product.name,
      qty: 1,
      unit_price_cents: product.price_cents,
    };
    cartItems.push(item);
    await addToCart(item);
  }

  // Pfand automatisch dazu buchen wenn das Produkt Pfand hat
  if (product.pledge_amount_cents > 0) {
    const pfandId = product.id + '_pfand_out';
    const existingPfand = cartItems.find((i) => i.product_id === pfandId && i.qty > 0);
    if (existingPfand) {
      existingPfand.qty++;
      await addToCart(existingPfand);
    } else {
      const pfandItem = {
        id: generateId(),
        product_id: pfandId,
        product_name: product.name + ' (Pfand)',
        qty: 1,
        unit_price_cents: product.pledge_amount_cents,
      };
      cartItems.push(pfandItem);
      await addToCart(pfandItem);
    }
  }

  renderOrderList(cartItems, handleRemoveItem);
  renderTotal(computeTotal(cartItems));
}

async function handlePfandClick(product) {
  const item = {
    id: generateId(),
    product_id: product.id + '_pfand',
    product_name: product.name + ' (Pfand)',
    qty: -1,
    unit_price_cents: product.pledge_amount_cents,
  };
  cartItems.push(item);
  await addToCart(item);
  renderOrderList(cartItems, handleRemoveItem);
  renderTotal(computeTotal(cartItems));
}

async function handleRemoveItem(id) {
  await removeFromCart(id);
  cartItems = cartItems.filter((i) => i.id !== id);
  renderOrderList(cartItems, handleRemoveItem);
  renderTotal(computeTotal(cartItems));
}

// ── Payment ───────────────────────────────────────────────────────────────────

document.getElementById('pay-btn').addEventListener('click', () => {
  if (cartItems.length === 0) {
    showToast('Bestellung ist leer', 'error');
    return;
  }
  const total = computeTotal(cartItems);
  openPaymentDialog(total, async (givenCents) => {
    const tx = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      device_id: getDeviceId(),
      items: cartItems.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        qty: i.qty,
        unit_price_cents: i.unit_price_cents,
      })),
      total_cents: total,
      paid_cents: givenCents,
      change_cents: computeChange(givenCents, total),
    };
    await saveTransaction(tx);
    await clearCart();
    cartItems = [];
    renderOrderList(cartItems, handleRemoveItem);
    renderTotal(0);
    showToast('Transaktion gespeichert ✓', 'success');
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

function setupNav() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

async function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('nav-btn--active', btn.dataset.view === view);
  });

  if (view === 'stats') {
    const txs = await getAllTransactions();
    renderStats(txs);
  }
  if (view === 'settings') {
    const all = await getAllProducts();
    renderProductSettings(all, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
    document.getElementById('device-name-input').value = getDeviceName();
  }
}

// ── Settings: Products ────────────────────────────────────────────────────────

async function handleEditProduct(product) {
  fillProductForm(product);
  document.getElementById('product-form-overlay').classList.add('overlay--visible');
}

function handleDeleteProduct(id) {
  if (!confirm('Produkt wirklich löschen?')) return;
  deleteProduct(id).then(async () => {
    const all = await getAllProducts();
    renderProductSettings(all, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
    products = await getProducts();
    renderProductGrid(products, handleProductClick, handlePfandClick);
    showToast('Produkt gelöscht');
  });
}

async function handleMoveUp(idx) {
  const all = await getAllProducts();
  if (idx === 0) return;
  [all[idx - 1], all[idx]] = [all[idx], all[idx - 1]];
  all.forEach((p, i) => { p.sort_order = i; });
  for (const p of all) await saveProduct(p);
  renderProductSettings(all, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
  products = await getProducts();
  renderProductGrid(products, handleProductClick, handlePfandClick);
}

async function handleMoveDown(idx) {
  const all = await getAllProducts();
  if (idx === all.length - 1) return;
  [all[idx], all[idx + 1]] = [all[idx + 1], all[idx]];
  all.forEach((p, i) => { p.sort_order = i; });
  for (const p of all) await saveProduct(p);
  renderProductSettings(all, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
  products = await getProducts();
  renderProductGrid(products, handleProductClick, handlePfandClick);
}

// ── Product Form ──────────────────────────────────────────────────────────────

document.getElementById('add-product-btn').addEventListener('click', () => {
  fillProductForm(null);
  document.getElementById('product-form-overlay').classList.add('overlay--visible');
});

document.getElementById('product-form-cancel').addEventListener('click', () => {
  document.getElementById('product-form-overlay').classList.remove('overlay--visible');
});

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pf-id').value || generateId();
  const name = document.getElementById('pf-name').value.trim();
  const priceCents = parseToCents(document.getElementById('pf-price').value);
  const pledgeCents = parseToCents(document.getElementById('pf-pledge').value || '0');

  if (!name || isNaN(priceCents) || priceCents <= 0) {
    showToast('Bitte Name und gültigen Preis eingeben', 'error');
    return;
  }

  const all = await getAllProducts();
  const existing = all.find((p) => p.id === id);
  const sort_order = existing ? existing.sort_order : all.length;

  await saveProduct({ id, name, price_cents: priceCents, pledge_amount_cents: isNaN(pledgeCents) ? 0 : pledgeCents, active: true, sort_order });
  document.getElementById('product-form-overlay').classList.remove('overlay--visible');

  const updatedAll = await getAllProducts();
  renderProductSettings(updatedAll, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
  products = await getProducts();
  renderProductGrid(products, handleProductClick, handlePfandClick);
  showToast(`${name} gespeichert`, 'success');
});

function fillProductForm(product) {
  document.getElementById('pf-id').value = product?.id || '';
  document.getElementById('pf-name').value = product?.name || '';
  document.getElementById('pf-price').value = product ? (product.price_cents / 100).toFixed(2).replace('.', ',') : '';
  document.getElementById('pf-pledge').value = product?.pledge_amount_cents ? (product.pledge_amount_cents / 100).toFixed(2).replace('.', ',') : '';
}

// ── Settings: Device Name ─────────────────────────────────────────────────────

document.getElementById('device-name-save').addEventListener('click', () => {
  const name = document.getElementById('device-name-input').value.trim();
  setDeviceName(name || 'Gerät');
  document.getElementById('device-label').textContent = getDeviceLabel();
  showToast('Gerätename gespeichert', 'success');
});

// ── Export Buttons ────────────────────────────────────────────────────────────

document.getElementById('export-csv-btn').addEventListener('click', async () => {
  try {
    await exportCSV();
    showToast('CSV exportiert ✓', 'success');
  } catch (err) {
    showToast('Export fehlgeschlagen: ' + err.message, 'error');
  }
});

document.getElementById('export-config-btn').addEventListener('click', async () => {
  try {
    await exportConfig();
    showToast('Konfiguration exportiert ✓', 'success');
  } catch (err) {
    showToast('Export fehlgeschlagen: ' + err.message, 'error');
  }
});

document.getElementById('import-config-btn').addEventListener('click', () => {
  importConfig(
    async (count) => {
      products = await getProducts();
      renderProductGrid(products, handleProductClick, handlePfandClick);
      const all = await getAllProducts();
      renderProductSettings(all, handleEditProduct, handleDeleteProduct, handleMoveUp, handleMoveDown);
      showToast(`${count} Produkte importiert ✓`, 'success');
    },
    (msg) => showToast('Import fehlgeschlagen: ' + msg, 'error')
  );
});

// ── Delete All Transactions ───────────────────────────────────────────────────

document.getElementById('clear-data-btn').addEventListener('click', async () => {
  const txs = await getAllTransactions();
  if (!confirm(`Wirklich ALLE ${txs.length} Transaktionen löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
  await clearAllTransactions();
  showToast('Alle Transaktionen gelöscht', 'success');
  if (currentView === 'stats') {
    const empty = [];
    renderStats(empty);
  }
});

// ── Beforeunload warning ──────────────────────────────────────────────────────

function setupBeforeUnload() {
  window.addEventListener('beforeunload', (e) => {
    if (cartItems.length > 0) {
      e.preventDefault();
      e.returnValue = 'Laufende Bestellung! Wirklich die Seite verlassen?';
    }
  });
}

// ── Update Banner ─────────────────────────────────────────────────────────────

function showUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.querySelector('button').addEventListener('click', () => {
      navigator.serviceWorker.controller?.postMessage('skipWaiting');
      window.location.reload();
    });
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

init().catch(console.error);
