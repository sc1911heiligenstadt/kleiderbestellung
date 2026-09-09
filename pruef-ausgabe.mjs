// Prüfstand für Abschluss, Kürzel, Ausgabe und Verteilliste.
//
// ⚠️ Lädt app.js im ECHTEN Wortlaut in einen vm-Kontext mit Browser-Attrappen —
// keine nachgebaute Kopie der Funktionen. Ein Test gegen eine Kopie hätte bei
// jeder Änderung an app.js weiter grün gemeldet.
//
// Aufruf: node pruef-ausgabe.mjs

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

const elemente = new Map();
const stubEl = (id) => {
  if (!elemente.has(id)) elemente.set(id, { id, style: {}, textContent: "", innerHTML: "", value: "", dataset: {} });
  return elemente.get(id);
};
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
  // Aus db.js, das app.js im Browser vorher lädt.
  getSessionToken: () => "t",
  gatewayLoad: async () => ({}),
  gatewaySave: async () => {},
  fetchMe: async () => ({}),
  NotLoggedInError: class extends Error {},
  ConflictError: class extends Error {},
  APP_VERSION: "1.0", APP_CHANGELOG: [], APP_FUNKTIONEN: [], EXTERN_BASIS: "x",
  QRCode: {}
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
// Die echte Datei, unveraendert -- nur eine Zeile angehaengt, die die per const
// deklarierten Werte sichtbar macht. const landet nicht auf globalThis, sonst
// kaeme man an EXPORT_FELDER nicht heran, ohne die Spalten hier nachzubauen.
vm.runInContext(
  fs.readFileSync("app.js", "utf8") + `
globalThis.__konstanten = { EXPORT_FELDER };`,
  sandbox, { filename: "app.js" });

const F = (name) => {
  const f = sandbox[name];
  if (typeof f !== "function") { console.log("  FEHLT GANZ: Funktion " + name); fehler++; return () => {}; }
  return f;
};
const normalizeAktion = F("normalizeAktion");
const normalizeAppData = F("normalizeAppData");
const aktionStatus = F("aktionStatus");
const istAbgeschlossen = F("istAbgeschlossen");
const kuerzel = F("kuerzel");
const initialenMap = F("initialenMap");
const ausgabeStand = F("ausgabeStand");
const ausgabeVon = F("ausgabeVon");
const istAusgegeben = F("istAusgegeben");
const personenZeilen = F("personenZeilen");

// ---------- Testdaten ----------

const bau = (extra) => normalizeAktion(Object.assign({
  id: "trainerpaket",
  name: "Trainerpaket",
  offen: true,
  artikel: [
    { id: "hoodie", name: "Hoodie", groessen: ["S", "M", "L"], standardMenge: 1, aktiv: true },
    { id: "polo", name: "Polo Shirt", groessen: ["M", "L"], standardMenge: 1, aktiv: true },
    { id: "socken", name: "Stutzen", groessen: ["36-40"], standardMenge: 0, aktiv: true }
  ],
  bestellungen: {
    "michel.brunner": { vorname: "Michel", nachname: "Brunner", positionen: [
      { artikelId: "hoodie", groesse: "L", menge: 1 },
      { artikelId: "polo", groesse: "M", menge: 1 }
    ] },
    "maria.brandt": { vorname: "Maria", nachname: "Brandt", positionen: [
      { artikelId: "hoodie", groesse: "S", menge: 1 }
    ] },
    "extern:tim.klein.2011": { quelle: "extern", vorname: "Tim", nachname: "Klein", jahrgang: "2011", positionen: [
      { artikelId: "socken", groesse: "36-40", menge: 3 }
    ] }
  }
}, extra || {}), 0);

// ---------- 1. Datenmodell ----------

