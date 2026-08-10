const APP_VERSION = "1.0";

// Basis des Links, den Spieler ohne Vereinskonto zum Bestellen bekommen.
// ⚠️ Bewusst die feste Live-Adresse und NICHT aus location abgeleitet: der Link
// wird verschickt und als QR-Code gezeigt. Aus einem Dev-Server erzeugt zeigte
// er sonst auf localhost — und das fiele erst auf, wenn ihn jemand scannt.
const EXTERN_BASIS = "https://sc1911heiligenstadt.github.io/kleiderbestellung/extern.html";

const APP_CHANGELOG = [
  {
    version: "1.4",
    groups: [
      {
        title: "Hinweistext je Bestellaktion",
        items: [
          "Jede Bestellaktion kann jetzt einen Freitext tragen — zum Beispiel „Von jedem Teil ist das erste kostenfrei, jedes weitere zahlt ihr selbst“ oder was sonst zur Aktion zu sagen ist.",
          "Gepflegt wird der Text im Reiter „Einstellungen“ direkt bei der Bestellaktion; Zeilenumbrüche bleiben erhalten.",
          "Zu lesen ist er vorn im Bestellformular über den Artikeln — im Reiter „Meine Bestellung“ genauso wie auf der Bestellseite für Spieler über den Link."
        ]
      }
    ]
  },
  {
    version: "1.3",
    groups: [
      {
        title: "Frei wählbare Menge je Artikel",
        items: [
          "Neu im Artikelkatalog: die Standardmenge 0. Sie bedeutet, dass die Menge nicht vorgegeben ist — wer bestellt, trägt sie selbst ein (mindestens 1).",
          "Das gilt im Reiter „Meine Bestellung“ genauso wie auf der Bestellseite für Spieler über den Link.",
          "Wird eine Größe gewählt, aber keine Menge eingetragen, sagt die Seite Bescheid statt die Zeile still wegzulassen.",
          "Bei allen anderen Artikeln bleibt alles wie gehabt: die Menge kommt fest aus dem Katalog und lässt sich beim Bestellen nicht ändern."
        ]
      }
    ]
  },
  {
    version: "1.2",
    groups: [
      {
        title: "Aufklappbare Bestellaktionen",
        items: [
          "Jede Bestellaktion — etwa Trainerpaket oder U19-Paket — ist im Reiter „Meine Bestellung“ jetzt ein aufklappbares Feld: zugeklappt bleibt nur die Kopfzeile mit Name und Status, bei mehreren Aktionen wird die Seite damit deutlich kürzer.",
          "Die Kopfzeile zeigt schon zugeklappt, ob die eigene Bestellung steht („✓ 3 Artikel gewählt“) oder noch nichts gewählt ist.",
          "Läuft nur eine einzige Bestellaktion, steht sie wie bisher direkt offen da.",
          "Auch im Reiter „Einstellungen“ sind Artikelkatalog und Bestellungsübersicht je Bestellaktion aufklappbar — mit Artikel- bzw. Bestellzahl in der Kopfzeile.",
          "Was auf- oder zugeklappt ist, bleibt beim Speichern und Aktualisieren erhalten; nach dem Anlegen eines Artikels öffnet sich seine Gruppe von selbst."
        ]
      }
    ]
  },
  {
    version: "1.1",
    groups: [
      {
        title: "Bestellen ohne Vereinskonto",
        items: [
          "Spieler haben kein Konto in der Tools-Übersicht und können jetzt trotzdem selbst bestellen — über einen Link je Bestellaktion, den es als QR-Code zum Zeigen und zum Verschicken gibt.",
          "Wer den Link öffnet, trägt Vorname, Nachname und Geburtsjahr ein und wählt seine Größen. Die Menge gibt weiterhin der Verein vor.",
          "Beim ersten Absenden vergibt der Besteller ein eigenes Passwort. Damit kommt er über denselben Link jederzeit wieder an seine Bestellung und kann sie ändern, solange die Aktion läuft.",
          "Das Geburtsjahr gehört zum Namen dazu: zwei gleichnamige Spieler bekommen dadurch getrennte Bestellungen.",
          "Umlaute und Schreibweisen sind egal — „Müller“ und „Mueller“ führen auf dieselbe Bestellung."
        ]
      },
      {
        title: "Den Link verwalten",
        items: [
          "Je Bestellaktion lässt sich ein Link erzeugen, als QR-Code anzeigen, als Bild herunterladen und wieder zurückziehen.",
          "Ein zurückgezogener Link führt sofort ins Leere; bereits abgegebene Bestellungen bleiben davon unberührt.",
          "In der Bestellungsübersicht sind externe Bestellungen als solche gekennzeichnet und tragen den Jahrgang.",
          "Hat jemand sein Passwort vergessen, lässt es sich dort zurücksetzen — er vergibt dann beim nächsten Öffnen ein neues und sieht seine bisherige Bestellung wieder.",
          "Externe Bestellungen zählen in der Bestellliste für den Lieferanten ganz normal mit."
        ]
      }
    ]
  },
  {
    version: "1.0",
    groups: [
      {
        title: "Bestellung aufgeben",
        items: [
          "Trainerinnen und Trainer wählen aus einem Artikelkatalog die passende Größe — etwa Trainingsjacke oder Poloshirt.",
          "Wie viele Stücke je Artikel möglich sind, gibt der Verein über den Katalog vor.",
          "Die eigene Bestellung lässt sich beliebig oft ändern, solange das Bestellfenster offen ist.",
          "Ein Kommentarfeld nimmt Anmerkungen auf, zum Beispiel Rückfragen zur Größe.",
          "Die betreuten Mannschaften stehen als Hinweis neben dem eigenen Namen, sofern sie im zentralen Trainerprofil gepflegt sind."
        ]
      },
      {
        title: "Bestellaktionen",
        items: [
          "Es gibt beliebig viele Bestellaktionen nebeneinander — zum Beispiel Trainerpaket, Spielerpaket und Funktionärspaket.",
          "Jede Aktion erscheint im Reiter „Meine Bestellung“ als eigene Karte mit eigenen Artikeln, eigenem Kommentar und eigenem Speichern-Knopf.",
          "Jede Aktion hat ihr eigenes Bestellfenster: eine kann beim Lieferanten und damit geschlossen sein, während eine andere noch läuft.",
          "Eine geschlossene Aktion sehen nur noch die, die dort auch bestellt haben — abgeschlossene Runden stehen also nicht mehr allen im Weg.",
          "Eine Bestellaktion lässt sich anlegen, umbenennen, schließen, wieder öffnen und entfernen. Entfernen geht erst, wenn keine Bestellungen mehr darin liegen."
        ]
      },
      {
        title: "Bestellfenster",
        items: [
          "Das Bestellfenster jeder Aktion lässt sich öffnen und schließen.",
          "Ist es geschlossen, sind die Bestellungen dieser Aktion nur noch lesbar — damit sich nach der Bestellung beim Lieferanten nichts mehr verschiebt.",
          "Wieder öffnen ist jederzeit möglich; andere Aktionen laufen unbeeindruckt weiter."
        ]
      },
      {
        title: "Artikelkatalog",
        items: [
          "Artikel mit Namen, verfügbaren Größen und Standardmenge anlegen, bearbeiten, stilllegen oder entfernen.",
          "Der Katalog ist nach Bestellaktion gruppiert; ein neuer Artikel wird beim Anlegen einer Aktion zugeordnet.",
          "Ein Artikel lässt sich über ein Auswahlfeld in eine andere Aktion verschieben — bereits abgegebene Bestellungen dieses Artikels wandern mit, damit keine Bestellung ins Leere zeigt.",
          "Ein Artikel, der schon bestellt wurde, lässt sich nur stilllegen und nicht löschen — sonst stünden bestehende Bestellungen ohne Bezug da."
        ]
      },
      {
        title: "Übersicht und Bestellliste",
        items: [
          "Tabelle aller abgegebenen Bestellungen mit Name, Positionen und letzter Änderung, jede Aktion als eigener Abschnitt mit eigener Summe.",
          "Export als Text- oder PDF-Datei, gruppiert nach Artikel und Größe — so lässt sie sich direkt an den Lieferanten weiterreichen.",
          "Der Export lässt sich auf eine einzelne Bestellaktion einschränken; „Alle Bestellaktionen“ liefert eine Datei mit einem Abschnitt je Aktion.",
          "Nach dem Speichern einer Bestellung aktualisiert sich die Übersicht sofort."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: das Bestellformular schreibgeschützt mit Hinweis; eine Bestellung abgeben geht nicht, auch nicht am Bildschirm vorbei.",
          "Bearbeiten: die eigene Bestellung aufgeben und ändern.",
          "Administrieren: Bestellaktionen anlegen und schließen, Artikelkatalog pflegen, Gesamtübersicht einsehen, fremde Bestellungen löschen und die Bestellliste exportieren.",
          "Der Reiter „Info“ ist für alle sichtbar."
        ]
      },
      {
        title: "Bedienung am Handy",
        items: [
          "Die Reiterleiste bricht am Handy um, statt seitlich aus dem Bild zu laufen — auch die hinteren Reiter sind auf schmalen Bildschirmen erreichbar.",
          "Eingabefelder sind mindestens 16 Pixel groß, damit der iPhone-Browser beim Antippen nicht ungefragt in die Seite hineinzoomt und verschoben stehen bleibt."
        ]
      },
      {
        title: "Daten & Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — ein eigenes Passwort braucht es nicht."
        ]
      }
    ]
  }
];
