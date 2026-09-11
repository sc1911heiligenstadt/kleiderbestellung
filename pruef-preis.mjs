// Prüfstand für den Preis je Artikel.
//
// ⚠️ Lädt app.js im ECHTEN Wortlaut in einen vm-Kontext mit Browser-Attrappen —
// keine nachgebaute Kopie. Ein Test gegen eine Kopie hätte bei jeder Änderung
// an app.js weiter grün gemeldet.
//
// Vier Dinge werden geprüft, und keines davon sieht man dem Code an:
//   1. Der Betragsparser trägt beide Tippgewohnheiten (24,90 und 24.90).
//   2. Eine 0 ist ein Betrag (kostenlos), kein fehlender Preis.
//   3. Die Gesamtzeile summiert nur, was sich summieren lässt, und sagt es,
//      wenn ein Preis fehlt.
//   4. Der Preis erscheint NUR in der Katalogpflege und in den Auswertungen —
//      nicht im Bestellformular, nicht in der Übersicht, nicht in der
//      Ausgabeliste, nicht auf der Spieler-Seite und nicht im Worker.
//
// Aufruf: node pruef-preis.mjs

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
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {}
  },
  window: { addEventListener() {}, print() {} },
  CSS: { escape: (s) => s },
  navigator: {},
  location: { href: "" },
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
const appQuelle = fs.readFileSync("app.js", "utf8");
vm.runInContext(appQuelle + `
globalThis.__konstanten = { EXPORT_FELDER, PREIS_LUECKEN_HINWEIS, PREIS_UNLESBAR };
globalThis.__setAppData = (d) => { appData = d; };
globalThis.__setExport = (inhalt, aktionId) => { exportInhalt = inhalt; exportAktionId = aktionId; };
globalThis.__download = (fn) => { download = fn; };`,
  sandbox, { filename: "app.js" });

const F = (name) => {
  const f = sandbox[name];
  if (typeof f !== "function") { console.log("  FEHLT GANZ: Funktion " + name); fehler++; return () => {}; }
  return f;
};
const normalizeAppData = F("normalizeAppData");
const parsePreisCent = F("parsePreisCent");
const artikelPreisCent = F("artikelPreisCent");
const formatEuro = F("formatEuro");
const preisFeldWert = F("preisFeldWert");
const exportZeilen = F("exportZeilen");
const personenZeilen = F("personenZeilen");
const exportSummen = F("exportSummen");
const exportZellText = F("exportZellText");
const exportText = F("exportText");
const { EXPORT_FELDER, PREIS_LUECKEN_HINWEIS, PREIS_UNLESBAR } = sandbox.__konstanten;

// ---------- 1. Der Betragsparser ----------
//
// Die naheliegende Kurzfassung "alle Punkte raus, Komma zu Punkt" verzehnfacht
// 1234.56 still zu 123.456,00. Genau diese Fälle fangen den Fehler.

console.log("\n1. Betrag einlesen");
{
  const f = [
    ["24,90", 2490], ["24.90", 2490], ["24", 2400],
    ["1234,56", 123456], ["1.234,56", 123456], ["1234.56", 123456],
    ["1.234.567,89", 123456789],
    ["1.000", 100000],          // genau drei Ziffern hinter dem Punkt = Tausender
    ["12,5", 1250], ["12.5", 1250],
    ["0,01", 1], ["0", 0], ["0,00", 0],
    ["19,99", 1999],            // Math.floor(19.99 * 100) waere 1998
    [" 24,90 ", 2490], ["24,90 €", 2490], ["€24,90", 2490],
    ["", null], ["abc", null], ["12abc", null], ["-50,00", null],
    [".", null], [",", null], [null, null], [undefined, null],
    ["999999999", null]         // Vertipper: eine Million Euro fuer ein Trikot
  ];
  for (const [ein, soll] of f) gleich("parsePreisCent(" + JSON.stringify(ein) + ")", parsePreisCent(ein), soll);

  // Gegenprobe: alle Schreibweisen einer Kontrollzahl ergeben denselben Wert.
  const wege = ["1234,56", "1.234,56", "1234.56"].map(parsePreisCent);
  zusage("alle Schreibweisen derselben Zahl sind gleich",
    wege.every((w) => w === wege[0]), JSON.stringify(wege));
}