console.log("\n1. Datenmodell");
{
  const a = normalizeAktion({ id: "x", name: "X" }, 0);
  gleich("abgeschlossen wird angelegt", a.abgeschlossen, false);
  gleich("abgeschlossenAm wird angelegt", a.abgeschlossenAm, "");
  gleich("ausgabe wird angelegt", a.ausgabe, {});

  // Alte Datei ohne die neuen Felder darf nicht kippen.
  const alt = normalizeAppData({ aktionen: [{ id: "a1", name: "Alt", offen: false, artikel: [], bestellungen: {} }] });
  gleich("alte Aktion bekommt abgeschlossen=false", alt.aktionen[0].abgeschlossen, false);
  gleich("alte Aktion bleibt geschlossen", alt.aktionen[0].offen, false);

  // Kaputte Werte fallen auf den sicheren Stand zurück.
  const kaputt = normalizeAktion({ id: "k", name: "K", abgeschlossen: "ja", ausgabe: 42 }, 0);
  gleich("abgeschlossen: String zaehlt nicht als true", kaputt.abgeschlossen, false);
  gleich("ausgabe: Zahl wird zu leerem Objekt", kaputt.ausgabe, {});

  // Migration aus der Ein-Topf-Struktur bleibt heil.
  const mig = normalizeAppData({ bestellfensterOffen: false, katalog: { artikel: [{ id: "h", name: "H", groessen: ["M"] }] }, bestellungen: {} });
  gleich("Migration legt genau eine Aktion an", mig.aktionen.length, 1);
  gleich("Migration setzt abgeschlossen=false", mig.aktionen[0].abgeschlossen, false);
}

// ---------- 2. Die drei Zustände ----------

console.log("\n2. Zustaende");
{
  gleich("offen -> laeuft", aktionStatus(bau()).label, "läuft");
  gleich("geschlossen -> geschlossen", aktionStatus(bau({ offen: false })).label, "geschlossen");
  gleich("geschlossen+abgeschlossen -> abgeschlossen",
    aktionStatus(bau({ offen: false, abgeschlossen: true })).label, "abgeschlossen");

  // Die Falle: abgeschlossen bei noch offener Aktion. Das darf NICHT als
  // abgeschlossen durchgehen -- sonst waere die Ausgabeliste frei, waehrend
  // weiter bestellt wird.
  const widerspruch = bau({ offen: true, abgeschlossen: true });
  gleich("offen+abgeschlossen zaehlt NICHT als abgeschlossen", istAbgeschlossen(widerspruch), false);
  gleich("offen+abgeschlossen zeigt laeuft", aktionStatus(widerspruch).label, "läuft");

  gleich("Klasse laeuft", aktionStatus(bau()).klasse, "offen");
  gleich("Klasse geschlossen", aktionStatus(bau({ offen: false })).klasse, "zu");
  gleich("Klasse abgeschlossen", aktionStatus(bau({ offen: false, abgeschlossen: true })).klasse, "fertig");
}

// ---------- 3. Kürzel ----------

