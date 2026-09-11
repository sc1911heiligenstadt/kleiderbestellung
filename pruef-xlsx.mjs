// Prüfstand für den Excel-Export (.xlsx).
//
// ⚠️ Lädt app.js im ECHTEN Wortlaut in einen vm-Kontext mit Browser-Attrappen —
// keine nachgebaute Kopie der Funktionen. Ein Test gegen eine Kopie hätte bei
// jeder Änderung an app.js weiter grün gemeldet.
//
// Zwei Stufen, weil eine .xlsx wohlgeformt aussehen und trotzdem beim Öffnen
// scheitern kann:
//   1. Die XML-Teile aus _xlsxTeile() direkt prüfen (läuft überall).
//   2. Rückweg: die Teile zu einer echten .xlsx zippen und mit Python/openpyxl
//      Zelle für Zelle zurücklesen. Fehlt Python oder openpyxl, wird diese
//      Stufe übersprungen und gemeldet — sie fällt nicht rot aus.
// Das ECHTE Zippen im Browser macht JSZip; hier ersetzt .NET es, weil es um
// den Inhalt der Teile geht und nicht um den ZIP-Container.
//
// Aufruf: node pruef-xlsx.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

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
// Die echte Datei, unveraendert -- nur ein Anhang, der die per let/const
// deklarierten Werte erreichbar macht. Die landen nicht auf globalThis.
vm.runInContext(
  fs.readFileSync("app.js", "utf8") + `
globalThis.__konstanten = { EXPORT_FELDER, XLSX_MIME, JSZIP_URL, PREIS_LUECKEN_HINWEIS };
globalThis.__setAppData = (d) => { appData = d; };
globalThis.__setExport = (inhalt, aktionId) => { exportInhalt = inhalt; exportAktionId = aktionId; };`,
  sandbox, { filename: "app.js" });

const F = (name) => {
  const f = sandbox[name];
  if (typeof f !== "function") { console.log("  FEHLT GANZ: Funktion " + name); fehler++; return () => {}; }
  return f;
};
const normalizeAppData = F("normalizeAppData");
const xlsxBlattname = F("xlsxBlattname");
const _xlsxText = F("_xlsxText");
const _xmlEsc = F("_xmlEsc");
const _xlsxSpaltenName = F("_xlsxSpaltenName");
const _xlsxTeile = F("_xlsxTeile");
const exportBloecke = F("exportBloecke");
const exportSummen = F("exportSummen");
const { EXPORT_FELDER, XLSX_MIME, JSZIP_URL, PREIS_LUECKEN_HINWEIS } = sandbox.__konstanten;

// ---------- Testdaten ----------
//
// Die Namen der Aktionen sind absichtlich unbequem: verbotene Zeichen, zu lang,
// doppelt, XML-Sonderzeichen und ein Steuerzeichen. Genau daran zerbricht eine
// Mappe, ohne dass man es der Datei ansieht.