// ---------- 2. Null ist ein Betrag ----------
//
// `if (!preis)` machte aus jedem kostenlosen Teil still ein Teil ohne
// Preisangabe. Der Unterschied muss an jeder Stelle durchgehalten werden.

console.log("\n2. Null gegen nichts");
{
  gleich("Preis 0 ist ein Betrag", artikelPreisCent({ preisCent: 0 }), 0);
  gleich("kein Feld heisst kein Preis", artikelPreisCent({}), null);
  gleich("null heisst kein Preis", artikelPreisCent({ preisCent: null }), null);
  gleich("Leerstring heisst kein Preis", artikelPreisCent({ preisCent: "" }), null);
  gleich("ein negativer Wert gilt nicht", artikelPreisCent({ preisCent: -5 }), null);
  gleich("Unlesbares gilt nicht", artikelPreisCent({ preisCent: "viel" }), null);
  gleich("kein Artikel, kein Preis", artikelPreisCent(null), null);

  gleich("0 wird als Betrag angezeigt", formatEuro(0), "0,00 €");
  gleich("ohne Preis bleibt die Anzeige leer", formatEuro(null), "");
  gleich("2490 Cent sind 24,90 €", formatEuro(2490), "24,90 €");
  gleich("Tausender bekommen einen Punkt", formatEuro(123456), "1.234,56 €");

  gleich("das Eingabefeld zeigt 24,90", preisFeldWert(2490), "24,90");
  gleich("das Eingabefeld zeigt 0,00", preisFeldWert(0), "0,00");
  gleich("ohne Preis bleibt das Feld leer", preisFeldWert(null), "");
  gleich("im Feld steht kein Tausenderpunkt", preisFeldWert(123456), "1234,56");
  // Rundweg: was im Feld steht, muss wieder denselben Betrag ergeben.
  for (const cent of [0, 1, 999, 2490, 123456, 99999999]) {
    gleich("Feld-Rundweg " + cent, parsePreisCent(preisFeldWert(cent)), cent);
  }
}

// ---------- Testdaten ----------

const daten = normalizeAppData({
  aktionen: [
    {
      id: "a1", name: "Trainerpaket", offen: false, abgeschlossen: true,
      artikel: [
        { id: "hoodie", name: "Hoodie", groessen: ["M", "L"], standardMenge: 1, preisCent: 2490, aktiv: true },
        { id: "polo", name: "Polo", groessen: ["M"], standardMenge: 1, preisCent: 1950, aktiv: true },
        // Kostenlos -- muss als Betrag durchgehen, nicht als fehlender Preis.
        { id: "schal", name: "Schal", groessen: ["one size"], standardMenge: 1, preisCent: 0, aktiv: true }
      ],
      bestellungen: {
        "frank.wagner": { vorname: "Frank", nachname: "Wagner", positionen: [
          { artikelId: "hoodie", groesse: "L", menge: 3 },
          { artikelId: "polo", groesse: "M", menge: 2 },
          { artikelId: "schal", groesse: "one size", menge: 1 }
        ] },
        "jana.huebner": { vorname: "Jana", nachname: "Hübner", positionen: [
          { artikelId: "hoodie", groesse: "L", menge: 1 }
        ] }
      }
    },
    {
      // Ein Artikel MIT, einer OHNE Preis -- die Geldsumme ist unvollstaendig.
      id: "a2", name: "Spielerpaket", offen: true,
      artikel: [
        { id: "stutzen", name: "Stutzen", groessen: ["36-40"], standardMenge: 1, preisCent: 750, aktiv: true },
        { id: "tasche", name: "Tasche", groessen: ["one size"], standardMenge: 1, aktiv: true }
      ],
      bestellungen: {
        "extern:tim.klein.2011": { quelle: "extern", vorname: "Tim", nachname: "Klein", jahrgang: "2011",
          positionen: [
            { artikelId: "stutzen", groesse: "36-40", menge: 2 },
            { artikelId: "tasche", groesse: "one size", menge: 1 }
          ] }
      }
    }
  ]
});
sandbox.__setAppData(daten);
const a1 = daten.aktionen[0];
const a2 = daten.aktionen[1];

