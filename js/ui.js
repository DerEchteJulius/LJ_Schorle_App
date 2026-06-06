// UI rendering — DOM manipulation

import { formatCents } from './cart.js';

// ── Product Grid ──────────────────────────────────────────────────────────────

export function renderProductGrid(products, onProductClick, onPfandClick) {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';

  // Getränke-Buttons
  products.forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'product-btn';
    btn.innerHTML = `<span class="product-name">${escHtml(p.name)}</span><span class="product-price">${formatCents(p.price_cents)}</span>`;
    btn.addEventListener('click', () => onProductClick(p));
    grid.appendChild(btn);
  });

  // Pfand-Rückgabe: einen Button pro einzigartigem Pfandbetrag
  const uniquePledges = [...new Map(
    products.filter(p => p.pledge_amount_cents > 0)
            .map(p => [p.pledge_amount_cents, p])
  ).values()];

  uniquePledges.forEach((p) => {
    const pfBtn = document.createElement('button');
    pfBtn.className = 'product-btn pfand-btn';
    pfBtn.innerHTML = `<span class="product-name">↩ Pfand zurück</span><span class="product-price">-${formatCents(p.pledge_amount_cents)}</span>`;
    pfBtn.addEventListener('click', () => onPfandClick(p));
    grid.appendChild(pfBtn);
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
  givenEl.textContent = '–';
  changeEl.textContent = '–';
  changeEl.classList.remove('change--positive');
  completeBtn.disabled = true;
  completeBtn.textContent = 'Abschließen';
  completeBtn._givenCents = null;

  // ── Numpad state ────────────────────────────────────────────────────────────
  // We track two things separately:
  //   quickCents  — total added via quick-buttons (additive, e.g. 10+10 = 20 €)
  //   inputStr    — what the user is typing on the numpad keys
  // The effective "given" amount = quickCents + parsedInputCents.
  // When the user starts typing on the numpad after pressing a quick-button,
  // the numpad input starts fresh (replaces inputStr, quickCents stays).
  // Pressing another quick-button always adds to quickCents and clears inputStr.

  let quickCents = 0;
  let inputStr = '';
  let numpadActive = false; // true once user has pressed at least one numpad key

  function getGivenCents() {
    if (!inputStr && quickCents === 0) return null;
    const normalized = inputStr ? inputStr.replace(',', '.') : '0';
    const val = parseFloat(normalized);
    const inputCents = isNaN(val) ? 0 : Math.round(val * 100);
    return quickCents + inputCents;
  }

  function updateDisplay() {
    const givenCents = getGivenCents();
    if (givenCents === null) {
      givenEl.textContent = '–';
      changeEl.textContent = '–';
      changeEl.classList.remove('change--positive');
      completeBtn.disabled = true;
      completeBtn._givenCents = null;
      return;
    }
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
      if (inputStr.length > 0) {
        inputStr = inputStr.slice(0, -1);
      } else if (quickCents > 0) {
        // DEL on empty numpad clears last quick-amount step (subtract smallest quick)
        quickCents = 0;
      }
    } else if (key === ',') {
      if (!inputStr.includes(',')) inputStr += ',';
    } else {
      if (inputStr.length >= 7) return;
      inputStr += key;
    }
    numpadActive = true;
    updateDisplay();
  }

  // Wire numpad buttons
  const numpad = document.querySelector('.numpad');
  const numpadHandler = (e) => {
    const btn = e.target.closest('[data-key]');
    if (btn) handleKey(btn.dataset.key);
  };
  numpad.addEventListener('click', numpadHandler);

  // Wire quick-amount buttons — additive, each press adds the amount
  const quickBtns = document.querySelectorAll('.quick-btn');
  const quickHandlers = [];
  quickBtns.forEach((btn) => {
    const handler = () => {
      const cents = parseInt(btn.dataset.amount, 10);
      // Clear any manual numpad input when switching to quick-buttons
      inputStr = '';
      numpadActive = false;
      quickCents += cents;
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
    quickCents = 0;
    numpadActive = false;
  };

  completeBtn.onclick = () => {
    const givenCents = totalCents <= 0 ? 0 : (completeBtn._givenCents || 0);
    cleanup();
    onComplete(givenCents);
  };
  cancelBtn.onclick = cleanup;
}

// ── Settings View ─────────────────────────────────────────────────────────────

export function renderProductSettings(products, onEdit, onDelete, onReorder) {
  const list = document.getElementById('settings-product-list');
  list.innerHTML = '';

  products.forEach((p, idx) => {
    const li = document.createElement('li');
    li.className = 'settings-product-item';
    li.dataset.id = p.id;
    li.dataset.idx = idx;
    li.innerHTML = `
      <span class="drag-handle" aria-label="Verschieben">⠿</span>
      <div class="settings-product-info">
        <span class="settings-product-name">${escHtml(p.name)}</span>
        <span class="settings-product-price">${formatCents(p.price_cents)}${p.pledge_amount_cents ? ` + ${formatCents(p.pledge_amount_cents)} Pfand` : ''}</span>
      </div>
      <div class="settings-product-actions">
        <button class="icon-btn" data-action="edit" aria-label="Bearbeiten">✏️</button>
        <button class="icon-btn icon-btn--danger" data-action="delete" aria-label="Löschen">🗑</button>
      </div>
    `;
    li.querySelector('[data-action="edit"]').addEventListener('click', () => onEdit(p));
    li.querySelector('[data-action="delete"]').addEventListener('click', () => onDelete(p.id));
    list.appendChild(li);
  });

  // ── Touch drag-to-reorder ───────────────────────────────────────────────────
  let dragEl = null;
  let dragStartY = 0;
  let dragOrigIdx = -1;
  let placeholder = null;

  function getItemAtY(y) {
    const items = [...list.querySelectorAll('.settings-product-item:not(.dragging)')];
    for (const item of items) {
      const rect = item.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) return item;
    }
    return null;
  }

  list.addEventListener('touchstart', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    e.preventDefault();

    dragEl = handle.closest('.settings-product-item');
    dragOrigIdx = parseInt(dragEl.dataset.idx, 10);
    dragStartY = e.touches[0].clientY;

    const rect = dragEl.getBoundingClientRect();
    dragEl.classList.add('dragging');
    dragEl.style.top = rect.top + 'px';
    dragEl.style.width = rect.width + 'px';

    // Insert placeholder where item was
    placeholder = document.createElement('li');
    placeholder.className = 'drag-placeholder';
    placeholder.style.height = rect.height + 'px';
    list.insertBefore(placeholder, dragEl);
    list.appendChild(dragEl); // move to end so it floats above
  }, { passive: false });

  list.addEventListener('touchmove', (e) => {
    if (!dragEl) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy = touch.clientY - dragStartY;
    const rect = dragEl.getBoundingClientRect();
    dragEl.style.top = (rect.top - list.getBoundingClientRect().top + dy) + 'px';
    dragStartY = touch.clientY;

    // Move placeholder to indicate drop position
    const target = getItemAtY(touch.clientY);
    if (target && target !== placeholder) {
      const targetRect = target.getBoundingClientRect();
      if (touch.clientY < targetRect.top + targetRect.height / 2) {
        list.insertBefore(placeholder, target);
      } else {
        list.insertBefore(placeholder, target.nextSibling);
      }
    }
  }, { passive: false });

  list.addEventListener('touchend', () => {
    if (!dragEl) return;

    // Find new index from placeholder position
    const items = [...list.querySelectorAll('.settings-product-item')];
    const phIdx = [...list.children].indexOf(placeholder);

    dragEl.classList.remove('dragging');
    dragEl.style.top = '';
    dragEl.style.width = '';
    list.insertBefore(dragEl, placeholder);
    placeholder.remove();
    placeholder = null;

    // Calculate new index (excluding the dragged item itself)
    const newItems = [...list.querySelectorAll('.settings-product-item')];
    const newIdx = newItems.indexOf(dragEl);

    dragEl = null;
    if (newIdx !== dragOrigIdx) onReorder(dragOrigIdx, newIdx);
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