const daten = normalizeAppData({
  aktionen: [
    {
      id: "a1", name: "Trainerpaket 2026", offen: false, abgeschlossen: true,
      artikel: [
        { id: "hoodie", name: "Hoodie \"Team\" & Co", groessen: ["S", "M", "L"], standardMenge: 1, preisCent: 2490, aktiv: true },
        { id: "polo", name: "Polo <Shirt>", groessen: ["M", "L"], standardMenge: 1, preisCent: 1950, aktiv: true }
      ],
      bestellungen: {
        "frank.wagner": { vorname: "Frank", nachname: "Wagner", positionen: [
          { artikelId: "hoodie", groesse: "L", menge: 1 },
          { artikelId: "polo", groesse: "M", menge: 2 }
        ] },
        "jana.huebner": { vorname: "Jana", nachname: "Hübner", positionen: [
          { artikelId: "hoodie", groesse: "L", menge: 3 }
        ] },
        "jens.hartmann": { vorname: "Jens", nachname: "Hartmann", positionen: [
          { artikelId: "polo", groesse: "L", menge: 1 }
        ] }
      },
      ausgabe: { "frank.wagner": { hoodie: { am: "2026-09-01T10:00:00.000Z", von: "admin" } } }
    },
    {
      // Verbotene Zeichen im Blattnamen + ein Steuerzeichen mittendrin.
      id: "a2", name: "Spieler/Eltern [Herbst]\u0007", offen: true,
      // OHNE Preis: dieses Blatt muss die Luecken-Zeile bekommen.
      artikel: [{ id: "stutzen", name: "Stutzen", groessen: ["36-40"], standardMenge: 0, aktiv: true }],
      bestellungen: {
        "extern:tim.klein.2011": { quelle: "extern", vorname: "Tim", nachname: "Klein", jahrgang: "2011",
          positionen: [{ artikelId: "stutzen", groesse: "36-40", menge: 4 }] }
      }
    },
    {
      // Gleicher Name wie a1 -- Excel verlangt eindeutige Blattnamen.
      id: "a3", name: "Trainerpaket 2026", offen: true,
      artikel: [{ id: "jacke", name: "Jacke", groessen: ["M"], standardMenge: 1, preisCent: 4999, aktiv: true }],
      bestellungen: {
        "maria.brandt": { vorname: "Maria", nachname: "Brandt",
          positionen: [{ artikelId: "jacke", groesse: "M", menge: 1 }] }
      }
    },
    {
      // Weit über 31 Zeichen.
      id: "a4", name: "Funktionaerspaket Winterausstattung 2026/2027", offen: true,
      // Preis 0 = kostenlos. Muss als echter Betrag durchgehen, nicht als "kein Preis".
      artikel: [{ id: "muetze", name: "Mütze", groessen: ["one size"], standardMenge: 2, preisCent: 0, aktiv: true }],
      bestellungen: {
        "peter.klein": { vorname: "Peter", nachname: "Klein",
          positionen: [{ artikelId: "muetze", groesse: "one size", menge: 2 }] }
      }
    },
    {
      // Ohne Bestellungen -- fliegt in exportBloecke() heraus und darf kein
      // leeres Blatt erzeugen.
      id: "a5", name: "Leer", offen: true,
      artikel: [{ id: "schal", name: "Schal", groessen: ["M"], standardMenge: 1, aktiv: true }],
      bestellungen: {}
    }
  ]
});
sandbox.__setAppData(daten);

const teileFuer = (inhalt, aktionId) => {
  sandbox.__setExport(inhalt, aktionId || "");
  const bloecke = exportBloecke();
  const fields = EXPORT_FELDER[inhalt === "person" ? "person" : "artikel"];
  const mengeKey = inhalt === "person" ? "menge" : "summe";
  return { bloecke, fields, mengeKey, teile: _xlsxTeile(bloecke, fields) };
};

// ---------- 1. Blattnamen ----------

console.log("\n1. Blattnamen");
{
  const v = new Set();
  gleich("verbotene Zeichen fallen weg", xlsxBlattname("Spieler/Eltern [Herbst]", v), "Spieler Eltern Herbst");
  gleich("gleicher Name wird durchnummeriert", xlsxBlattname("Spieler Eltern Herbst", v), "Spieler Eltern Herbst (2)");
  gleich("und noch einmal", xlsxBlattname("spieler eltern herbst", v), "spieler eltern herbst (3)");
  const v2 = new Set();
  const lang = xlsxBlattname("Funktionaerspaket Winterausstattung 2026 2027", v2);
  zusage("zu langer Name wird auf 31 gekuerzt", lang.length <= 31, "ist " + lang.length + " (" + lang + ")");
  const v3 = new Set();
  gleich("leerer Name bekommt einen Ersatz", xlsxBlattname("   ", v3), "Bestellaktion");
  gleich("nur verbotene Zeichen ergeben auch einen Ersatz", xlsxBlattname("[]/\\?*:", v3), "Bestellaktion (2)");
  const v4 = new Set();
  gleich("Apostroph am Rand faellt weg", xlsxBlattname("'Sommer'", v4), "Sommer");
  const v5 = new Set();
  const gekuerztDoppelt = [
    xlsxBlattname("Funktionaerspaket Winterausstattung 2026", v5),
    xlsxBlattname("Funktionaerspaket Winterausstattung 2027", v5)
  ];
  zusage("zwei lang gleiche Namen bleiben verschieden und kurz genug",
    gekuerztDoppelt[0] !== gekuerztDoppelt[1] && gekuerztDoppelt.every((n) => n.length <= 31),
    JSON.stringify(gekuerztDoppelt));
  const v6 = new Set();
  gleich("Steuerzeichen fliegt aus dem Blattnamen", xlsxBlattname("Herbst\u0007paket", v6), "Herbstpaket");
}