// ---------- 3. Der Preis steht in den Zeilen der Auswertung ----------

console.log("\n3. Zeilen der Auswertung");
{
  const z = exportZeilen(a1);
  const hoodie = z.find((r) => r.artikelId === "hoodie");
  gleich("Hoodie: vier Stueck zusammengezaehlt", hoodie.summe, 4);
  gleich("Hoodie: Einzelpreis in Cent", hoodie.preisCent, 2490);
  gleich("Hoodie: Gesamtpreis ist Menge mal Einzelpreis", hoodie.gesamtCent, 9960);

  const schal = z.find((r) => r.artikelId === "schal");
  gleich("Schal: Einzelpreis 0 bleibt 0", schal.preisCent, 0);
  gleich("Schal: Gesamtpreis 0 bleibt 0, nicht null", schal.gesamtCent, 0);

  const ohne = exportZeilen(a2).find((r) => r.artikelId === "tasche");
  gleich("ohne Preis bleibt der Einzelpreis null", ohne.preisCent, null);
  gleich("ohne Preis gibt es keinen Gesamtpreis", ohne.gesamtCent, null);

  const p = personenZeilen(a1);
  const fwHoodie = p.find((r) => r.kuerzel === "FW" && r.artikelId === "hoodie");
  gleich("Verteilliste: Einzelpreis steht drin", fwHoodie.preisCent, 2490);
  gleich("Verteilliste: Gesamtpreis rechnet mit der Menge dieser Person", fwHoodie.gesamtCent, 7470);
  const jhHoodie = p.find((r) => r.kuerzel === "JH" && r.artikelId === "hoodie");
  gleich("Verteilliste: die zweite Person bekommt ihre eigene Summe", jhHoodie.gesamtCent, 2490);

  // Die Preisspalten sind CENT, nicht fertiger Text -- sonst koennte Excel
  // nicht damit rechnen.
  zusage("Geldspalten fuehren Zahlen, keinen Text",
    typeof hoodie.preisCent === "number" && typeof hoodie.gesamtCent === "number");
  const feldEinzel = EXPORT_FELDER.artikel.find((f) => f.key === "preisCent");
  gleich("erst die Anzeige macht Text daraus", exportZellText(feldEinzel, hoodie), "24,90 €");
  gleich("ohne Preis bleibt die Zelle leer", exportZellText(feldEinzel, ohne), "");
}

// ---------- 4. Die Gesamtzeile ----------

console.log("\n4. Gesamtzeile");
{
  const felder = EXPORT_FELDER.artikel;
  const summen = exportSummen(felder, exportZeilen(a1));
  const i = (key) => felder.findIndex((f) => f.key === key);

  gleich("Mengen werden gezaehlt", summen.werte[i("summe")], 7);
  // 4x2490 + 2x1950 + 1x0
  gleich("Geld wird in Cent gerechnet", summen.werte[i("gesamtCent")], 13860);
  gleich("und deutsch angezeigt", summen.zellen[i("gesamtCent")], "138,60 €");
  zusage("vollstaendige Preise ergeben keine Luecke", summen.luecken === false);

  // Einzelpreise zu summieren ergaebe eine Zahl, die nichts bedeutet -- sie
  // saehe aber wie eine Summe aus.
  gleich("Einzelpreise werden NICHT summiert", summen.werte[i("preisCent")], null);
  gleich("die Einzelpreis-Zelle bleibt leer", summen.zellen[i("preisCent")], "");
  gleich("die erste Spalte ist beschriftet", summen.zellen[0], "Gesamt");

  const luecke = exportSummen(felder, exportZeilen(a2));
  gleich("ein fehlender Preis faellt aus der Summe", luecke.werte[i("gesamtCent")], 1500);
  zusage("und wird gemeldet", luecke.luecken === true,
    "eine halbe Summe darf nicht wie eine ganze dastehen");
  zusage("der Hinweis nennt den Grund", /kein Preis hinterlegt/.test(PREIS_LUECKEN_HINWEIS), PREIS_LUECKEN_HINWEIS);

  // Auch die Verteilliste summiert Geld.
  const pFelder = EXPORT_FELDER.person;
  const pSummen = exportSummen(pFelder, personenZeilen(a1));
  gleich("Verteilliste: Geldsumme stimmt mit der Zusammenfassung ueberein",
    pSummen.werte[pFelder.findIndex((f) => f.key === "gesamtCent")], 13860);
}

