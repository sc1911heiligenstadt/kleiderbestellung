// Prüfstand für das Archiv der Bestellaktionen.
//
// ⚠️ Lädt app.js im ECHTEN Wortlaut in einen vm-Kontext mit Browser-Attrappen,
// schaltet über archivUmschalten() und liest danach das WIRKLICH gerenderte HTML
// der Bestellungsübersicht — keine nachgebaute Kopie der Funktionen.
//
// Der wichtigste Abschnitt ist 5: Archivieren ist Wegräumen, nicht Wegnehmen.
// Ausgabeliste, Export, Artikelkatalog und die Bestell-Seite müssen eine
// archivierte Aktion unverändert weiter anfassen.
//
// Aufruf: node pruef-archiv.mjs

import fs from "node:fs";
import vm from "node:vm";

let ok = 0, fehler = 0;
const zusage = (name, bedingung, zusatz) => {
  if (bedingung) { ok++; return; }
  fehler++;
  console.log("  FEHLT: " + name + (zusatz ? "  -> " + zusatz : ""));
};
const gleich = (name, ist, soll) =>
  zusage(name, JSON.stringify(ist) === JSON.stringify(soll),
    "ist " + JSON.stringify(ist) + ", erwartet " + JSON.stringify(soll));

// ---------- app.js in einen Kontext mit Attrappen laden ----------

let gespeichert = [];

const elemente = new Map();
const stubEl = (id) => {
  if (!elemente.has(id)) elemente.set(id, {
    id, style: {}, textContent: "", innerHTML: "", value: "", dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild() {}, removeChild() {}, addEventListener() {},
    closest: () => null, focus() {}, scrollIntoView() {}
  });
  return elemente.get(id);
};
class ConflictError extends Error {}
const sandbox = {
  console,
  document: {
    getElementById: stubEl,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, click() {} }),
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {}
  },
  window: { addEventListener() {}, print() {} },
  CSS: { escape: (s) => s },
  navigator: {},
  location: { href: "" },
  confirm: () => true,
  prompt: () => "Kopie",
  getSessionToken: () => "t",
  gatewayLoad: async () => ({}),
  gatewaySave: async (d) => { gespeichert.push(JSON.parse(JSON.stringify(d))); },
  fetchMe: async () => ({}),
  NotLoggedInError: class extends Error {},
  ConflictError,
  APP_VERSION: "1.0", APP_CHANGELOG: [], APP_FUNKTIONEN: [], EXTERN_BASIS: "x",
  QRCode: {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync("app.js", "utf8") + `
globalThis.__setze = (d, admin) => { appData = d; currentIsAdmin = admin !== false; };
globalThis.__alsNutzer = (u) => { currentUsername = u; };
globalThis.__sichtbare = () => sichtbareAktionen().map((a) => a.id);
globalThis.__hole = () => appData;`,
  sandbox, { filename: "app.js" });

const F = (name) => {
  const f = sandbox[name];
  if (typeof f !== "function") { console.log("  FEHLT GANZ: Funktion " + name); fehler++; return () => {}; }
  return f;
};
const normalizeAktion = F("normalizeAktion");
const normalizeAppData = F("normalizeAppData");
const istArchiviert = F("istArchiviert");
const archivUmschalten = F("archivUmschalten");
const kopiereAktion = F("kopiereAktion");
const toggleAktion = F("toggleAktion");

const fehlerText = () => stubEl("aktionen-error").textContent || "";

// ---------- Testdaten ----------
//
// runde1: geschlossen + abgeschlossen, mit Bestellungen und Ausgabe-Haken.
// runde2: laeuft noch, mit Bestellung.

const startDaten = () => normalizeAppData({
  aktionen: [
    {
      id: "trainerpaket", name: "Trainerpaket", offen: false, abgeschlossen: true,
      abgeschlossenAm: "2026-09-01T10:00:00.000Z",
      artikel: [{ id: "hoodie", name: "Hoodie", groessen: ["S", "M", "L"], standardMenge: 1, aktiv: true }],
      bestellungen: {
        "frank.wagner": { vorname: "Frank", nachname: "Wagner", positionen: [{ artikelId: "hoodie", groesse: "L", menge: 1 }] }
      },
      ausgabe: { "frank.wagner": { hoodie: { am: "2026-09-02", von: "michel" } } }
    },
    {
      id: "spielerpaket", name: "Spielerpaket U19", offen: true,
      artikel: [{ id: "trikot", name: "Trikot", groessen: ["140"], standardMenge: 1, aktiv: true }],
      bestellungen: {
        "maria.brandt": { vorname: "Maria", nachname: "Brandt", positionen: [{ artikelId: "trikot", groesse: "140", menge: 1 }] }
      }
    }
  ]
});