// ---------- 2. Escaping und Zahlen ----------

console.log("\n2. Escaping und Zahlen");
{
  gleich("Steuerzeichen wird gefiltert", _xlsxText("a\u0000b\u0007c"), "abc");
  gleich("Zeilenumbruch und Tab bleiben", _xlsxText("a\nb\tc"), "a\nb\tc");
  gleich("XML-Sonderzeichen werden ersetzt", _xmlEsc("a&b<c>d\"e'f"), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
  // Der Grund fuer den eigenen Escaper: escapeHtml() macht aus der 0 nichts.
  gleich("die Zahl 0 ueberlebt _xmlEsc", _xmlEsc(0), "0");
  gleich("null wird zu leer", _xmlEsc(null), "");
  gleich("Spalte 0 ist A", _xlsxSpaltenName(0), "A");
  gleich("Spalte 25 ist Z", _xlsxSpaltenName(25), "Z");
  gleich("Spalte 26 ist AA", _xlsxSpaltenName(26), "AA");
}

// ---------- 3. Aufbau der Mappe ----------

console.log("\n3. Aufbau der Mappe");
{
  const { bloecke, teile } = teileFuer("artikel", "");
  gleich("leere Aktion liefert kein Blatt", bloecke.length, 4);

  const pflicht = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
    "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/sharedStrings.xml"];
  for (const p of pflicht) zusage("Teil vorhanden: " + p, typeof teile[p] === "string");

  const blattTeile = Object.keys(teile).filter((p) => p.startsWith("xl/worksheets/"));
  gleich("ein Blatt je Bestellaktion mit Bestellungen", blattTeile.length, bloecke.length);

  // Jeder Teil muss in [Content_Types].xml UND in den .rels stehen -- fehlt er
  // an einer der beiden Stellen, oeffnet Excel die Mappe nicht.
  for (const p of blattTeile) {
    zusage("in [Content_Types].xml: " + p, teile["[Content_Types].xml"].includes('PartName="/' + p + '"'));
    zusage("in workbook.xml.rels: " + p,
      teile["xl/_rels/workbook.xml.rels"].includes('Target="' + p.replace("xl/", "") + '"'));
  }
  zusage("styles in den rels", teile["xl/_rels/workbook.xml.rels"].includes('Target="styles.xml"'));
  zusage("sharedStrings in den rels", teile["xl/_rels/workbook.xml.rels"].includes('Target="sharedStrings.xml"'));

  const ids = [...teile["xl/_rels/workbook.xml.rels"].matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]);
  gleich("keine doppelte Relationship-Id", ids.length, new Set(ids).size);
  const sheetIds = [...teile["xl/workbook.xml"].matchAll(/r:id="(rId\d+)"/g)].map((m) => m[1]);
  zusage("jedes Blatt zeigt auf eine vorhandene Relationship", sheetIds.every((id) => ids.includes(id)),
    JSON.stringify({ sheetIds, ids }));
  gleich("workbook.xml nennt so viele Blaetter wie es gibt", sheetIds.length, blattTeile.length);

  const namen = [...teile["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)].map((m) => m[1]);
  gleich("Blattnamen sind eindeutig", namen.length, new Set(namen.map((n) => n.toLowerCase())).size);
  zusage("kein Blattname ueber 31 Zeichen", namen.every((n) => n.length <= 31), JSON.stringify(namen));
  zusage("kein verbotenes Zeichen im Blattnamen", namen.every((n) => !/[:\\/?*\[\]]/.test(n)), JSON.stringify(namen));

  // styles.xml: die zwei fills erwartet Excel, auch wenn keiner benutzt wird.
  gleich("styles.xml hat zwei fills", (teile["xl/styles.xml"].match(/<fill>/g) || []).length, 2);
  zusage("styles.xml kennt einen fetten Font", teile["xl/styles.xml"].includes("<b/>"));

  // Kein Steuerzeichen in irgendeinem Teil.
  for (const [pfad, xml] of Object.entries(teile)) {
    zusage("ohne Steuerzeichen: " + pfad, !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(xml));
  }

  // Grob auf Wohlgeformtheit: jedes oeffnende Tag wird geschlossen.
  for (const [pfad, xml] of Object.entries(teile)) {
    const stapel = [];
    let heil = true;
    for (const m of xml.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>/g)) {
      const [, schliessend, tag, rest, selbst] = m;
      if (rest.startsWith("?") || tag === "xml") continue;
      if (schliessend) { if (stapel.pop() !== tag) { heil = false; break; } }
      else if (!selbst) stapel.push(tag);
    }
    zusage("Tags gehen auf und zu: " + pfad, heil && stapel.length === 0, JSON.stringify(stapel.slice(0, 3)));
  }
}

