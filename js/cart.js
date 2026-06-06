// Cart calculation logic — all amounts in integer cents
// No floats used for money. Display via formatCents().

/**
 * Format cents as German Euro string.
 * formatCents(500)   → "5,00 €"
 * formatCents(-600)  → "-6,00 €"
 * formatCents(12345) → "123,45 €"
 */
export function formatCents(cents) {
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const euroStr = euros.toLocaleString('de-DE');
  return (cents < 0 ? '-' : '') + euroStr + ',' + rest + ' €';
}

/**
 * Parse a Euro string from user input to cents.
 * Accepts: "5", "5,00", "5.00", "5,5"
 * Returns integer cents, or NaN on invalid input.
 */
export function parseToCents(input) {
  const s = String(input).trim().replace('€', '').trim();
  // Replace comma with dot for parsing
  const normalized = s.replace(',', '.');
  const val = parseFloat(normalized);
  if (isNaN(val) || val < 0) return NaN;
  return Math.round(val * 100);
}

/**
 * Compute total of cart items in cents.
 * items: [{ qty, unit_price_cents }]
 * qty can be negative (Pfand-Rückgabe).
 */
export function computeTotal(items) {
  return items.reduce((sum, item) => sum + item.qty * item.unit_price_cents, 0);
}

/**
 * Compute change in cents.
 * Returns paid - total. Can be negative if total < 0 (Pfand-only order).
 */
export function computeChange(paidCents, totalCents) {
  return paidCents - totalCents;
}

/**
 * Generate a unique ID (for cart items, transactions, products).
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Get or create device ID from localStorage.
 * Survives IndexedDB eviction — localStorage has separate lifecycle.
 */
export function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('device_id', id);
  }
  return id;
}

export function getDeviceName() {
  return localStorage.getItem('device_name') || '';
}

export function setDeviceName(name) {
  localStorage.setItem('device_name', name.trim());
}

export function getDeviceLabel() {
  const name = getDeviceName();
  return name || getDeviceId().slice(0, 8);
}

/**
 * Record last backup timestamp.
 */
export function setLastBackup() {
  localStorage.setItem('last_backup', new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
}

export function getLastBackup() {
  return localStorage.getItem('last_backup') || null;
}