const neu = (admin) => {
  gespeichert = [];
  stubEl("aktionen-error").textContent = "";
  const d = startDaten();
  sandbox.__setze(d, admin !== false);
  return d;
};

// ---------- 1. Datenmodell ----------

console.log("\n1. Datenmodell");
{
  const a = normalizeAktion({ id: "x", name: "X" }, 0);
  gleich("archiviert wird angelegt", a.archiviert, false);
  gleich("archiviertAm wird angelegt", a.archiviertAm, "");

  // Eine Datei aus der Zeit vor dem Archiv darf nicht kippen.
  const alt = normalizeAppData({ aktionen: [{ id: "a1", name: "Alt", offen: false, artikel: [], bestellungen: {} }] });
  gleich("alte Aktion bekommt archiviert=false", alt.aktionen[0].archiviert, false);
  gleich("alte Aktion bleibt geschlossen", alt.aktionen[0].offen, false);

  // Kaputte Werte duerfen nicht als "archiviert" durchgehen.
  const kaputt = normalizeAktion({ id: "k", name: "K", archiviert: "ja", archiviertAm: 42 }, 0);
  gleich("String zaehlt nicht als archiviert", kaputt.archiviert, false);
  gleich("Zahl zaehlt nicht als Datum", kaputt.archiviertAm, "");
  gleich("istArchiviert() sagt nein", istArchiviert(kaputt), false);
  gleich("istArchiviert(undefined) kippt nicht", istArchiviert(undefined), false);
}

// ---------- 2. Umschalten ----------

console.log("\n2. Umschalten");
{
  const d = neu();
  await archivUmschalten("trainerpaket");
  gleich("geschlossene Aktion wandert ins Archiv", d.aktionen[0].archiviert, true);
  zusage("Datum wird gesetzt", /^\d{4}-\d{2}-\d{2}T/.test(d.aktionen[0].archiviertAm), d.aktionen[0].archiviertAm);
  gleich("wurde gespeichert", gespeichert.length, 1);

  await archivUmschalten("trainerpaket");
  gleich("zurueckholen loescht die Marke", d.aktionen[0].archiviert, false);
  gleich("zurueckholen loescht das Datum", d.aktionen[0].archiviertAm, "");
}
{
  // Eine laufende Aktion gehoert nicht ins Archiv -- es wird ja noch bestellt.
  const d = neu();
  await archivUmschalten("spielerpaket");
  gleich("laufende Aktion wandert NICHT ins Archiv", d.aktionen[1].archiviert, false);
  gleich("dabei wird nichts gespeichert", gespeichert.length, 0);
  zusage("und es steht eine Erklaerung da", /schließen/i.test(fehlerText()), "Meldung: " + fehlerText());
}
{
  // Umgekehrt muss das Zurueckholen immer gehen: sonst haenge eine versehentlich
  // archivierte Aktion fest, sobald jemand sie wieder oeffnet.
  const d = neu();
  d.aktionen[1].archiviert = true;
  d.aktionen[1].archiviertAm = "2026-09-05T00:00:00.000Z";
  await archivUmschalten("spielerpaket");
  gleich("zurueckholen geht auch bei einer laufenden Aktion", d.aktionen[1].archiviert, false);
}
// ⚠️ Bugjagd 10.09.2026, Fund 2: "archiviert" und "offen" waren zwei ganz
// unabhaengige Schalter. Wer eine archivierte Aktion wieder oeffnete, bekam
// eine laufende Runde, die in der Uebersicht im ZUGEKLAPPTEN Archiv-Block
// stand -- neue Bestellungen liefen dort ein, wo niemand hinsieht.
{
  const d = neu();
  d.aktionen[0].offen = false;
  d.aktionen[0].abgeschlossen = false;
  d.aktionen[0].archiviert = true;
  d.aktionen[0].archiviertAm = "2026-09-05T00:00:00.000Z";
  await toggleAktion("trainerpaket");
  gleich("wieder oeffnen setzt offen", d.aktionen[0].offen, true);
  gleich("wieder oeffnen holt zugleich aus dem Archiv", d.aktionen[0].archiviert, false);
  gleich("und loescht das Archiv-Datum", d.aktionen[0].archiviertAm, "");
  gleich("in EINEM Speichervorgang", gespeichert.length, 1);
}
{
  // Gegenprobe: Schliessen fasst den Archivstand NICHT an. Eine geschlossene
  // Aktion aus dem Archiv zu holen waere das Gegenteil des Aufraeumens.
  const d = neu();
  d.aktionen[1].archiviert = true;
  d.aktionen[1].archiviertAm = "2026-09-05T00:00:00.000Z";
  await toggleAktion("spielerpaket");
  gleich("schliessen setzt offen auf false", d.aktionen[1].offen, false);
  gleich("schliessen laesst die Archiv-Marke stehen", d.aktionen[1].archiviert, true);
  gleich("und das Archiv-Datum auch", d.aktionen[1].archiviertAm, "2026-09-05T00:00:00.000Z");
}
{
  // Und eine nicht archivierte Aktion bekommt beim Oeffnen keine leeren
  // Archivfelder untergeschoben.
  const d = neu();
  d.aktionen[0].offen = false;
  d.aktionen[0].abgeschlossen = false;
  await toggleAktion("trainerpaket");
  gleich("nicht archiviert: bleibt nicht archiviert", d.aktionen[0].archiviert, false);
  gleich("und das Archiv-Datum bleibt leer", d.aktionen[0].archiviertAm, "");
}
{
  const d = neu(false); // kein Bearbeiter
  await archivUmschalten("trainerpaket");
  gleich("ohne Bearbeiter-Recht passiert nichts", d.aktionen[0].archiviert, false);
  gleich("ohne Bearbeiter-Recht wird nicht gespeichert", gespeichert.length, 0);
}
{
  const d = neu();
  await archivUmschalten("gibt-es-nicht");
  gleich("unbekannte Aktion aendert nichts", gespeichert.length, 0);
  gleich("und archiviert auch nichts anderes", d.aktionen.map((a) => a.archiviert), [false, false]);
}