console.log("\n3. Kuerzel");
{
  // Michel-Vorgabe 2026-09-09: GENAU zwei Buchstaben, ohne Punkt, ohne Trenner.
  gleich("zwei Buchstaben, keine Punkte", kuerzel("Frank", "Wagner"), "FW");
  gleich("kleingeschrieben wird gross", kuerzel("michel", "brunner"), "MB");
  gleich("Umlaut bleibt Umlaut", kuerzel("Örs", "Übel"), "ÖÜ");
  gleich("Doppelname zaehlt nur den ersten Buchstaben", kuerzel("Jan-Peter", "von Haaren"), "JV");
  gleich("Leerzeichen am Rand faellt weg", kuerzel("  Frank ", " Wagner "), "FW");
  gleich("ohne Nachname", kuerzel("Michel", ""), "M");
  gleich("ohne Vornamen", kuerzel("", "Wagner"), "W");
  gleich("ohne Namen", kuerzel("", ""), "?");
  zusage("nie ein Punkt im Kuerzel", !kuerzel("Frank", "Wagner").includes("."), "");

  const m = initialenMap(bau());
  gleich("Michel Brunner", m["michel.brunner"], "MB");
  gleich("Maria Brandt", m["maria.brandt"], "MB");
  gleich("Tim Klein", m["extern:tim.klein.2011"], "TK");
}
{
  // ⚠️ Gleiche Kuerzel sind jetzt AUSDRUECKLICH erlaubt (Michel-Vorgabe). Der Test
  // haelt das fest, damit ein spaeterer Lauf es nicht als Bug "repariert".
  const a = normalizeAktion({ id: "a", name: "A", artikel: [], bestellungen: {
    "jan.hartmann": { vorname: "Jan", nachname: "Hartmann", positionen: [] },
    "jan.huebner": { vorname: "Jan", nachname: "Hübner", positionen: [] }
  } }, 0);
  const m = initialenMap(a);
  gleich("Hartmann bleibt JH", m["jan.hartmann"], "JH");
  gleich("Huebner bleibt ebenfalls JH", m["jan.huebner"], "JH");
  gleich("Kuerzel sind stabil", initialenMap(a), m);
}
{
  // Namenlos (aelterer Datenstand ohne vorname/nachname) darf nicht werfen.
  const a = normalizeAktion({ id: "a", name: "A", artikel: [], bestellungen: {
    "irgendwer": { positionen: [] }
  } }, 0);
  const m = initialenMap(a);
  zusage("ohne Namen kommt trotzdem ein Kuerzel", typeof m["irgendwer"] === "string" && m["irgendwer"].length > 0,
    JSON.stringify(m));
}
gleich("leere Aktion: leere Kuerzel-Liste",
  initialenMap(normalizeAktion({ id: "l", name: "L", artikel: [], bestellungen: {} }, 0)), {});

// ---------- 4. Ausgabe-Zählung ----------

console.log("\n4. Ausgabe");
{
  const a = bau({ offen: false, abgeschlossen: true });
  gleich("nichts ausgegeben", ausgabeStand(a, "michel.brunner"), { ausgegeben: 0, gesamt: 2 });

  a.ausgabe["michel.brunner"] = { hoodie: { am: "2026-09-09T10:00:00.000Z", von: "admin" } };
  gleich("ein Teil ausgegeben", ausgabeStand(a, "michel.brunner"), { ausgegeben: 1, gesamt: 2 });
  gleich("Haken wird gefunden", istAusgegeben(a, "michel.brunner", "hoodie"), true);
  gleich("anderer Artikel bleibt offen", istAusgegeben(a, "michel.brunner", "polo"), false);

  // Der Kern von f-zaehlwerk: ein Haken auf einem Artikel, der NICHT mehr
  // bestellt ist, darf die Zahl nicht ueber die Zahl der Teile treiben.
  a.ausgabe["michel.brunner"]["nicht-bestellt"] = { am: "2026-09-09T10:00:00.000Z", von: "admin" };
  gleich("verwaister Haken zaehlt nicht mit", ausgabeStand(a, "michel.brunner"), { ausgegeben: 1, gesamt: 2 });

  gleich("Person ohne Haken", ausgabeStand(a, "maria.brandt"), { ausgegeben: 0, gesamt: 1 });
  gleich("unbekannte Person kippt nicht", ausgabeStand(a, "gibt.es.nicht"), { ausgegeben: 0, gesamt: 0 });
  gleich("ausgabeVon ohne Eintrag", ausgabeVon(a, "gibt.es.nicht"), {});
}

// ---------- 5. Verteilliste ----------