// ---------- 5. Der Text-Export ----------

console.log("\n5. Text-Export");
{
  let inhalt = "";
  sandbox.__download((name, mime, text) => { inhalt = String(text); });
  sandbox.__setExport("artikel", "");
  exportText();

  zusage("die Kopfzeile nennt beide Preisspalten",
    inhalt.includes("Einzelpreis") && inhalt.includes("Gesamtpreis"), inhalt.slice(0, 400));
  zusage("ein Einzelpreis steht drin", inhalt.includes("24,90 €"));
  zusage("die Geldsumme des Trainerpakets steht drin", inhalt.includes("138,60 €"));
  zusage("die Gesamtzeile ist beschriftet", /\nGesamt\s/.test(inhalt), "");
  zusage("der Luecken-Hinweis steht beim Spielerpaket", inhalt.includes(PREIS_LUECKEN_HINWEIS));
  zusage("kostenlos steht als 0,00 € da", inhalt.includes("0,00 €"));

  // Die Spalten muessen ausgerichtet bleiben: die Breite richtet sich nach dem
  // ANGEZEIGTEN Betrag, nicht nach der Cent-Zahl.
  const zeilen = inhalt.split("\n").filter((z) => z.includes("€"));
  const breiten = new Set(zeilen.map((z) => z.length));
  zusage("alle Geldzeilen sind gleich breit", breiten.size <= 2,
    JSON.stringify([...breiten]));

  sandbox.__setExport("person", "");
  exportText();
  zusage("auch die Verteilliste traegt die Preise",
    inhalt.includes("Einzelpreis") && inhalt.includes("24,90 €"));
  zusage("und weiterhin keinen Klarnamen", !inhalt.includes("Wagner"));
}

// ---------- 6. Der Preis bleibt, wo er hingehoert ----------
//
// Michel-Vorgabe: sichtbar NUR in der Katalogpflege und in den Auswertungen.
// Geprueft wird am echten Funktionskoerper, nicht an einer Behauptung.

console.log("\n6. Nirgends sonst sichtbar");

function funktionsKoerper(quelle, name) {
  const start = quelle.indexOf("function " + name + "(");
  if (start < 0) return null;
  const auf = quelle.indexOf("{", start);
  if (auf < 0) return null;
  let tiefe = 0;
  for (let i = auf; i < quelle.length; i++) {
    const c = quelle[i];
    if (c === "{") tiefe++;
    else if (c === "}") { tiefe--; if (tiefe === 0) return quelle.slice(start, i + 1); }
  }
  return null;
}

