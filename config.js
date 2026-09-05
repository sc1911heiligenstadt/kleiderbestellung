const APP_VERSION = "1.0";

// Basis des Links, den Spieler ohne Vereinskonto zum Bestellen bekommen.
// ⚠️ Bewusst die feste Live-Adresse und NICHT aus location abgeleitet: der Link
// wird verschickt und als QR-Code gezeigt. Aus einem Dev-Server erzeugt zeigte
// er sonst auf localhost — und das fiele erst auf, wenn ihn jemand scannt.
const EXTERN_BASIS = "https://sc1911heiligenstadt.github.io/kleiderbestellung/extern.html";

const APP_CHANGELOG = [
  {
    version: "1.1",
    groups: [
      {
        title: "Eine bestellte Größe verschwindet nicht mehr",
        items: [
          "Nimmt die Verwaltung eine Größe aus dem Katalog oder schreibt sie anders („XL“ raus, „128“ wird „128 cm“), stand die schon bestellte Zeile bisher auf „— keine Auswahl —“. Es sah aus, als hätte man nie etwas gewählt. Beim nächsten Speichern fiel die Zeile lautlos weg — aus der Bestellung und aus der Liste für den Lieferanten. Jetzt bleibt die bestellte Größe stehen, mit dem Zusatz „(nicht mehr im Katalog)“, und wird mitgespeichert. Gilt für den Reiter „Meine Bestellung“ und für die Bestellseite der Spieler."
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
          "Wie viele Stücke je Artikel möglich sind, gibt der Verein über den Katalog vor. Steht dort die Standardmenge 0, trägt der Besteller die Menge selbst ein (mindestens 1).",
          "Die eigene Bestellung lässt sich beliebig oft ändern, solange das Bestellfenster offen ist.",
          "Ein Kommentarfeld nimmt Anmerkungen auf, zum Beispiel Rückfragen zur Größe.",
          "Die betreuten Mannschaften stehen als Hinweis neben dem eigenen Namen, sofern sie im zentralen Trainerprofil gepflegt sind."
        ]
      },
      {
        title: "Bestellaktionen",
        items: [
          "Es gibt beliebig viele Bestellaktionen nebeneinander — zum Beispiel Trainerpaket, Spielerpaket und Funktionärspaket.",
          "Jede Aktion erscheint im Reiter „Meine Bestellung“ als eigenes aufklappbares Feld mit eigenen Artikeln, eigenem Kommentar und eigenem Speichern-Knopf. Zugeklappt bleibt die Kopfzeile mit Name und Status stehen — sie zeigt schon dort, ob die eigene Bestellung steht („✓ 3 Artikel gewählt“) oder noch nichts gewählt ist. Läuft nur eine einzige Aktion, steht sie direkt offen da.",
          "Jede Aktion kann einen Hinweistext tragen — zum Beispiel „Von jedem Teil ist das erste kostenfrei, jedes weitere zahlt ihr selbst“. Er steht vorn im Bestellformular über den Artikeln, im Reiter „Meine Bestellung“ genauso wie auf der Bestellseite für Spieler.",
          "Jede Aktion hat ihr eigenes Bestellfenster: eine kann beim Lieferanten und damit geschlossen sein, während eine andere noch läuft. Ist es geschlossen, sind die Bestellungen dieser Aktion nur noch lesbar — damit sich nach der Bestellung beim Lieferanten nichts mehr verschiebt. Wieder öffnen ist jederzeit möglich.",
          "Eine geschlossene Aktion sehen nur noch die, die dort auch bestellt haben — abgeschlossene Runden stehen also nicht mehr allen im Weg.",
          "Eine Bestellaktion lässt sich anlegen, umbenennen, schließen, wieder öffnen und entfernen. Entfernen geht erst, wenn keine Bestellungen mehr darin liegen."
        ]
      },
      {
        title: "Artikelkatalog",
        items: [
          "Artikel mit Namen, verfügbaren Größen und Standardmenge anlegen, bearbeiten, stilllegen oder entfernen.",
          "Der Katalog ist nach Bestellaktion gruppiert und je Aktion aufklappbar, mit der Artikelzahl in der Kopfzeile; ein neuer Artikel wird beim Anlegen einer Aktion zugeordnet.",
          "Ein Artikel lässt sich über ein Auswahlfeld in eine andere Aktion verschieben — bereits abgegebene Bestellungen dieses Artikels wandern mit, damit keine Bestellung ins Leere zeigt.",
          "Ein Artikel, der schon bestellt wurde, lässt sich nur stilllegen und nicht löschen — sonst stünden bestehende Bestellungen ohne Bezug da."
        ]
      },
      {
        title: "Bestellen ohne Vereinskonto",
        items: [
          "Spieler haben kein Konto in der Tools-Übersicht und können trotzdem selbst bestellen — über einen Link je Bestellaktion, den es als QR-Code zum Zeigen und zum Verschicken gibt.",
          "Wer den Link öffnet, trägt Vorname, Nachname und Geburtsjahr ein und wählt seine Größen. Ist die Menge im Katalog freigegeben, trägt er sie ebenfalls ein; sonst gibt sie der Verein vor.",
          "Beim ersten Absenden vergibt der Besteller ein eigenes Passwort. Damit kommt er über denselben Link jederzeit wieder an seine Bestellung und kann sie ändern, solange die Aktion läuft.",
          "Das Geburtsjahr gehört zum Namen dazu: zwei gleichnamige Spieler bekommen dadurch getrennte Bestellungen.",
          "Umlaute und Schreibweisen sind egal — „Müller“ und „Mueller“ führen auf dieselbe Bestellung.",
          "Die Bestellseite trägt ihre eigene Datenschutz-Information nach Art. 13 DSGVO."
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
      },
      {
        title: "Übersicht und Bestellliste",
        items: [
          "Tabelle aller abgegebenen Bestellungen mit Name, Positionen und letzter Änderung, jede Aktion als eigener aufklappbarer Abschnitt mit eigener Summe.",
          "Export als Text- oder PDF-Datei, gruppiert nach Artikel und Größe — so lässt sie sich direkt an den Lieferanten weiterreichen.",
          "Der Export lässt sich auf eine einzelne Bestellaktion einschränken; „Alle Bestellaktionen“ liefert eine Datei mit einem Abschnitt je Aktion.",
          "Nach dem Speichern einer Bestellung aktualisiert sich die Übersicht sofort.",
          "Was auf- oder zugeklappt ist, bleibt beim Speichern und Aktualisieren erhalten; nach dem Anlegen eines Artikels öffnet sich seine Gruppe von selbst."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: das Bestellformular schreibgeschützt mit Hinweis; eine Bestellung abgeben geht nicht, auch nicht am Bildschirm vorbei.",
          "Bearbeiten: die eigene Bestellung aufgeben und ändern.",
          "Administrieren: Bestellaktionen anlegen und schließen, Artikelkatalog pflegen, Gesamtübersicht einsehen, fremde Bestellungen löschen, die Bestellliste exportieren und die Links für Spieler verwalten.",
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
        title: "Daten und Speicherung",
        items: [
          "Gespeichert wird in der Vereins-Nextcloud über die zentrale Anmeldung der Tools-Übersicht — wer ein Vereinskonto hat, braucht hier kein eigenes Passwort.",
          "Nur wer ohne Vereinskonto über den Link bestellt, vergibt sich beim ersten Absenden ein eigenes Passwort für seine Bestellung."
        ]
      }
    ]
  }
];
