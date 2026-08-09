# 👕 Kleiderbestellung

Trainer:innen bestellen Vereinskleidung/-ausrüstung mit ihrer Größe aus einem Artikelkatalog; Admin verwaltet Katalog und Bestellfenster und exportiert eine Lieferanten-Bestellliste.

**➡️ [Kleiderbestellung öffnen](https://sc1911heiligenstadt.github.io/kleiderbestellung/)**

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen.

Die Rechte gelten in drei Stufen: **Sehen** (nur ansehen), **Bearbeiten** (Einträge pflegen) und **Administrieren** (Einstellungen und Verwaltung). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Bestellen ohne Vereinskonto

Spieler haben kein Konto in der Tools-Übersicht. Für sie lässt sich je Bestellaktion ein eigener Link erzeugen — als QR-Code zum Zeigen oder zum Verschicken. Wer ihn öffnet, trägt Vorname, Nachname und Geburtsjahr ein, wählt seine Größen und vergibt dabei ein eigenes Passwort; damit kommt er später über denselben Link wieder an seine Bestellung.

Zu finden unter **Einstellungen → Bestellaktionen → 🔗 Link für Spieler**. Der Link lässt sich jederzeit zurückziehen; bereits abgegebene Bestellungen bleiben davon unberührt.

## Lokal starten

Über den Eintrag `kleiderbestellung` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8795/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
