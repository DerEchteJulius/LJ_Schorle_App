# Ausschank Kasse

Offline-PWA Kassensystem für Ausschank-Events. Kein App Store, kein Backend, kein Internet nötig.

## Installation (iPad)

1. App auf GitHub Pages deployen (HTTPS Pflicht für PWA)
2. In Safari auf dem iPad öffnen
3. Teilen → "Zum Home-Bildschirm hinzufügen"
4. App startet wie eine native App, funktioniert offline

## Lokale Entwicklung

```bash
npx serve .   # oder: python3 -m http.server 8080
```

Dann `http://localhost:8080` öffnen. Für PWA-Features (Service Worker, Installation) ist HTTPS nötig → GitHub Pages.

## Tests

`test.html` im Browser öffnen — läuft ohne Build-Tool.

## Sync zwischen 3 iPads

**Vor dem Event:** Einstellungen → "Konfiguration exportieren" → AirDrop an andere iPads → dort "Konfiguration importieren"

**Nach dem Event:** Statistik → "CSV exportieren" auf jedem iPad → alle 3 CSVs in Excel zusammenführen → Pivot nach `product_name` + Summe `quantity`

## Datenmodell

```
products:     { id, name, price_cents, pledge_amount_cents, active, sort_order }
cart:         { id, product_id, product_name, qty, unit_price_cents }   ← laufende Bestellung
transactions: { id, timestamp, device_id, items[], total_cents, paid_cents, change_cents }
```

Alle Geldbeträge in **Integer-Cents** (500 = 5,00 €). Kein Float.

## Datenverlust-Schutz

- IndexedDB überlebt Browser-Reload und App-Wechsel
- Kein "Löschen"-Button ohne Bestätigungs-Dialog
- Letzter Sicherungs-Timestamp auf Hauptscreen sichtbar
- Gefährlich: iOS Einstellungen → Safari → Websitedaten löschen (vermeiden!)