// ---------- 4. Zellen ----------

console.log("\n4. Zellen");
{
  const { bloecke, fields, mengeKey, teile } = teileFuer("artikel", "");
  const blatt1 = teile["xl/worksheets/sheet1.xml"];

  zusage("Kopfzeile ist fett", /<row r="1"[^>]*><c r="A1" s="1" t="s">/.test(blatt1), blatt1.slice(0, 400));
  zusage("Kopfzeile bleibt beim Scrollen stehen", blatt1.includes('state="frozen"'));
  zusage("ueber den Spalten sitzt ein Filter", /<autoFilter ref="A1:[A-Z]+\d+"\/>/.test(blatt1));
  zusage("der Filter laesst die Gesamtzeile draussen",
    blatt1.includes(`<autoFilter ref="A1:${_xlsxSpaltenName(fields.length - 1)}${bloecke[0].zeilen.length + 1}"/>`),
    (blatt1.match(/<autoFilter[^>]*>/) || [""])[0]);
  zusage("Spaltenbreiten sind gesetzt", blatt1.includes("<col min=\"1\""));

  // Die Menge muss eine ZAHL sein. Als Text (t="s") koennte in Excel niemand
  // damit rechnen -- und genau dafuer holt man sich eine Tabelle.
  const mengenSpalte = _xlsxSpaltenName(fields.findIndex((f) => f.key === mengeKey));
  const mengenZellen = [...blatt1.matchAll(new RegExp(`<c r="${mengenSpalte}(\\d+)"([^>]*)><v>([^<]*)</v>`, "g"))];
  zusage("jede Mengenzelle ist eine Zahl", mengenZellen.length > 1 &&
    mengenZellen.every((m) => m[1] === "1" || !m[2].includes('t="s"')),
    JSON.stringify(mengenZellen.map((m) => m.slice(1, 4))));

  const zeilen = bloecke[0].zeilen;
  const summe = zeilen.reduce((a, z) => a + z[mengeKey], 0);
  const letzteZeile = zeilen.length + 2;
  zusage("die Gesamtzeile steht unten und ist fett",
    blatt1.includes(`<c r="${mengenSpalte}${letzteZeile}" s="1"><v>${summe}</v></c>`),
    "erwartet Summe " + summe + " in Zeile " + letzteZeile);
  zusage("die Gesamtzeile ist beschriftet",
    new RegExp(`<c r="A${letzteZeile}" s="1" t="s">`).test(blatt1));

  gleich("dimension deckt alle Zeilen ab",
    (blatt1.match(/<dimension ref="A1:([A-Z]+)(\d+)"/) || [])[2], String(letzteZeile));

  // sharedStrings: count = alle Textzellen, uniqueCount = die Tabelle.
  const sst = teile["xl/sharedStrings.xml"];
  const anzahlSi = (sst.match(/<si>/g) || []).length;
  const uniqueCount = Number((sst.match(/uniqueCount="(\d+)"/) || [])[1]);
  const count = Number((sst.match(/count="(\d+)"/) || [])[1]);
  gleich("uniqueCount passt zu den Eintraegen", uniqueCount, anzahlSi);
  const textZellenGezaehlt = Object.keys(teile).filter((p) => p.startsWith("xl/worksheets/"))
    .reduce((a, p) => a + (teile[p].match(/t="s"/g) || []).length, 0);
  gleich("count passt zu den Textzellen", count, textZellenGezaehlt);
  const verweise = Object.keys(teile).filter((p) => p.startsWith("xl/worksheets/"))
    .flatMap((p) => [...teile[p].matchAll(/t="s"><v>(\d+)<\/v>/g)].map((m) => Number(m[1])));
  zusage("kein Verweis zeigt an der Tabelle vorbei", verweise.every((i) => i < anzahlSi),
    "max " + Math.max(...verweise) + " bei " + anzahlSi + " Eintraegen");

  zusage("XML-Sonderzeichen im Artikelnamen sind escaped", sst.includes("Polo &lt;Shirt&gt;"), "");
  zusage("das Und-Zeichen ist escaped", sst.includes("&amp; Co"), "");
}

