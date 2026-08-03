# Kleiderbestellung (v1.0)

Bestellformular für Vereinskleidung/-ausrüstung als eigenständige, clientseitige
Web-App ohne Build-Step (Vanilla HTML/CSS/JS) — Teil der
[Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) des 1. SC 1911
Heiligenstadt.

**Live:** https://sc1911heiligenstadt.github.io/kleiderbestellung/

---

## Funktionen

### Bestellung aufgeben (Trainer:innen)
- Je Artikel im Katalog (z.B. Trainingsjacke, Poloshirt) die passende Größe
  wählen; die Menge ist vom Verein über den Artikelkatalog fest vorgegeben.
- Die eigene Bestellung kann beliebig oft geändert werden, solange das
  Bestellfenster geöffnet ist — die zuletzt gespeicherten Werte werden immer
  vorbelegt angezeigt.
- Ist das Bestellfenster geschlossen, wird die eigene Bestellung nur noch
  schreibgeschützt angezeigt.
- Betreute Mannschaft(en) aus dem zentralen Trainerprofil (Tools-Übersicht)
  werden als Hinweis neben dem eigenen Namen angezeigt, sofern dort gepflegt.

### Artikelkatalog & Bestellfenster (nur Admins)
- Artikel mit Name, verfügbaren Größen und Standardmenge anlegen, bearbeiten,
  deaktivieren oder entfernen. Bereits bestellte Artikel können nur deaktiviert
  (nicht gelöscht) werden, damit bestehende Bestellungen konsistent bleiben.
- Das Bestellfenster kann geschlossen werden, damit nach Auslösung der
  Lieferanten-Bestellung keine Änderungen mehr möglich sind. Wieder-Öffnen
  jederzeit möglich.

### Bestellungsübersicht & Export (nur Admins)
- Tabelle aller abgegebenen Bestellungen (Name, Positionen, letzte Änderung).
- Export als Text- oder PDF-Datei, gruppiert nach Artikel und Größe — direkt
  als Bestellliste an einen Lieferanten weiterreichbar.

### Daten & Speicherung
- Automatische Nextcloud-Synchronisierung über die zentrale Anmeldung in der
  [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/): einmal dort
  anmelden, danach wird diese Seite automatisch geladen und gespeichert — auch
  am Handy, ohne WebDAV-Adresse, Benutzername oder App-Passwort auf dem Gerät.
- Nur wer das Tool in der Übersicht sehen darf, kann es öffnen (Gruppen-Rechte
  werden serverseitig geprüft).

---

## Lokal starten

`fetch()`-Aufrufe von einem `file://`-Origin verhalten sich inkonsistent (CORS).
Die App daher über einen lokalen Static-Server öffnen:

```
npx serve .
```

Hinweis: Die geteilte Anmeldung mit der Tools-Übersicht (`localStorage` unter
der Origin `sc1911heiligenstadt.github.io`) funktioniert nur auf der Live-Seite, nicht
unter `localhost`.

---

## Datenmodell

Eine JSON-Datei, zentral über den Login-Gateway der Tools-Übersicht in der
Vereins-Nextcloud gespeichert (siehe `db.js`, `GATEWAY_URL`/`GATEWAY_APP_ID`):

```js
{
  "katalog": { "artikel": [ { "id", "name", "groessen": [...], "aktiv" } ] },
  "bestellfensterOffen": true,
  "bestellungen": {
    "<username>": {
      "vorname", "nachname",
      "positionen": [ { "artikelId", "groesse", "menge" } ],
      "kommentar", "letzteAenderung"
    }
  }
}
```

Artikel werden über einen stabilen `id`-Slug referenziert, nicht über den
Namen, damit Umbenennungen bestehende Bestellungen nicht verwaisen lassen.