console.log("\n5. Verteilliste");
{
  const a = bau({ offen: false, abgeschlossen: true });
  a.ausgabe["michel.brunner"] = { hoodie: { am: "2026-09-09T10:00:00.000Z", von: "admin" } };
  const z = personenZeilen(a);

  gleich("eine Zeile je bestellter Position", z.length, 4);
  zusage("jede Zeile traegt ein Kuerzel", z.every((r) => r.kuerzel && r.kuerzel !== ""), "");
  // Geprueft wird, was WIRKLICH in den Spalten landet -- r.schluessel steht nur
  // zum Sortieren im Objekt und kommt in keiner Spalte vor.
  const spalten = sandbox.__konstanten.EXPORT_FELDER.person.map((f) => f.key);
  const sichtbar = JSON.stringify(z.map((r) => Object.fromEntries(spalten.map((k) => [k, r[k]]))));
  zusage("kein Vor- oder Nachname in den Spalten",
    !/Brunner|Michel|Klein|Brandt|Maria/i.test(sichtbar), sichtbar);
  gleich("Spalte Kuerzel ist dabei", spalten.includes("kuerzel"), true);

  const hoodieMichel = z.find((r) => r.artikelId === "hoodie" && r.groesse === "L");
  gleich("Kuerzel im Export ist zweistellig", hoodieMichel && hoodieMichel.kuerzel, "MB");
  zusage("ausgegebene Zeile traegt ein Datum",
    !!hoodieMichel && hoodieMichel.ausgegeben.startsWith("ausgegeben "), JSON.stringify(hoodieMichel));
  const poloMichel = z.find((r) => r.artikelId === "polo");
  gleich("offene Zeile traegt ein Kaestchen", poloMichel && poloMichel.ausgegeben, "[  ]");

  // Zwei Leute mit demselben Kuerzel: ihre Zeilen duerfen sich nicht mischen,
  // sonst ist auf der ausgedruckten Liste kein Beutel mehr zuzuordnen.
  const d = bau({ offen: false, abgeschlossen: true });
  d.bestellungen["michel.brandt"] = { vorname: "Michel", nachname: "Brandt", positionen: [
    { artikelId: "hoodie", groesse: "M", menge: 1 }, { artikelId: "polo", groesse: "L", menge: 1 }
  ] };
  const zd = personenZeilen(d);
  const mb = zd.filter((r) => r.kuerzel === "MB").map((r) => r.schluessel);
  gleich("drei Leute teilen sich MB", new Set(mb).size, 3);
  zusage("Zeilen einer Person stehen am Stueck",
    mb.every((k, i) => i === 0 || k === mb[i - 1] || !mb.slice(0, i).includes(k)), JSON.stringify(mb));

  const stutzen = z.find((r) => r.artikelId === "socken");
  gleich("freie Menge kommt mit", stutzen && stutzen.menge, 3);

  // Sortierung: nach Kuerzel, damit die Liste der Beutelreihenfolge folgt.
  const kuerzelFolge = z.map((r) => r.kuerzel);
  gleich("nach Kuerzel sortiert", kuerzelFolge, [...kuerzelFolge].sort((x, y) => x.localeCompare(y, "de")));

  // Menge 0 oder fehlender Artikel fallen heraus statt als Geisterzeile zu landen.
  const b = bau({ offen: false, abgeschlossen: true });
  b.bestellungen["michel.brunner"].positionen.push({ artikelId: "hoodie", groesse: "M", menge: 0 });
  gleich("Menge 0 faellt heraus", personenZeilen(b).length, 4);

  const c = bau({ offen: false, abgeschlossen: true });
  c.bestellungen["michel.brunner"].positionen.push({ artikelId: "weg", groesse: "M", menge: 1 });
  const zc = personenZeilen(c);
  gleich("geloeschter Artikel bleibt sichtbar", zc.length, 5);
  zusage("geloeschter Artikel ist benannt",
    zc.some((r) => r.artikelName.includes("gelöscht")), JSON.stringify(zc.map((r) => r.artikelName)));
}

// ---------- 6. Der externe Weg ----------

console.log("\n6. Extern");
{
  const a = bau({ offen: false, abgeschlossen: true });
  const m = initialenMap(a);
  zusage("externe Bestellung bekommt ein Kuerzel", !!m["extern:tim.klein.2011"], JSON.stringify(m));
  a.ausgabe["extern:tim.klein.2011"] = { socken: { am: "2026-09-09T10:00:00.000Z", von: "admin" } };
  gleich("externe Ausgabe zaehlt normal mit",
    ausgabeStand(a, "extern:tim.klein.2011"), { ausgegeben: 1, gesamt: 1 });
}

// ---------- Ergebnis ----------

console.log("\n" + ok + " Zusagen gruen, " + fehler + " offen.");
process.exit(fehler ? 1 : 0);
