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
    // Anzeige: qty=1 → kein Suffix, qty=3 → ×3, qty=-3 → ×3 (Betrag ist schon negativ)
    const absQty = Math.abs(item.qty);
    const qtySuffix = absQty > 1 ? ` ×${absQty}` : '';
    li.innerHTML = `
      <span class="item-name">${escHtml(item.product_name)}${qtySuffix}</span>
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

  // Vollständig additives Modell — alles in Cents, kein String
  let givenCents = 0;

  function updateDisplay() {
    if (givenCents === 0) {
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

  // Numpad: jede Taste addiert ihren Cents-Wert, "reset" setzt auf 0
  const numpad = document.querySelector('.numpad');
  const numpadHandler = (e) => {
    const btn = e.target.closest('[data-cents]');
    if (!btn) return;
    if (btn.dataset.cents === 'reset') {
      givenCents = 0;
    } else {
      givenCents += parseInt(btn.dataset.cents, 10);
    }
    updateDisplay();
  };
  numpad.addEventListener('click', numpadHandler);

  // Quick-Buttons (Scheine) — auch additiv
  const quickBtns = document.querySelectorAll('.quick-btn');
  const quickHandlers = [];
  quickBtns.forEach((btn) => {
    const handler = () => {
      givenCents += parseInt(btn.dataset.amount, 10);
      updateDisplay();
    };
    btn.addEventListener('click', handler);
    quickHandlers.push({ btn, handler });
  });

  // Pfand-only: total negativ → direkte Bestätigung ohne Eingabe
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
    givenCents = 0;
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

function aggregateByProduct(transactions) {
  const map = {};
  let grandTotal = 0;
  let txCount = 0;
  transactions.forEach((tx) => {
    txCount++;
    grandTotal += tx.total_cents;
    tx.items.forEach((item) => {
      // Nur Getränke zählen (keine Pfand-Aufschläge, keine neg. Pfand-Rückgaben)
      const key = item.product_name;
      if (!map[key]) map[key] = { name: key, qty: 0, total_cents: 0 };
      map[key].qty += item.qty;
      map[key].total_cents += item.qty * item.unit_price_cents;
    });
  });
  const rows = Object.values(map).sort((a, b) => b.total_cents - a.total_cents);
  return { rows, grandTotal, txCount };
}

function renderProductTable(rows, grandTotal, txCount, container) {
  container.innerHTML = '';
  if (rows.length === 0) {
    container.innerHTML = '<p class="empty-hint">Keine Transaktionen</p>';
    return;
  }
  const summary = document.createElement('div');
  summary.className = 'stats-summary';
  summary.innerHTML = `
    <span>${txCount} Transaktionen</span>
    <span class="stats-grand-amount">${formatCents(grandTotal)}</span>
  `;
  container.appendChild(summary);

  const table = document.createElement('ul');
  table.className = 'stats-list-inner';
  rows.forEach((row) => {
    const li = document.createElement('li');
    li.className = 'stats-row';
    li.innerHTML = `
      <span class="stats-name">${escHtml(row.name)}</span>
      <span class="stats-qty">${row.qty}×</span>
      <span class="stats-total">${formatCents(row.total_cents)}</span>
    `;
    table.appendChild(li);
  });
  container.appendChild(table);
}

export function renderStats(localTxs, allFirebaseTxs, deviceLabel) {
  const container = document.getElementById('stats-container');
  container.innerHTML = '';

  // ── Tab bar ──────────────────────────────────────────────────────────────
  const tabs = document.createElement('div');
  tabs.className = 'stats-tabs';
  const tabDefs = [
    { key: 'gesamt', label: '📊 Gesamt' },
    { key: 'geraete', label: '📱 Pro Gerät' },
    { key: 'lokal', label: '🏷 Dieses Gerät' },
  ];
  tabDefs.forEach(({ key, label }) => {
    const btn = document.createElement('button');
    btn.className = 'stats-tab-btn';
    btn.dataset.tab = key;
    btn.textContent = label;
    tabs.appendChild(btn);
  });
  container.appendChild(tabs);

  const content = document.createElement('div');
  content.className = 'stats-tab-content';
  container.appendChild(content);

  // ── Gesamt (Firebase alle Geräte) ────────────────────────────────────────
  const allTxs = allFirebaseTxs.length > 0 ? allFirebaseTxs : localTxs;
  const { rows: allRows, grandTotal: allTotal, txCount: allCount } = aggregateByProduct(allTxs);

  // ── Pro Gerät ────────────────────────────────────────────────────────────
  const deviceMap = {};
  allTxs.forEach((tx) => {
    const d = tx.device_name || tx.device_id || 'Unbekannt';
    if (!deviceMap[d]) deviceMap[d] = [];
    deviceMap[d].push(tx);
  });

  // ── Lokal ────────────────────────────────────────────────────────────────
  const { rows: localRows, grandTotal: localTotal, txCount: localCount } = aggregateByProduct(localTxs);

  function showTab(key) {
    tabs.querySelectorAll('.stats-tab-btn').forEach((b) => b.classList.toggle('stats-tab-btn--active', b.dataset.tab === key));
    content.innerHTML = '';

    if (key === 'gesamt') {
      const wrap = document.createElement('div');
      const source = allFirebaseTxs.length > 0
        ? `<p class="stats-source">☁ Live aus Firebase (${allTxs.length} Transaktionen total)</p>`
        : `<p class="stats-source stats-source--warn">⚠ Kein Firebase — nur lokale Daten</p>`;
      wrap.innerHTML = source;
      content.appendChild(wrap);
      renderProductTable(allRows, allTotal, allCount, wrap);

    } else if (key === 'geraete') {
      if (Object.keys(deviceMap).length === 0) {
        content.innerHTML = '<p class="empty-hint">Keine Gerätedaten verfügbar</p>';
        return;
      }
      Object.entries(deviceMap).forEach(([device, txs]) => {
        const { rows, grandTotal, txCount } = aggregateByProduct(txs);
        const section = document.createElement('div');
        section.className = 'stats-device-section';
        section.innerHTML = `<h3 class="stats-device-name">${escHtml(device)}</h3>`;
        renderProductTable(rows, grandTotal, txCount, section);
        content.appendChild(section);
      });

    } else if (key === 'lokal') {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<p class="stats-source">Nur dieses Gerät: <strong>${escHtml(deviceLabel)}</strong></p>`;
      content.appendChild(wrap);
      renderProductTable(localRows, localTotal, localCount, wrap);
    }
  }

  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) showTab(btn.dataset.tab);
  });

  showTab('gesamt');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
