# 👕 Kleiderbestellung

Vereinskleidung und Ausrüstung aus einem **Artikelkatalog** bestellen — jede:r
mit der eigenen Größe. Die Verwaltung öffnet dafür eine **Bestellaktion**, sieht
am Ende die gesammelte Übersicht und exportiert daraus die Bestellliste für den
Lieferanten.

**➡️ [Kleiderbestellung öffnen](https://sc1911heiligenstadt.github.io/kleiderbestellung/)**

## Seiten

| Seite | Wofür |
|---|---|
| [Kleiderbestellung](https://sc1911heiligenstadt.github.io/kleiderbestellung/) | Die eigene Bestellung abgeben; Verwaltung von Katalog und Bestellaktionen |
| [Bestellung für Spieler](https://sc1911heiligenstadt.github.io/kleiderbestellung/extern.html) (`extern.html`) | Für Spieler und Eltern **ohne Vereinskonto** — über den Link je Bestellaktion, ganz ohne Anmeldung |

Die Spieler-Seite wird über einen Link je Bestellaktion erreicht, den die Verwaltung
erzeugt, als QR-Code anzeigt, als Bild herunterlädt und wieder zurückziehen kann. Wer
sie öffnet, trägt Vorname, Nachname und Geburtsjahr ein und vergibt beim ersten
Absenden ein eigenes Passwort — damit kommt er über denselben Link jederzeit wieder an
seine Bestellung. Umlaute und Schreibweisen sind dabei egal; das Geburtsjahr trennt
zwei gleichnamige Spieler.

## Wie es gedacht ist

1. Die Verwaltung legt eine **Bestellaktion** an — etwa Trainerpaket oder
   Spielerpaket —, pflegt ihren **Artikelkatalog** und öffnet ihr Bestellfenster.
   Jede Aktion kann einen eigenen Hinweistext tragen, der über den Artikeln steht.
2. Wer bestellen will, wählt Artikel und Größe unter **Meine Bestellung**.
   Spieler und Eltern ohne Konto bekommen dafür einen eigenen Link mit QR-Code.
3. Ist das Bestellfenster geschlossen, steht die **Bestellungsübersicht**, und der
   **Export** liefert die Liste für den Lieferanten — nach Artikel und Größe
   gruppiert, als Text oder PDF.

Jede Aktion hat ihr eigenes Bestellfenster: eine kann beim Lieferanten und damit
geschlossen sein, während eine andere noch läuft. Geschlossene Aktionen sehen nur
noch die, die dort bestellt haben.

Die Menge gibt in der Regel der Verein über den Katalog vor. Steht dort die
Standardmenge 0, trägt der Besteller sie selbst ein.

Liegt für eine Person schon eine Bestellung vor, sagt die Seite das — statt
stillschweigend eine zweite anzulegen.

## Wichtig: nicht die Kleiderbörse

Hier wird **neue** Vereinskleidung bestellt. **Gebrauchte** Kleidung geben
Familien über die
[Kleiderbörse](https://sc1911heiligenstadt.github.io/kleiderboerse/) weiter.

## Zugang

Die Anmeldung läuft über die [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) — dort einmal anmelden, danach ist dieses Werkzeug offen. Die Spieler-Seite braucht **keine Anmeldung**, sondern nur den persönlichen Link.

Die Rechte gelten in drei Stufen: **Sehen** (den Artikelkatalog und die eigene Bestellung ansehen), **Bearbeiten** (die eigene Bestellung abgeben und ändern, solange das Bestellfenster offen ist) und **Administrieren** (Reiter *Einstellungen*: Artikelkatalog und Bestellaktionen pflegen, Bestellungsübersicht, Export, fremde Bestellungen löschen und die Links für Spieler verwalten). Wer welche Stufe hat, legt die Tools-Übersicht fest.

## Lokal starten

Über den Eintrag `kleiderbestellung` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8795/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Die Daten liegen in der Vereins-Nextcloud; der Zugriff läuft ausschließlich über den Login-Worker der Tools-Übersicht, nie mit Zugangsdaten im Browser.

Die Spieler-Seite schreibt **ohne Login** — sie kennt dafür eng zugeschnittene
Aktionen im Worker und trägt ihre eigene Datenschutz-Information nach Art. 13 DSGVO.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
