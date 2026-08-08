const APP_VERSION = "1.0";

const APP_CHANGELOG = [
  {
    version: "1.1",
    groups: [
      {
        title: "Bestellaktionen sind jetzt getrennt",
        items: [
          "Statt eines einzigen Topfes gibt es beliebig viele Bestellaktionen nebeneinander — zum Beispiel Trainerpaket, Spielerpaket und Funktionärspaket.",
          "Jede Aktion erscheint im Reiter „Meine Bestellung“ als eigene Karte mit eigenen Artikeln, eigenem Kommentar und eigenem Speichern-Knopf.",
          "Jede Aktion hat ihr eigenes Bestellfenster: eine kann beim Lieferanten und damit geschlossen sein, während eine andere noch läuft.",
          "Eine geschlossene Aktion sehen nur noch die, die dort auch bestellt haben — abgeschlossene Runden stehen also nicht mehr allen im Weg.",
          "Alles, was vor dieser Änderung bestellt wurde, steht vollständig in der Aktion „Bestellaktion 1“ und lässt sich dort umbenennen und aufteilen."
        ]
      },
      {
        title: "Katalog nach Aktion sortiert",
        items: [
          "Der Artikelkatalog ist nach Bestellaktion gruppiert; ein neuer Artikel wird beim Anlegen einer Aktion zugeordnet.",
          "Ein Artikel lässt sich über ein Auswahlfeld in eine andere Aktion verschieben — bereits abgegebene Bestellungen dieses Artikels wandern mit, damit keine Bestellung ins Leere zeigt.",
          "Eine Bestellaktion lässt sich anlegen, umbenennen, schließen, wieder öffnen und entfernen. Entfernen geht erst, wenn keine Bestellungen mehr darin liegen."
        ]
      },
      {
        title: "Übersicht und Bestellliste je Aktion",
        items: [
          "Die Bestellungsübersicht zeigt jede Aktion als eigenen Abschnitt.",
          "Der Export lässt sich auf eine einzelne Bestellaktion einschränken; „Alle Bestellaktionen“ liefert eine Datei mit einem Abschnitt und einer eigenen Summe je Aktion."
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
        title: "Bestellfenster",
        items: [
          "Das Bestellfenster lässt sich öffnen und schließen.",
          "Ist es geschlossen, sind alle Bestellungen nur noch lesbar — damit sich nach der Bestellung beim Lieferanten nichts mehr verschiebt.",
          "Wieder öffnen ist jederzeit möglich."
        ]
      },
      {
        title: "Artikelkatalog",
        items: [
          "Artikel mit Namen, verfügbaren Größen und Standardmenge anlegen, bearbeiten, stilllegen oder entfernen.",
          "Ein Artikel, der schon bestellt wurde, lässt sich nur stilllegen und nicht löschen — sonst stünden bestehende Bestellungen ohne Bezug da."
        ]
      },
      {
        title: "Übersicht und Bestellliste",
        items: [
          "Tabelle aller abgegebenen Bestellungen mit Name, Positionen und letzter Änderung.",
          "Export als Text- oder PDF-Datei, gruppiert nach Artikel und Größe — so lässt sie sich direkt an den Lieferanten weiterreichen.",
          "Nach dem Speichern einer Bestellung aktualisiert sich die Übersicht sofort."
        ]
      },
      {
        title: "Wer darf was",
        items: [
          "Sehen: das Bestellformular schreibgeschützt mit Hinweis; eine Bestellung abgeben geht nicht, auch nicht am Bildschirm vorbei.",
          "Bearbeiten: die eigene Bestellung aufgeben und ändern.",
          "Administrieren: Artikelkatalog pflegen, Bestellfenster öffnen und schließen, Gesamtübersicht einsehen, fremde Bestellungen löschen und die Bestellliste exportieren.",
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