// ---------- 3. Die Bestellungsuebersicht ----------

console.log("\n3. Die Bestellungsuebersicht");
const uebersichtHtml = () => {
  sandbox.renderBestellungsuebersicht();
  return stubEl("uebersicht-rows").innerHTML;
};
{
  neu();
  const html = uebersichtHtml();
  zusage("ohne archivierte Aktion gibt es keinen Archiv-Block", !html.includes("uebersicht-archiv"));
  zusage("beide Aktionen stehen oben",
    html.includes("Trainerpaket") && html.includes("Spielerpaket U19"));
}
{
  const d = neu();
  await archivUmschalten("trainerpaket");
  const html = uebersichtHtml();
  zusage("jetzt gibt es einen Archiv-Block", html.includes("uebersicht-archiv"));
  gleich("genau ein Archiv-Block", (html.match(/uebersicht-archiv/g) || []).length, 1);
  zusage("mit Zaehler in der Einzahl", /1 erledigte Bestellaktion</.test(html), html.slice(html.indexOf("uebersicht-archiv"), html.indexOf("uebersicht-archiv") + 400));

  // Die laufende Aktion steht VOR dem Archiv-Block, die archivierte darin.
  const schnitt = html.indexOf("uebersicht-archiv");
  const oben = html.slice(0, schnitt), unten = html.slice(schnitt);
  zusage("die laufende Aktion steht oben", oben.includes("Spielerpaket U19"));
  zusage("die archivierte steht NICHT mehr oben", !oben.includes("Trainerpaket"));
  zusage("die archivierte steht im Archiv-Block", unten.includes("Trainerpaket"));

  // ⚠️ Sie ist WEGGERAEUMT, nicht weggenommen: die Bestellung samt Loeschknopf
  // steht im Archiv-Block genauso da wie oben.
  zusage("die Bestellung ist im Archiv vollstaendig da", unten.includes("Frank Wagner"));
  zusage("mit demselben Loesch-Knopf", unten.includes("btn-delete-bestellung"));
  zusage("und als aufklappbare Gruppe", unten.includes("uebersicht-gruppe"));
}
{
  // Sind alle Aktionen archiviert, bleibt oben nichts -- der Block traegt dann alles.
  const d = neu();
  await archivUmschalten("trainerpaket");
  d.aktionen[1].offen = false;
  await archivUmschalten("spielerpaket");
  const html = uebersichtHtml();
  gleich("Zaehler in der Mehrzahl", /(\d+) erledigte Bestellaktionen</.exec(html)[1], "2");
  gleich("der Leer-Hinweis bleibt aus", stubEl("uebersicht-empty").style.display, "none");
  zusage("beide stehen im Block", html.indexOf("Trainerpaket") > html.indexOf("uebersicht-archiv"));
}