// ---------- 5. Beide Inhalte ----------

console.log("\n5. Beide Inhalte");
{
  const artikel = teileFuer("artikel", "");
  const person = teileFuer("person", "");
  gleich("Zusammenfassung hat fuenf Spalten", artikel.fields.length, 5);
  gleich("Verteilliste hat sieben Spalten", person.fields.length, 7);
  zusage("die Verteilliste traegt Kuerzel statt Namen",
    teileFuer("person", "").teile["xl/sharedStrings.xml"].includes("<t xml:space=\"preserve\">FW</t>"));
  zusage("kein Klarname in der Verteilliste",
    !person.teile["xl/sharedStrings.xml"].includes("Wagner"),
    "sharedStrings enthaelt einen Nachnamen");
  zusage("zwei gleiche Kuerzel bleiben gleich (Michel-Vorgabe)",
    (person.teile["xl/sharedStrings.xml"].match(/>JH</g) || []).length === 1,
    "JH darf genau einmal in der Tabelle stehen und fuer beide gelten");

  // Eine einzelne Aktion -> genau ein Blatt.
  const eine = teileFuer("artikel", "a2");
  gleich("eine gewaehlte Aktion ergibt ein Blatt",
    Object.keys(eine.teile).filter((p) => p.startsWith("xl/worksheets/")).length, 1);
  zusage("und traegt deren bereinigten Namen",
    eine.teile["xl/workbook.xml"].includes('name="Spieler Eltern Herbst"'),
    eine.teile["xl/workbook.xml"]);
}

// ---------- 5b. Geldspalten ----------