{
  // Erst die Gegenprobe, dass die Klammerzaehlung ueberhaupt greift: in der
  // Katalogpflege MUSS der Preis vorkommen. Ohne diese Probe waere ein
  // kaputter Extraktor ein Test, der alles gruen meldet.
  const katalog = funktionsKoerper(appQuelle, "renderKatalogVerwaltung");
  zusage("der Extraktor findet die Katalogpflege", !!katalog);
  zusage("die Katalogpflege zeigt den Preis (Gegenprobe)",
    !!katalog && katalog.includes("katalog-preis") && katalog.includes("preisFeldWert"),
    "ohne diesen Treffer prueft der Rest nichts");

  for (const name of ["renderBestellAktionCard", "renderBestellungsuebersicht", "renderAusgabe"]) {
    const koerper = funktionsKoerper(appQuelle, name);
    zusage("der Extraktor findet " + name, !!koerper);
    zusage(name + " zeigt keinen Preis",
      !!koerper && !/preis|Preis|Euro|€/.test(koerper),
      (koerper || "").split("\n").filter((z) => /preis|Preis|Euro|€/.test(z)).join(" | "));
  }

  // Die Spieler-Seite kennt den Preis gar nicht -- und der Worker liefert ihn
  // nicht aus. Beides einzeln geprueft, eines allein reicht nicht.
  const extern = fs.readFileSync("extern.js", "utf8");
  zusage("die Spieler-Seite kennt keinen Preis", !/preisCent|Preis|€/.test(extern),
    extern.split("\n").filter((z) => /preisCent|Preis|€/.test(z)).slice(0, 3).join(" | "));

  const workerPfad = "../ToolsUebersicht/admin-worker.js";
  if (fs.existsSync(workerPfad)) {
    const worker = fs.readFileSync(workerPfad, "utf8");
    const start = funktionsKoerper(worker, "handleKbExternStart");
    const zusatz = funktionsKoerper(worker, "kbExternZusatzArtikel");
    zusage("der Extraktor findet handleKbExternStart", !!start);
    zusage("der Worker liefert dem Link keinen Preis aus",
      !!start && !/preis/i.test(start), "handleKbExternStart nennt einen Preis");
    zusage("auch die Nachzuegler-Artikel tragen keinen Preis",
      !!zusatz && !/preis/i.test(zusatz), "kbExternZusatzArtikel nennt einen Preis");
  } else {
    console.log("  UEBERSPRUNGEN: " + workerPfad + " liegt hier nicht (Worker-Pruefung entfaellt)");
  }
}

// ---------- 7. Verdrahtung ----------

console.log("\n7. Verdrahtung");
{
  const html = fs.readFileSync("index.html", "utf8");
  zusage("das Feld fuer neue Artikel steht im HTML", html.includes('id="na-preis"'));
  zusage("es hat eine sichtbare Beschriftung", html.includes('<label for="na-preis"'));
  zusage("addArtikel liest es aus", appQuelle.includes('getElementById("na-preis")'));
  zusage("und leert es nach dem Anlegen",
    appQuelle.includes('document.getElementById("na-preis").value = "";'));
  zusage("die Katalogzeile liest ihr eigenes Feld aus",
    appQuelle.includes('row.querySelector(".katalog-preis")'));
  zusage("ein unlesbarer Preis wird gemeldet, nicht verschluckt",
    (appQuelle.match(/showKatalogError\(PREIS_UNLESBAR\)/g) || []).length === 2,
    "beide Wege (neu anlegen und aendern) brauchen die Meldung");
  zusage("die Meldung sagt, welche Schreibweisen gehen",
    /24,90/.test(PREIS_UNLESBAR) && /24\.90/.test(PREIS_UNLESBAR), PREIS_UNLESBAR);
  zusage("das Feld hat eine Beschriftung fuer Vorleseprogramme",
    appQuelle.includes('class="katalog-preis"') && /katalog-preis[^>]*aria-label=/.test(appQuelle));
  zusage("die Kopie einer Aktion nimmt den Preis mit",
    appQuelle.includes("preisCent: artikelPreisCent(art)"));
  const css = fs.readFileSync("style.css", "utf8");
  zusage("das Feld hat eine eigene Breite", css.includes(".katalog-preis"));
  zusage("style.css ist in BEIDEN HTML-Dateien frisch gebustet",
    (fs.readFileSync("index.html", "utf8").match(/style\.css\?v=([\d.]+)/) || [])[1] ===
    (fs.readFileSync("extern.html", "utf8").match(/style\.css\?v=([\d.]+)/) || [])[1],
    "index.html und extern.html ziehen verschiedene Fassungen");
}

console.log("\n" + (fehler === 0 ? "ALLES GRUEN" : "ROT") + ": " + ok + " Zusagen erfuellt, " + fehler + " offen.");
process.exit(fehler === 0 ? 0 : 1);
