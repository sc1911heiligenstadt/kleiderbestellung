// Prüfstand für "Bestellaktion kopieren".
//
// ⚠️ Lädt app.js im ECHTEN Wortlaut in einen vm-Kontext mit Browser-Attrappen und
// ruft kopiereAktion() selbst auf — keine nachgebaute Kopie der Funktion. Geprüft
// wird das, was die neue Runde wirklich braucht: neue Artikel-Ids ohne Kollision,
// leere Bestellungen, unberührte Quelle und ein sauberer Konflikt-Wiederholungslauf.
//
// Aufruf: node pruef-kopieren.mjs

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

let promptAntwort = null;      // was der Namensdialog zurückgibt
let promptTexte = [];
let gespeichert = [];          // jeder gatewaySave-Aufruf
let konfliktEinmal = null;     // { frischerStand } -> erster Save wirft ConflictError
let fehlermeldung = "";

const elemente = new Map();
const stubEl = (id) => {
  if (!elemente.has(id)) elemente.set(id, {
    id, style: {}, textContent: "", innerHTML: "", value: "", dataset: {},
    // Die Renderer laufen im Pruefstand ECHT durch -- sie duerfen dabei nicht kippen,
    // sonst faellt eine Aenderung am Rendern hier nie auf.
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
  prompt: (text) => { promptTexte.push(text); return promptAntwort; },
  getSessionToken: () => "t",
  gatewayLoad: async () => konfliktEinmal,
  gatewaySave: async (d) => {
    gespeichert.push(JSON.parse(JSON.stringify(d)));
    if (konfliktEinmal && gespeichert.length === 1) throw new ConflictError("konflikt");
  },
  fetchMe: async () => ({}),
  NotLoggedInError: class extends Error {},
  ConflictError,
  APP_VERSION: "1.0", APP_CHANGELOG: [], APP_FUNKTIONEN: [], EXTERN_BASIS: "x",
  QRCode: {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// Die echte Datei, unveraendert -- nur ein Anhang, der an die per let/const
// deklarierten Werte heranreicht. let landet nicht auf globalThis.
vm.runInContext(
  fs.readFileSync("app.js", "utf8") + `
globalThis.__setze = (d, admin) => { appData = d; currentIsAdmin = admin !== false; };
globalThis.__hole = () => appData;`,
  sandbox, { filename: "app.js" });

const F = (name) => {
  const f = sandbox[name];
  if (typeof f !== "function") { console.log("  FEHLT GANZ: Funktion " + name); fehler++; return () => {}; }
  return f;
};
const kopiereAktion = F("kopiereAktion");
const kopierNameVorschlag = F("kopierNameVorschlag");
const normalizeAppData = F("normalizeAppData");
const istAbgeschlossen = F("istAbgeschlossen");

// showAktionenError schreibt in ein Stub-Element; von dort lesen wir die Meldung.
const fehlerFeld = () => {
  for (const el of elemente.values()) {
    if (el.textContent && el.id && el.id.includes("aktion")) return el.textContent;
  }
  return "";
};

// ---------- Testdaten ----------

const startDaten = () => normalizeAppData({
  aktionen: [
    {
      id: "trainerpaket", name: "Trainerpaket", offen: false, abgeschlossen: true,
      abgeschlossenAm: "2026-09-01T10:00:00.000Z",
      hinweis: "Von jedem Teil ist jeweils 1 im Umfang enthalten.",
      artikel: [
        { id: "hoodie", name: "Hoodie", groessen: ["S", "M", "L"], standardMenge: 1, aktiv: true },
        { id: "polo", name: "Polo Shirt", groessen: ["M", "L"], standardMenge: 0, aktiv: true },
        { id: "alte-jacke", name: "Jacke", groessen: ["L"], standardMenge: 1, aktiv: false }
      ],
      bestellungen: {
        "frank.wagner": { vorname: "Frank", nachname: "Wagner", positionen: [{ artikelId: "hoodie", groesse: "L", menge: 1 }] }
      },
      ausgabe: { "frank.wagner": { hoodie: { am: "2026-09-02", von: "michel" } } },
      extern: { token: "a".repeat(64), erstelltAm: "2026-08-01", widerrufen: false }
    },
    { id: "spielerpaket-u19", name: "Spielerpaket U19", offen: true, artikel: [], bestellungen: {} }
  ]
});

const lauf = async (name, vorbereiten) => {
  promptAntwort = name;
  promptTexte = [];
  gespeichert = [];
  konfliktEinmal = null;
  const daten = startDaten();
  if (vorbereiten) vorbereiten(daten);
  sandbox.__setze(daten, true);
  await kopiereAktion("trainerpaket");
  return sandbox.__hole();
};

// ---------- 1. Namensvorschlag ----------

console.log("\n1. Namensvorschlag");
gleich("erste Kopie wird 2. Runde", kopierNameVorschlag("Trainerpaket"), "Trainerpaket (2. Runde)");
gleich("Runde wird hochgezaehlt", kopierNameVorschlag("Trainerpaket (2. Runde)"), "Trainerpaket (3. Runde)");
gleich("zweistellig geht auch", kopierNameVorschlag("Paket (9. Runde)"), "Paket (10. Runde)");
gleich("Leerzeichen im Muster stoert nicht", kopierNameVorschlag("Paket (2.Runde)"), "Paket (3. Runde)");
gleich("Randfall leerer Name", kopierNameVorschlag(""), " (2. Runde)");

// ---------- 2. Was die Kopie enthaelt ----------

console.log("\n2. Was die Kopie enthaelt");
{
  const d = await lauf("Trainerpaket (2. Runde)");
  const kopie = d.aktionen[1];
  gleich("Kopie steht direkt hinter dem Original", d.aktionen.map((a) => a.name),
    ["Trainerpaket", "Trainerpaket (2. Runde)", "Spielerpaket U19"]);
  gleich("Kopie hat eigene Id", kopie.id, "trainerpaket-2-runde");
  gleich("Kopie ist offen", kopie.offen, true);
  zusage("Kopie ist nicht abgeschlossen", istAbgeschlossen(kopie) === false);
  gleich("Kopie hat keine Bestellungen", kopie.bestellungen, {});
  zusage("Kopie hat keinen Ausgabe-Stand", kopie.ausgabe === undefined || JSON.stringify(kopie.ausgabe) === "{}");
  zusage("Kopie hat KEINEN externen Link", kopie.extern === undefined,
    "extern ist " + JSON.stringify(kopie.extern));
  zusage("Kopie hat kein abgeschlossenAm", !kopie.abgeschlossenAm);
  gleich("Hinweis wird mitgenommen", kopie.hinweis, "Von jedem Teil ist jeweils 1 im Umfang enthalten.");
  gleich("alle 3 Artikel sind da", kopie.artikel.length, 3);
  gleich("Artikelnamen stimmen", kopie.artikel.map((a) => a.name), ["Hoodie", "Polo Shirt", "Jacke"]);
  gleich("Groessen stimmen", kopie.artikel[0].groessen, ["S", "M", "L"]);
  gleich("freie Menge 0 bleibt 0", kopie.artikel[1].standardMenge, 0);
  gleich("deaktivierter Artikel bleibt deaktiviert", kopie.artikel[2].aktiv, false);
  gleich("aktiver Artikel bleibt aktiv", kopie.artikel[0].aktiv, true);
}

// ---------- 3. Artikel-Ids ----------

console.log("\n3. Artikel-Ids");
{
  const d = await lauf("Trainerpaket (2. Runde)");
  const quelle = d.aktionen[0], kopie = d.aktionen[1];
  const alle = d.aktionen.flatMap((a) => a.artikel.map((x) => x.id));
  gleich("keine Id doppelt", alle.length, new Set(alle).size);
  zusage("keine Kopie-Id gleicht einer Quell-Id",
    kopie.artikel.every((a) => !quelle.artikel.some((q) => q.id === a.id)),
    JSON.stringify(kopie.artikel.map((a) => a.id)));
  gleich("Quell-Ids unveraendert", quelle.artikel.map((a) => a.id), ["hoodie", "polo", "alte-jacke"]);
}

// Zwei gleichnamige Artikel in einer Aktion muessen zwei verschiedene neue Ids
// bekommen -- die Liste der vergebenen Ids muss also waehrend des Kopierens wachsen.
{
  const d = await lauf("Runde zwei", (daten) => {
    daten.aktionen[0].artikel = [
      { id: "hose-a", name: "Hose", groessen: ["M"], standardMenge: 1, aktiv: true },
      { id: "hose-b", name: "Hose", groessen: ["L"], standardMenge: 1, aktiv: true }
    ];
  });
  const ids = d.aktionen[1].artikel.map((a) => a.id);
  gleich("zwei gleichnamige Artikel, zwei Ids", ids.length, new Set(ids).size);
}

// Groessen duerfen sich Quelle und Kopie nicht als dasselbe Array teilen.
{
  const d = await lauf("Runde zwei");
  zusage("groessen ist eine echte Kopie",
    d.aktionen[0].artikel[0].groessen !== d.aktionen[1].artikel[0].groessen);
}

// ---------- 4. Die Quelle bleibt unberuehrt ----------

console.log("\n4. Die Quelle bleibt unberuehrt");
{
  const vorher = JSON.stringify(startDaten().aktionen[0]);
  const d = await lauf("Trainerpaket (2. Runde)");
  gleich("Quell-Aktion byte-gleich", JSON.stringify(d.aktionen[0]), vorher);
}

// ---------- 5. Kopie der Kopie ----------

console.log("\n5. Kopie der Kopie");
{
  promptAntwort = "Trainerpaket (2. Runde)";
  gespeichert = []; konfliktEinmal = null;
  sandbox.__setze(startDaten(), true);
  await kopiereAktion("trainerpaket");
  promptAntwort = "Trainerpaket (3. Runde)";
  await kopiereAktion("trainerpaket-2-runde");
  const d = sandbox.__hole();
  gleich("drei Runden nebeneinander", d.aktionen.map((a) => a.id),
    ["trainerpaket", "trainerpaket-2-runde", "trainerpaket-3-runde", "spielerpaket-u19"]);
  const alle = d.aktionen.flatMap((a) => a.artikel.map((x) => x.id));
  gleich("auch jetzt keine Artikel-Id doppelt", alle.length, new Set(alle).size);
}

// ---------- 6. Abbruch und Fehleingaben ----------

console.log("\n6. Abbruch und Fehleingaben");
{
  const d = await lauf(null); // Dialog abgebrochen
  gleich("Abbruch legt nichts an", d.aktionen.length, 2);
  gleich("Abbruch speichert nicht", gespeichert.length, 0);
}
{
  const d = await lauf("   "); // nur Leerzeichen
  gleich("leerer Name legt nichts an", d.aktionen.length, 2);
  gleich("leerer Name speichert nicht", gespeichert.length, 0);
  zusage("leerer Name meldet einen Fehler", /leer/i.test(fehlerFeld()), "Meldung: " + fehlerFeld());
}
{
  promptAntwort = "Trainerpaket (2. Runde)";
  gespeichert = []; konfliktEinmal = null;
  sandbox.__setze(startDaten(), false); // kein Bearbeiter
  await kopiereAktion("trainerpaket");
  gleich("ohne Bearbeiter-Recht passiert nichts", sandbox.__hole().aktionen.length, 2);
  gleich("ohne Bearbeiter-Recht wird nicht gespeichert", gespeichert.length, 0);
}
{
  promptAntwort = "Irgendwas";
  gespeichert = []; konfliktEinmal = null;
  sandbox.__setze(startDaten(), true);
  await kopiereAktion("gibt-es-nicht");
  gleich("unbekannte Aktion legt nichts an", sandbox.__hole().aktionen.length, 2);
}

// ---------- 7. Konflikt: die Mutation laeuft zweimal ----------
//
// saveWithConflictRetry ruft seine Mutation nach einem Konflikt ein zweites Mal
// auf -- gegen den frisch geladenen Stand. Genau da darf keine zweite Kopie und
// keine doppelte Id entstehen, und die Id muss sich am NEUEN Stand ausrichten.

console.log("\n7. Konflikt: die Mutation laeuft zweimal");
{
  // Der frische Stand hat inzwischen selbst eine Aktion "Trainerpaket (2. Runde)"
  // und einen Artikel "Hoodie" -- beide Ids sind also schon weg.
  const frisch = startDaten();
  frisch.aktionen.splice(1, 0, {
    id: "trainerpaket-2-runde", name: "Trainerpaket (2. Runde)", offen: true,
    artikel: [{ id: "hoodie-2", name: "Hoodie", groessen: ["M"], standardMenge: 1, aktiv: true }],
    bestellungen: {}
  });
  konfliktEinmal = frisch;
  promptAntwort = "Trainerpaket (2. Runde)";
  gespeichert = [];
  sandbox.__setze(startDaten(), true);
  await kopiereAktion("trainerpaket");
  const d = sandbox.__hole();
  gleich("zweimal gespeichert (Konflikt + Wiederholung)", gespeichert.length, 2);
  const namen = d.aktionen.map((a) => a.name);
  gleich("genau EINE neue Aktion dazu", namen.filter((n) => n === "Trainerpaket (2. Runde)").length, 2);
  gleich("Reihenfolge nach der Wiederholung", d.aktionen.map((a) => a.id).slice(0, 3),
    ["trainerpaket", "trainerpaket-2-runde-2", "trainerpaket-2-runde"]);
  const ids = d.aktionen.map((a) => a.id);
  gleich("keine Aktions-Id doppelt", ids.length, new Set(ids).size);
  const alle = d.aktionen.flatMap((a) => a.artikel.map((x) => x.id));
  gleich("keine Artikel-Id doppelt", alle.length, new Set(alle).size);
}

// ---------- 8. Verdrahtung ----------
//
// Die Logik kann stimmen und der Knopf trotzdem fehlen. Geprueft wird gegen das
// echte Rendern und gegen den echten Quelltext des Klick-Delegates.

console.log("\n8. Verdrahtung");
{
  sandbox.__setze(startDaten(), true);
  sandbox.renderAktionenVerwaltung();
  const html = stubEl("aktionen-rows").innerHTML;
  const treffer = (html.match(/btn-copy-aktion/g) || []).length;
  gleich("je Aktion ein Kopieren-Knopf", treffer, 2);
  zusage("der Knopf heisst Kopieren", /btn-copy-aktion[^>]*>Kopieren</.test(html), html.slice(0, 200));

  // Auch die abgeschlossene Aktion (Zeile 1) traegt ihn -- genau dort beginnt die
  // naechste Runde.
  const zeilen = html.split("aktion-row-wrap");
  zusage("auch die abgeschlossene Aktion hat ihn",
    zeilen.some((z) => z.includes("trainerpaket") && z.includes("btn-copy-aktion")));

  const quelle = fs.readFileSync("app.js", "utf8");
  zusage("der Klick-Delegate ruft kopiereAktion auf",
    /btn-copy-aktion[\s\S]{0,120}kopiereAktion\(aktionId\)/.test(quelle));
}

// ---------- Ergebnis ----------

console.log(`\n${fehler ? "FEHLER" : "OK"}: ${ok} Zusagen erfüllt, ${fehler} offen.`);
process.exit(fehler ? 1 : 0);