console.log("\n5b. Geldspalten");
{
  const { bloecke, fields, teile } = teileFuer("artikel", "");
  const blatt1 = teile["xl/worksheets/sheet1.xml"];   // Trainerpaket, ueberall Preise
  const spalte = (key) => _xlsxSpaltenName(fields.findIndex((f) => f.key === key));

  // Der Preis muss als Zahl in der Zelle stehen, nicht als Text mit Euro-Zeichen.
  const einzel = spalte("preisCent");
  const preisZellen = [...blatt1.matchAll(new RegExp(`<c r="${einzel}(\\d+)"([^>]*)><v>([^<]*)</v>`, "g"))]
    .filter((m) => m[1] !== "1");
  zusage("Einzelpreise sind Zahlen, kein Text",
    preisZellen.length > 0 && preisZellen.every((m) => !m[2].includes('t="s"')),
    JSON.stringify(preisZellen.map((m) => m.slice(1, 4))));
  zusage("Einzelpreise stehen in Euro, nicht in Cent",
    preisZellen.some((m) => m[3] === "24.9"),
    JSON.stringify(preisZellen.map((m) => m[3])));
  zusage("Geldzellen tragen das Waehrungsformat",
    preisZellen.every((m) => / s="2"/.test(m[2])),
    JSON.stringify(preisZellen.map((m) => m[2])));
  zusage("kein Euro-Zeichen im Zellentext",
    !teile["xl/sharedStrings.xml"].includes("€"),
    "das Euro-Zeichen gehoert ins Zahlenformat, nicht in die Zelle");

  // Einzelpreise duerfen NICHT summiert werden -- das ergaebe eine Zahl ohne
  // Bedeutung, die wie eine Summe aussieht.
  const zeilen = bloecke[0].zeilen;
  const summenZeile = zeilen.length + 2;
  zusage("die Einzelpreis-Spalte bleibt in der Gesamtzeile leer",
    !new RegExp(`<c r="${einzel}${summenZeile}"`).test(blatt1), blatt1.slice(-600));
  const gesamtSpalte = spalte("gesamtCent");
  const sollSumme = zeilen.reduce((a, z) => a + z.gesamtCent, 0) / 100;
  zusage("die Gesamtpreis-Summe steht fett und mit Waehrungsformat unten",
    blatt1.includes(`<c r="${gesamtSpalte}${summenZeile}" s="3"><v>${sollSumme}</v></c>`),
    "erwartet " + sollSumme + " in " + gesamtSpalte + summenZeile);

  // styles.xml: eigenes Zahlenformat, richtige Reihenfolge, Id ab 164.
  const styles = teile["xl/styles.xml"];
  zusage("es gibt ein eigenes Euro-Zahlenformat", styles.includes('numFmtId="164"'));
  zusage("numFmts steht vor fonts", styles.indexOf("<numFmts") < styles.indexOf("<fonts"));
  zusage("cellXfs zaehlt seine vier Eintraege richtig",
    styles.includes('<cellXfs count="4">') && (styles.match(/<xf /g) || []).length === 5,
    (styles.match(/<cellXfs count="\d+">/) || [""])[0]);

  // Ein Artikel OHNE Preis: leere Zelle statt 0,00 Euro, dazu der Hinweis.
  const ohne = teileFuer("artikel", "a2");
  const blattOhne = ohne.teile["xl/worksheets/sheet1.xml"];
  const einzelOhne = _xlsxSpaltenName(ohne.fields.findIndex((f) => f.key === "preisCent"));
  zusage("ohne Preis bleibt die Zelle leer statt 0",
    !new RegExp(`<c r="${einzelOhne}2"`).test(blattOhne), blattOhne);
  const hinweisId = ohne.teile["xl/sharedStrings.xml"].includes(PREIS_LUECKEN_HINWEIS.replace(/—/g, "—"));
  zusage("die Mappe sagt selbst, dass die Geldsumme unvollstaendig ist", hinweisId,
    "der Hinweis fehlt in sharedStrings");
  const hinweisZeile = ohne.bloecke[0].zeilen.length + 3;
  gleich("dimension deckt die Hinweiszeile mit ab",
    (blattOhne.match(/<dimension ref="A1:([A-Z]+)(\d+)"/) || [])[2], String(hinweisZeile));
  zusage("der Filter laesst Gesamt- UND Hinweiszeile draussen",
    blattOhne.includes(`<autoFilter ref="A1:${_xlsxSpaltenName(ohne.fields.length - 1)}${hinweisZeile - 2}"/>`),
    (blattOhne.match(/<autoFilter[^>]*>/) || [""])[0]);

  // Preis 0 ist ein Betrag (kostenlos), kein fehlender Preis.
  const gratis = teileFuer("artikel", "a4");
  zusage("Preis 0 gilt als Betrag, nicht als fehlender Preis",
    !gratis.teile["xl/sharedStrings.xml"].includes(PREIS_LUECKEN_HINWEIS),
    "ein Preis von 0 darf nicht als Luecke gelten");
}

// ---------- 6. Rueckweg: echte Datei zurueckgelesen ----------

