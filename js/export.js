// CSV and JSON export/import

import { getAllTransactions, getAllProducts, replaceAllProducts } from './db.js';
import { getDeviceLabel, setLastBackup } from './cart.js';

// ── CSV Export ────────────────────────────────────────────────────────────────

export async function exportCSV() {
  const transactions = await getAllTransactions();
  const deviceLabel = getDeviceLabel();

  const header = 'timestamp,device_id,product_name,quantity,unit_price_cents,line_total_cents,order_total_cents,paid_cents,change_cents\n';

  const rows = transactions.flatMap((tx) =>
    tx.items.map((item) => [
      tx.timestamp,
      deviceLabel,
      JSON.stringify(item.product_name),
      item.qty,
      item.unit_price_cents,
      item.qty * item.unit_price_cents,
      tx.total_cents,
      tx.paid_cents,
      tx.change_cents,
    ].join(','))
  );

  const csv = header + rows.join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const filename = `kasse-${deviceLabel}-${new Date().toISOString().slice(0, 10)}.csv`;

  await shareFile(blob, filename, 'text/csv');
  setLastBackup();
}

// ── Config Export (products) ──────────────────────────────────────────────────

export async function exportConfig() {
  const products = await getAllProducts();
  const json = JSON.stringify({ version: 1, products }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `kasse-config-${new Date().toISOString().slice(0, 10)}.json`;
  await shareFile(blob, filename, 'application/json');
}

// ── Config Import (products) ──────────────────────────────────────────────────

export function importConfig(onSuccess, onError) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.products || !Array.isArray(data.products)) throw new Error('Ungültiges Format');
      await replaceAllProducts(data.products);
      onSuccess(data.products.length);
    } catch (err) {
      onError(err.message);
    }
  };
  input.click();
}

// ── Share helper (Web Share API with fallback) ────────────────────────────────

async function shareFile(blob, filename, type) {
  const file = new File([blob], filename, { type });

  // Try Web Share API (iOS 15+)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // User cancelled — not an error
    }
  }

  // Fallback: download via data URI
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
