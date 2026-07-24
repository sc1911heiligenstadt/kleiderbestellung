const APP_VERSION = "1.0";

const APP_CHANGELOG = [
  {
    version: "1.0",
    groups: [
      {
        title: "Bestellung aufgeben",
        items: [
          "Trainer:innen wählen aus einem Artikelkatalog (z.B. Trainingsjacke, Poloshirt) die passende Größe; die Menge je Artikel ist vom Verein über den Artikelkatalog fest vorgegeben.",
          "Die eigene Bestellung kann beliebig oft geändert werden, solange das Bestellfenster geöffnet ist.",
          "Kommentarfeld für Anmerkungen zur Bestellung (z.B. Rückfragen zur Größe).",
          "Betreute Mannschaft(en) aus dem zentralen Trainerprofil (Tools-Übersicht) werden als Hinweis neben dem eigenen Namen angezeigt, sofern dort gepflegt."
        ]
      },
      {
        title: "Anmeldung & Speicherung",
        items: [
          "Automatische Nextcloud-Synchronisierung über die zentrale Anmeldung (Tools-Übersicht) — kein separates Passwort auf diesem Gerät nötig.",
          "Bestellen setzt jetzt Bearbeiten-Recht voraus: Wer das Tool nur sehen darf, sieht das Bestellformular schreibgeschützt mit Hinweis und kann keine Bestellung mehr abgeben (auch serverseitig gesperrt)."
        ]
      },
      {
        title: "Bestellfenster (Administration)",
        items: [
          "Artikelkatalog pflegen, Bestellfenster öffnen/schließen, Bestellübersicht und fremde Bestellungen löschen sind an die Stufe „Administrieren“ der Gruppen-Verwaltung gekoppelt (Häkchen im Sichtbarkeits-Panel der Tools-Übersicht) — die eigene Bestellung aufgeben/ändern bleibt für jeden mit Tool-Zugriff unverändert möglich.",
          "Das Bestellfenster kann geschlossen werden — danach sind alle Bestellungen nur noch lesbar, damit nach Auslösung der Lieferanten-Bestellung keine Änderungen mehr möglich sind.",
          "Wieder-Öffnen jederzeit möglich.",
          "Nach dem Speichern der eigenen Bestellung aktualisiert sich die Bestellübersicht für Administrierende sofort (vorher blieb sie bis zum nächsten Neuladen auf dem alten Stand)."
        ]
      },
      {
        title: "Artikelkatalog (Administration)",
        items: [
          "Artikel mit Name, verfügbaren Größen und Standardmenge anlegen, bearbeiten, deaktivieren oder entfernen.",
          "Artikel, die bereits bestellt wurden, können nur deaktiviert (nicht gelöscht) werden, damit bestehende Bestellungen konsistent bleiben."
        ]
      },
      {
        title: "Bestellungsübersicht & Export (Administration)",
        items: [
          "Tabelle aller abgegebenen Bestellungen mit Name, Positionen und letzter Änderung.",
          "Export als Text- oder PDF-Datei, gruppiert nach Artikel und Größe — direkt als Bestellliste an den Lieferanten weiterreichbar."
        ]
      }
    ]
  }
];