console.log("\n6. Rueckweg (openpyxl)");
// Beide Inhalte, nicht nur einer: Zusammenfassung und Verteilliste haben
// verschieden viele Spalten, und die Mengenspalte sitzt woanders.
for (const inhalt of ["artikel", "person"]) {
  const { bloecke, fields, mengeKey, teile } = teileFuer(inhalt, "");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-xlsx-"));
  const quelle = path.join(dir, "teile");
  for (const [pfad, xml] of Object.entries(teile)) {
    const ziel = path.join(quelle, pfad);
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, xml, "utf8");
  }
  const datei = path.join(dir, "probe.xlsx");

  let gelesen = null;
  try {
    // .NET statt JSZip: hier geht es um den INHALT der Teile. Das echte Zippen
    // im Browser macht JSZip, das ist erprobt und nicht Gegenstand dieses Tests.
    execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command",
      `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
      `[System.IO.Compression.ZipFile]::CreateFromDirectory('${quelle}', '${datei}')`],
      { stdio: "pipe" });
    const py = `
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
out = {}
for ws in wb.worksheets:
    out[ws.title] = [[("" if c.value is None else c.value) for c in row] for row in ws.iter_rows()]
print(json.dumps(out, ensure_ascii=False))
`;
    const roh = execFileSync("python", ["-c", py, datei],
      { stdio: "pipe", encoding: "utf8", env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    gelesen = JSON.parse(roh);
  } catch (e) {
    const text = String((e && e.stderr) || (e && e.message) || e);
    console.log("  UEBERSPRUNGEN: " + text.split("\n")[0].trim());
    console.log("  (braucht PowerShell + python mit openpyxl; Stufe 1 hat trotzdem geprueft)");
  }

  if (gelesen) {
    const namen = [...teile["xl/workbook.xml"].matchAll(/<sheet name="([^"]*)"/g)]
      .map((m) => m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    gleich(inhalt + ": Excel-Datei hat so viele Blaetter wie erwartet", Object.keys(gelesen).length, bloecke.length);
    bloecke.forEach(({ zeilen }, i) => {
      const blattName = namen[i];
      const ist = gelesen[blattName];
      if (!ist) { zusage(inhalt + ": Blatt gefunden: " + blattName, false, Object.keys(gelesen).join(", ")); return; }
      // Geldspalten stehen als EURO-ZAHL in der Mappe (Cent/100), nicht als
      // Text mit Euro-Zeichen -- sonst liesse sich in Excel nicht rechnen.
      // Ohne Preis bleibt die Zelle leer, nicht 0.
      const zellSoll = (f, wert) => {
        if (f.geld) return (wert === null || wert === undefined) ? "" : Number(wert) / 100;
        if (f.num) return Number(wert || 0);
        return String(wert);
      };
      const summen = exportSummen(fields, zeilen);
      const soll = [
        fields.map((f) => f.label),
        ...zeilen.map((z) => fields.map((f) => zellSoll(f, z[f.key]))),
        fields.map((f, c) => (f.summe ? zellSoll(f, summen.werte[c]) : (c === 0 ? "Gesamt" : "")))
      ];
      if (summen.luecken) soll.push(fields.map((f, c) => (c === 0 ? PREIS_LUECKEN_HINWEIS : "")));
      gleich(inhalt + ": Blatt " + blattName + " steht Zelle fuer Zelle richtig drin", ist, soll);
      const mengenSpalte = fields.findIndex((f) => f.key === mengeKey);
      // Die Luecken-Hinweiszeile ganz unten ist Text und keine Datenzeile --
      // sie traegt in der Mengenspalte nichts und bleibt hier draussen.
      const datenUndSumme = summen.luecken ? ist.slice(1, -1) : ist.slice(1);
      zusage(inhalt + ": Blatt " + blattName + ": Mengen sind Zahlen",
        datenUndSumme.every((r) => typeof r[mengenSpalte] === "number"),
        JSON.stringify(datenUndSumme.map((r) => r[mengenSpalte])));
    });
  }

  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------- 7. Verdrahtung ----------

console.log("\n7. Verdrahtung");
{
  const html = fs.readFileSync("index.html", "utf8");
  const js = fs.readFileSync("app.js", "utf8");
  zusage("der Knopf steht im HTML", html.includes('id="btn-export-xlsx"'));
  zusage("der Knopf haengt an exportXlsx", js.includes('getElementById("btn-export-xlsx").addEventListener("click", exportXlsx)'));
  zusage("JSZip haengt NICHT fest im head", !html.includes("jszip"));
  gleich("JSZip wird bei Bedarf nachgeladen", typeof sandbox.ladeJsZip, "function");
  zusage("die MIME-Angabe ist die von Excel",
    XLSX_MIME === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", XLSX_MIME);
  zusage("die JSZip-Adresse ist auf eine feste Fassung genagelt", /jszip@\d+\.\d+\.\d+\//.test(JSZIP_URL), JSZIP_URL);
}

console.log("\n" + (fehler === 0 ? "ALLES GRUEN" : "ROT") + ": " + ok + " Zusagen erfuellt, " + fehler + " offen.");
process.exit(fehler === 0 ? 0 : 1);