// ---------- 4. Der Aufklapp-Zustand haelt ----------

console.log("\n4. Der Aufklapp-Zustand haelt");
{
  const d = neu();
  await archivUmschalten("trainerpaket");
  uebersichtHtml();
  // Der Merker liest den Zustand aus dem DOM zurueck. Die Attrappe liefert das
  // aufgeklappte <details> nach, so wie es im Browser dastuende.
  const rows = stubEl("uebersicht-rows");
  rows.querySelector = (sel) => (sel.includes("uebersicht-archiv") ? { open: true } : null);
  const html = uebersichtHtml();
  zusage("aufgeklappt bleibt aufgeklappt", /uebersicht-archiv" open/.test(html),
    html.slice(html.indexOf("uebersicht-archiv") - 20, html.indexOf("uebersicht-archiv") + 60));
  rows.querySelector = (sel) => (sel.includes("uebersicht-archiv") ? { open: false } : null);
  const zu = uebersichtHtml();
  zusage("zugeklappt bleibt zugeklappt", !/uebersicht-archiv" open/.test(zu));
  rows.querySelector = () => null;
}

// ---------- 5. ⚠️ Wegraeumen ist nicht Wegnehmen ----------
//
// Michel-Vorgabe vom 2026-09-10: ausgeblendet wird NUR in der
// Bestellungsuebersicht. Faellt eine archivierte Aktion irgendwo sonst heraus,
// verliert er die Ausgabeliste oder den Export einer Runde, die er noch braucht.

console.log("\n5. Wegraeumen ist nicht Wegnehmen");
{
  const d = neu();
  await archivUmschalten("trainerpaket");

  sandbox.renderAusgabe();
  const ausgabe = stubEl("ausgabe-rows").innerHTML;
  zusage("die Ausgabeliste zeigt die archivierte Aktion weiter", ausgabe.includes("Trainerpaket"),
    ausgabe.slice(0, 200));
  gleich("der Leer-Hinweis der Ausgabe bleibt aus", stubEl("ausgabe-empty").style.display, "none");

  sandbox.renderExportAuswahl();
  const exportSel = stubEl("export-aktion").innerHTML;
  zusage("die Export-Auswahl kennt sie weiter", exportSel.includes("Trainerpaket"), exportSel);

  sandbox.renderKatalogVerwaltung();
  const katalog = stubEl("katalog-rows").innerHTML;
  zusage("der Artikelkatalog zeigt sie weiter", katalog.includes("Hoodie"), katalog.slice(0, 200));

  sandbox.renderAktionenVerwaltung();
  const verwaltung = stubEl("aktionen-rows").innerHTML;
  zusage("die Aktions-Verwaltung zeigt sie weiter", verwaltung.includes("Trainerpaket"));
  zusage("und kennzeichnet sie als archiviert", verwaltung.includes("im Archiv"));

  // Die Bestell-Seite zeigt eine geschlossene Aktion weiter, wenn man dort
  // bestellt hat. Beleg: dieselbe Frage einmal mit und einmal ohne Archiv-Marke
  // muss dieselbe Antwort geben -- sonst haette Frank seine Bestellung verloren.
  sandbox.__alsNutzer("frank.wagner");
  const mitArchiv = sandbox.__sichtbare();
  d.aktionen[0].archiviert = false;
  const ohneArchiv = sandbox.__sichtbare();
  gleich("Frank sieht seine archivierte Bestellung weiter", mitArchiv, ohneArchiv);
  zusage("und sie ist wirklich dabei", mitArchiv.includes("trainerpaket"), JSON.stringify(mitArchiv));
  d.aktionen[0].archiviert = true;
  sandbox.__alsNutzer(null);

  zusage("die Daten sind vollstaendig da",
    Object.keys(d.aktionen[0].bestellungen).length === 1 &&
    Object.keys(d.aktionen[0].ausgabe).length === 1);
}

// ---------- 6. Zusammenspiel mit dem Kopieren ----------

console.log("\n6. Zusammenspiel mit dem Kopieren");
{
  const d = neu();
  await archivUmschalten("trainerpaket");
  await kopiereAktion("trainerpaket");
  const kopie = d.aktionen[1];
  gleich("die Kopie heisst wie im Dialog eingegeben", kopie.name, "Kopie");
  zusage("die Kopie ist NICHT archiviert", !istArchiviert(kopie),
    "archiviert ist " + JSON.stringify(kopie.archiviert));
  zusage("die Kopie hat kein Archiv-Datum", !kopie.archiviertAm);
  gleich("das Original bleibt archiviert", d.aktionen[0].archiviert, true);

  // Die frische Kopie hat noch keine Bestellungen und steht deshalb gar nicht in
  // der Uebersicht -- aber auf keinen Fall im Archiv.
  const html = uebersichtHtml();
  const schnitt = html.indexOf("uebersicht-archiv");
  zusage("das Original steht im Archiv", schnitt >= 0 && html.slice(schnitt).includes("Trainerpaket"));
  zusage("die leere Kopie steht nirgends in der Uebersicht", !html.includes(">Kopie<"));

  // Sobald die Kopie eine Bestellung hat, steht sie OBEN -- nicht im Archiv.
  kopie.bestellungen["maria.brandt"] = { vorname: "Maria", nachname: "Brandt", positionen: [{ artikelId: kopie.artikel[0].id, groesse: "L", menge: 1 }] };
  const html2 = uebersichtHtml();
  const schnitt2 = html2.indexOf("uebersicht-archiv");
  zusage("die Kopie mit Bestellung steht oben, nicht im Archiv",
    html2.slice(0, schnitt2).includes("Kopie"), html2.slice(0, 300));
}

// ---------- 7. Verdrahtung ----------

console.log("\n7. Verdrahtung");
{
  const d = neu();
  sandbox.renderAktionenVerwaltung();
  const html = stubEl("aktionen-rows").innerHTML;
  const zeilen = html.split("aktion-row-wrap");
  const zeileVon = (id) => zeilen.find((z) => z.includes(`"${id}"`)) || "";

  zusage("die geschlossene Aktion hat den Archivieren-Knopf",
    zeileVon("trainerpaket").includes("btn-archiv-aktion"));
  zusage("die laufende Aktion hat ihn NICHT",
    !zeileVon("spielerpaket").includes("btn-archiv-aktion"),
    zeileVon("spielerpaket").slice(0, 300));
  zusage("er heisst Archivieren", /btn-archiv-aktion[^>]*>Archivieren</.test(html));

  await archivUmschalten("trainerpaket");
  sandbox.renderAktionenVerwaltung();
  const html2 = stubEl("aktionen-rows").innerHTML;
  zusage("nach dem Archivieren heisst er Aus dem Archiv holen",
    /btn-archiv-aktion[^>]*>Aus dem Archiv holen</.test(html2));

  // Auch eine wieder geoeffnete, aber noch archivierte Aktion muss den
  // Zurueckhol-Knopf tragen -- sonst haengt sie im Archiv fest.
  d.aktionen[0].offen = true;
  d.aktionen[0].abgeschlossen = false;
  sandbox.renderAktionenVerwaltung();
  const html3 = stubEl("aktionen-rows").innerHTML;
  zusage("wieder geoeffnet und archiviert: der Knopf bleibt",
    (html3.split("aktion-row-wrap").find((z) => z.includes('"trainerpaket"')) || "").includes("btn-archiv-aktion"));

  const quelle = fs.readFileSync("app.js", "utf8");
  zusage("der Klick-Delegate ruft archivUmschalten auf",
    /btn-archiv-aktion[\s\S]{0,120}archivUmschalten\(aktionId\)/.test(quelle));
  zusage("die Uebersicht baut den Archiv-Block",
    /uebersicht-archiv[\s\S]{0,600}archiv\.map\(uebersichtGruppeHtml\)/.test(quelle));
  zusage("das Stylesheet kennt den Archiv-Block",
    fs.readFileSync("style.css", "utf8").includes(".uebersicht-archiv"));
}

// ---------- Ergebnis ----------

console.log(`\n${fehler ? "FEHLER" : "OK"}: ${ok} Zusagen erfüllt, ${fehler} offen.`);
process.exit(fehler ? 1 : 0);
