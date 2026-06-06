// UI rendering — DOM manipulation

import { formatCents } from './cart.js';

// ── Product Grid ──────────────────────────────────────────────────────────────

export function renderProductGrid(products, onProductClick, onPfandClick) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';
  products.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'product-btn';
    btn.innerHTML = `<span class="product-name">${escHtml(p.name)}</span><span class="product-price">${formatCents(p.price_cents)}</span>`;
    btn.addEventListener('click', () => onProductClick(p));
    grid.appendChild(btn);

    if (p.pledge_amount_cents > 0) {
      const pfBtn = document.createElement('button');
      pfBtn.className = 'product-btn pfand-btn';
      pfBtn.innerHTML = `<span class="product-name">↩ Pfand</span><span class="product-price">-${formatCents(p.pledge_amount_cents)}</span>`;
      pfBtn.addEventListener('click', () => onPfandClick(p));
      grid.appendChild(pfBtn);
    }
  });
}

// ── Order List ────────────────────────────────────────────────────────────────

export function renderOrderList(cartItems, onRemove) {
  const list = document.getElementById('order-list');
  list.innerHTML = '';

  if (cartItems.length === 0) {
    list.innerHTML = '<li class="empty-hint">Produkte antippen zum Hinzufügen</li>';
    return;
  }

  cartItems.forEach((item) => {
    const li = document.createElement('li');
    // qty < 0 → Pfand-Rückgabe (gelb), product_id endet auf _pfand_out → Pfand-Aufschlag (grün-dim)
    let cls = 'order-item';
    if (item.qty < 0) cls += ' order-item--pfand';
    else if (item.product_id && item.product_id.endsWith('_pfand_out')) cls += ' order-item--pfand-out';
    li.className = cls;
    const lineTotal = item.qty * item.unit_price_cents;
    li.innerHTML = `
      <span class="item-name">${escHtml(item.product_name)}${item.qty !== 1 && item.qty !== -1 ? ` ×${item.qty}` : ''}</span>
      <span class="item-price">${formatCents(lineTotal)}</span>
      <button class="remove-btn" aria-label="Entfernen">✕</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', () => onRemove(item.id));
    list.appendChild(li);
  });
}

// ── Total Display ─────────────────────────────────────────────────────────────

export function renderTotal(totalCents) {
  const el = document.getElementById('order-total');
  el.textContent = formatCents(totalCents);
  el.classList.toggle('total--negative', totalCents < 0);
}

// ── Last Backup ───────────────────────────────────────────────────────────────

export function updateBackupTimestamp(ts) {
  const el = document.getElementById('last-backup');
  if (el) el.textContent = ts ? `Letzte Sicherung: ${ts}` : 'Noch keine Sicherung';
}

// ── Toast ─────────────────────────────────────────────────────────────────────

export function showToast(message, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast--visible'), 10);
  setTimeout(() => { t.classList.remove('toast--visible'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ── Payment Dialog ────────────────────────────────────────────────────────────

export function openPaymentDialog(totalCents, onComplete) {
  const overlay = document.getElementById('payment-overlay');
  const totalEl = document.getElementById('pay-total');
  const givenEl = document.getElementById('pay-given-display');
  const changeEl = document.getElementById('pay-change');
  const completeBtn = document.getElementById('pay-complete');
  const cancelBtn = document.getElementById('pay-cancel');

  totalEl.textContent = formatCents(totalCents);
  changeEl.textContent = '–';
  changeEl.classList.remove('change--positive');
  completeBtn.disabled = true;
  completeBtn.textContent = 'Abschließen';

  // Numpad state
  let inputStr = ''; // raw string the user is building, e.g. "1050" = 10,50

  function updateDisplay() {
    if (!inputStr) {
      givenEl.textContent = '–';
      changeEl.textContent = '–';
      completeBtn.disabled = true;
      completeBtn._givenCents = null;
      return;
    }
    // Parse: allow one comma, treat as decimal separator
    const normalized = inputStr.replace(',', '.');
    const val = parseFloat(normalized);
    if (isNaN(val)) return;
    const givenCents = Math.round(val * 100);
    givenEl.textContent = formatCents(givenCents);

    if (givenCents >= totalCents || totalCents <= 0) {
      const ch = givenCents - totalCents;
      changeEl.textContent = formatCents(ch);
      changeEl.classList.toggle('change--positive', ch >= 0);
      completeBtn.disabled = false;
      completeBtn._givenCents = givenCents;
    } else {
      changeEl.textContent = '–';
      changeEl.classList.remove('change--positive');
      completeBtn.disabled = true;
      completeBtn._givenCents = null;
    }
  }

  function handleKey(key) {
    if (key === 'del') {
      inputStr = inputStr.slice(0, -1);
    } else if (key === ',') {
      if (!inputStr.includes(',')) inputStr += ',';
    } else {
      // Max 7 chars (99999,99)
      if (inputStr.length >= 7) return;
      inputStr += key;
    }
    updateDisplay();
  }

  // Wire numpad buttons
  const numpad = document.querySelector('.numpad');
  const numpadHandler = (e) => {
    const btn = e.target.closest('[data-key]');
    if (btn) handleKey(btn.dataset.key);
  };
  numpad.addEventListener('click', numpadHandler);

  // Wire quick-amount buttons
  const quickBtns = document.querySelectorAll('.quick-btn');
  const quickHandlers = [];
  quickBtns.forEach((btn) => {
    const handler = () => {
      const cents = parseInt(btn.dataset.amount, 10);
      inputStr = String(cents / 100);
      updateDisplay();
    };
    btn.addEventListener('click', handler);
    quickHandlers.push({ btn, handler });
  });

  // Pfand-only: total is negative → direct completion
  if (totalCents <= 0) {
    givenEl.textContent = formatCents(0);
    changeEl.textContent = formatCents(Math.abs(totalCents));
    changeEl.classList.add('change--positive');
    completeBtn.disabled = false;
    completeBtn.textContent = 'Rückgabe bestätigen';
    completeBtn._givenCents = 0;
  }

  overlay.classList.add('overlay--visible');

  const cleanup = () => {
    overlay.classList.remove('overlay--visible');
    numpad.removeEventListener('click', numpadHandler);
    quickHandlers.forEach(({ btn, handler }) => btn.removeEventListener('click', handler));
    completeBtn.onclick = null;
    cancelBtn.onclick = null;
    inputStr = '';
  };

  completeBtn.onclick = () => {
    const givenCents = totalCents <= 0 ? 0 : (completeBtn._givenCents || 0);
    cleanup();
    onComplete(givenCents);
  };
  cancelBtn.onclick = cleanup;
}

// ── Settings View ─────────────────────────────────────────────────────────────

export function renderProductSettings(products, onEdit, onDelete, onMoveUp, onMoveDown) {
  const list = document.getElementById('settings-product-list');
  list.innerHTML = '';
  products.forEach((p, idx) => {
    const li = document.createElement('li');
    li.className = 'settings-product-item';
    li.innerHTML = `
      <div class="settings-product-info">
        <span class="settings-product-name">${escHtml(p.name)}</span>
        <span class="settings-product-price">${formatCents(p.price_cents)}${p.pledge_amount_cents ? ` + ${formatCents(p.pledge_amount_cents)} Pfand` : ''}</span>
      </div>
      <div class="settings-product-actions">
        <button class="icon-btn" data-action="up" ${idx === 0 ? 'disabled' : ''} aria-label="Nach oben">▲</button>
        <button class="icon-btn" data-action="down" ${idx === products.length - 1 ? 'disabled' : ''} aria-label="Nach unten">▼</button>
        <button class="icon-btn" data-action="edit" aria-label="Bearbeiten">✏️</button>
        <button class="icon-btn icon-btn--danger" data-action="delete" aria-label="Löschen">🗑</button>
      </div>
    `;
    li.querySelector('[data-action="up"]').addEventListener('click', () => onMoveUp(idx));
    li.querySelector('[data-action="down"]').addEventListener('click', () => onMoveDown(idx));
    li.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(p));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(p.id));
    list.appendChild(li);
  });
}

// ── Statistics View ───────────────────────────────────────────────────────────

export function renderStats(transactions) {
  const statsEl = document.getElementById('stats-list');
  const totalEl = document.getElementById('stats-total');

  // Aggregate by product name
  const map = {};
  let grandTotal = 0;

  transactions.forEach((tx) => {
    tx.items.forEach((item) => {
      const key = item.product_name;
      if (!map[key]) map[key] = { name: key, qty: 0, total_cents: 0 };
      map[key].qty += item.qty;
      map[key].total_cents += item.qty * item.unit_price_cents;
    });
    grandTotal += tx.total_cents;
  });

  const sorted = Object.values(map).sort((a, b) => b.total_cents - a.total_cents);

  statsEl.innerHTML = '';
  if (sorted.length === 0) {
    statsEl.innerHTML = '<li class="empty-hint">Noch keine Transaktionen</li>';
  } else {
    sorted.forEach((row) => {
      const li = document.createElement('li');
      li.className = 'stats-row';
      li.innerHTML = `
        <span class="stats-name">${escHtml(row.name)}</span>
        <span class="stats-qty">${row.qty}×</span>
        <span class="stats-total">${formatCents(row.total_cents)}</span>
      `;
      statsEl.appendChild(li);
    });
  }

  totalEl.textContent = formatCents(grandTotal);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
