// Externe Bestellseite: Spieler ohne Vereinskonto bestellen über einen Link mit
// Zufallstoken. Bewusst eigenständig — diese Seite lädt weder db.js noch app.js:
// beide setzen eine angemeldete Sitzung voraus, die es hier gerade nicht gibt.
//
// ⚠️ Der Token steht im HASH, nicht in der Query. Ein Hash wird vom Browser nie
// an einen Server geschickt und landet damit in keinem Zugriffsprotokoll und in
// keinem Referrer — bei einem Wert, der selbst der Ausweis ist, ist das der
// Unterschied zwischen geheim und "steht im Log". Der Query-Parameter wird nur
// noch als Rückfall gelesen, für den Fall, dass jemand einen Link von Hand
// umschreibt.

const GATEWAY_URL = "https://landingpage.michel-brunner.workers.dev";

let token = null;
let aktion = null;          // { name, offen, artikel: [{id, name, groessen, menge}] }
let ident = null;           // { vorname, nachname, jahrgang }
// ⚠️ Das Passwort lebt ausschließlich in dieser Variablen, nie in localStorage
// oder sessionStorage: die Seite läuft oft auf einem geteilten oder fremden
// Gerät (Trainer hält das Handy hin), und ein dort liegengebliebenes Passwort
// öffnet die Bestellung dem Nächsten.
let passwort = "";
let brauchtNeuesPasswort = false;
let bestehendeBestellung = null;

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " um " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function el(id) { return document.getElementById(id); }

function zeigeSchritt(name) {
  ["lade-karte", "fehler-karte", "schritt-ident", "schritt-passwort", "schritt-bestellung", "schritt-fertig"]
    .forEach((s) => { const e = el(s); if (e) e.style.display = "none"; });
  const ziel = el(name);
  if (ziel) ziel.style.display = "block";
  // Der Datenschutzhinweis gehört unter jeden Schritt, in dem wirklich Daten
  // eingegeben werden — nicht unter die Fehlermeldung eines toten Links.
  el("ds-karte").style.display = (name === "lade-karte" || name === "fehler-karte") ? "none" : "block";
  window.scrollTo(0, 0);
}

function zeigeFehlerKarte(text) {
  el("fehler-text").textContent = text;
  zeigeSchritt("fehler-karte");
}

function meldung(id, text) {
  const e = el(id);
  e.textContent = text || "";
  e.style.display = text ? "block" : "none";
}

// Ruft den Gateway-Worker auf. Antwortet er mit einem Fehler, wird dessen Text
// geworfen — der Worker formuliert ihn bereits so, dass er einem Spieler etwas
// sagt ("Dieser Link wurde zurückgezogen"), eine eigene Übersetzungstabelle
// hier liefe davon nur auseinander.
async function ruf(payload) {
  let resp;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    throw new Error("Keine Verbindung zum Server. Bist du online?");
  }
  let body = {};
  try { body = await resp.json(); } catch (_) { /* gleich als Fehler behandelt */ }
  if (!resp.ok) {
    // Läuft am Gateway noch eine Fassung ohne diese Aktionen, antwortet er mit
    // "Unbekannte Aktion". Das ist eine Meldung für Entwickler — ein Spieler
    // soll nicht rätseln, was er falsch gemacht hat (er hat nichts falsch
    // gemacht: der Worker-Deploy fehlt noch).
    if (resp.status === 400 && body.error === "Unbekannte Aktion") {
      throw new Error("Die Bestellung ist gerade noch nicht freigeschaltet. Bitte probier es später noch einmal oder frag deinen Trainer.");
    }
    const e = new Error(body.error || ("Es hat nicht geklappt (HTTP " + resp.status + ")."));
    e.status = resp.status;
    throw e;
  }
  return body;
}

function tokenAusUrl() {
  const hash = String(location.hash || "").replace(/^#/, "");
  const ausHash = new URLSearchParams(hash).get("t");
  if (ausHash) return ausHash.trim();
  return (new URLSearchParams(location.search).get("t") || "").trim();
}

// ---------- Schritt 1: Wer bist du? ----------

function renderIdentKopf() {
  el("ident-aktion-name").textContent = aktion.name || "Bestellaktion";
  const status = el("ident-aktion-status");
  status.textContent = aktion.offen ? "läuft" : "geschlossen";
  status.className = "aktion-status " + (aktion.offen ? "offen" : "zu");
  const banner = el("ident-banner");
  if (aktion.offen) {
    banner.style.display = "none";
  } else {
    banner.textContent = "🔒 Diese Bestellaktion ist geschlossen. Du kannst deine Bestellung noch ansehen, aber nicht mehr ändern.";
    banner.style.display = "block";
  }
}

async function identWeiter() {
  meldung("ident-fehler", "");
  const vorname = el("ident-vorname").value.trim();
  const nachname = el("ident-nachname").value.trim();
  const jahrgang = el("ident-jahrgang").value.trim();
  if (!vorname || !nachname) { meldung("ident-fehler", "Bitte Vorname und Nachname eintragen."); return; }
  if (!/^(19|20)\d{2}$/.test(jahrgang)) { meldung("ident-fehler", "Bitte das Geburtsjahr vierstellig eintragen, z.B. 2010."); return; }

  ident = { vorname, nachname, jahrgang };
  passwort = "";

  const btn = el("btn-ident-weiter");
  btn.disabled = true;
  btn.textContent = "Einen Moment …";
  try {
    const res = await ruf({ action: "kb-extern-anmelden", token, ...ident });
    verarbeiteAnmeldung(res);
  } catch (e) {
    meldung("ident-fehler", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Weiter";
  }
}

// Die vier Antworten von kb-extern-anmelden auf die drei Ansichten verteilen.
function verarbeiteAnmeldung(res) {
  if (res.status === "passwort") {
    el("pw-name").textContent = `${ident.vorname} ${ident.nachname} (${ident.jahrgang})`;
    el("pw-eingabe").value = "";
    meldung("pw-fehler", "");
    zeigeSchritt("schritt-passwort");
    el("pw-eingabe").focus();
    return;
  }
  // "neu"   = es gibt noch nichts, Passwort wird beim Absenden vergeben
  // "offen" = es gibt eine Bestellung ohne Passwort (zurückgesetzt) — sie wird
  //           geladen, und beim Speichern muss ein neues vergeben werden
  // "ok"    = Passwort stimmte, Bestellung liegt bei
  brauchtNeuesPasswort = (res.status !== "ok");
  bestehendeBestellung = res.bestellung || null;
  renderBestellung();
  zeigeSchritt("schritt-bestellung");
}

async function passwortWeiter() {
  meldung("pw-fehler", "");
  const eingabe = el("pw-eingabe").value;
  if (!eingabe) { meldung("pw-fehler", "Bitte das Passwort eingeben."); return; }

  const btn = el("btn-pw-weiter");
  btn.disabled = true;
  btn.textContent = "Wird geprüft …";
  try {
    const res = await ruf({ action: "kb-extern-anmelden", token, ...ident, passwort: eingabe });
    // Erst nach der bestätigten Antwort merken — sonst steht bei einem
    // Fehlversuch ein falsches Passwort im Speicher und das Absenden scheitert
    // später mit derselben Meldung an einer ganz anderen Stelle.
    passwort = eingabe;
    verarbeiteAnmeldung(res);
  } catch (e) {
    meldung("pw-fehler", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Bestellung laden";
  }
}

// ---------- Schritt 3: Die Bestellung ----------

function renderBestellung() {
  el("b-aktion-name").textContent = aktion.name || "Bestellaktion";
  const status = el("b-aktion-status");
  status.textContent = aktion.offen ? "läuft" : "geschlossen";
  status.className = "aktion-status " + (aktion.offen ? "offen" : "zu");

  el("b-fuer").innerHTML = `Bestellung für <strong>${escapeHtml(ident.vorname)} ${escapeHtml(ident.nachname)}</strong> (${escapeHtml(ident.jahrgang)})`;

  const banner = el("b-banner");
  if (aktion.offen) {
    banner.style.display = "none";
  } else {
    banner.textContent = "🔒 Diese Bestellaktion ist geschlossen — Änderungen sind nicht mehr möglich.";
    banner.style.display = "block";
  }

  // Freitext der Verwaltung (z.B. Kostenregelung). textContent + pre-line im
  // CSS: Umbrüche bleiben, HTML kann nicht hinein. Ein älterer Worker liefert
  // das Feld nicht — dann bleibt die Box einfach weg.
  const hinweis = String(aktion.hinweis || "").trim();
  el("b-hinweis").textContent = hinweis;
  el("b-hinweis").style.display = hinweis ? "block" : "none";

  const gewaehlt = {};
  for (const p of ((bestehendeBestellung && bestehendeBestellung.positionen) || [])) {
    gewaehlt[p.artikelId] = p;
  }

  const rows = el("b-rows");
  if (!aktion.artikel.length) {
    rows.innerHTML = `<div class="empty-state">In dieser Bestellaktion stehen noch keine Artikel.</div>`;
  } else {
    rows.innerHTML = aktion.artikel.map((a) => {
      const pos = gewaehlt[a.id];
      // menge 0 vom Worker heißt: die Menge ist nicht vorgegeben, der Besteller
      // wählt sie selbst — nur dann ist das Feld editierbar. Ein älterer Worker
      // liefert nie 0, dann bleibt alles wie bisher.
      const frei = a.menge === 0;
      const menge = frei ? (pos && pos.menge > 0 ? pos.menge : 1) : a.menge;
      const titel = frei ? "Bei diesem Artikel wählst du die Menge selbst." : "Die Menge ist je Artikel fest vom Verein vorgegeben.";
      return `
      <div class="bestell-row" data-artikel-id="${escapeHtml(a.id)}" ${frei ? 'data-menge-frei="1"' : ""}>
        <span class="bestell-artikel-name">${escapeHtml(a.name)}</span>
        <select class="bestell-groesse" ${aktion.offen ? "" : "disabled"}>
          <option value="">— keine Auswahl —</option>
          ${a.groessen.map((g) => `<option value="${escapeHtml(g)}" ${pos && g === pos.groesse ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
        </select>
        <input type="number" class="bestell-menge" min="1" step="1" value="${escapeHtml(menge)}" ${frei && aktion.offen ? "" : "disabled"} title="${escapeHtml(titel)}" />
      </div>`;
    }).join("");
  }

  const komm = el("b-kommentar");
  komm.value = (bestehendeBestellung && bestehendeBestellung.kommentar) || "";
  komm.disabled = !aktion.offen;

  // Das Passwort-Feld gibt es nur, wenn wirklich eines vergeben werden muss —
  // wer seine Bestellung mit Passwort geöffnet hat, soll es nicht erneut tippen.
  el("b-pw-neu").style.display = (aktion.offen && brauchtNeuesPasswort) ? "block" : "none";
  el("b-pw1").value = "";
  el("b-pw2").value = "";

  el("btn-b-absenden").style.display = aktion.offen ? "" : "none";
  meldung("b-fehler", "");

  const letzte = bestehendeBestellung && bestehendeBestellung.letzteAenderung;
  el("b-letzte-aenderung").textContent = letzte ? "Zuletzt geändert am " + fmtDate(letzte) + "." : "";
}

function sammlePositionen() {
  const positionen = [];
  el("b-rows").querySelectorAll(".bestell-row").forEach((row) => {
    const groesse = row.querySelector(".bestell-groesse").value;
    if (!groesse) return;
    const eintrag = { artikelId: row.dataset.artikelId, groesse };
    // Nur bei freigegebener Menge (Standardmenge 0) geht die eigene Wahl mit —
    // bei allen anderen setzt der Worker ohnehin die Katalogmenge.
    if (row.dataset.mengeFrei) {
      eintrag.menge = Math.floor(Number(row.querySelector(".bestell-menge").value));
    }
    positionen.push(eintrag);
  });
  return positionen;
}

// Zeile mit gewählter Größe, aber ohne brauchbare selbstgewählte Menge — der
// Worker würde sie kommentarlos weglassen; besser vorher benennen.
function findeZeileOhneMenge() {
  for (const row of el("b-rows").querySelectorAll('.bestell-row[data-menge-frei]')) {
    if (!row.querySelector(".bestell-groesse").value) continue;
    const menge = Math.floor(Number(row.querySelector(".bestell-menge").value));
    if (!Number.isFinite(menge) || menge < 1) {
      return row.querySelector(".bestell-artikel-name").textContent;
    }
  }
  return null;
}

async function absenden() {
  meldung("b-fehler", "");
  if (!aktion.offen) return;

  const ohneMenge = findeZeileOhneMenge();
  if (ohneMenge) {
    meldung("b-fehler", `Bitte trag bei „${ohneMenge}“ eine Menge von mindestens 1 ein — oder stell die Größe auf „keine Auswahl“ zurück.`);
    return;
  }

  const positionen = sammlePositionen();
  const kommentar = el("b-kommentar").value.trim();
  if (!positionen.length && !kommentar) {
    meldung("b-fehler", "Bitte wähle mindestens eine Größe aus.");
    return;
  }

  const payload = { action: "kb-extern-speichern", token, ...ident, positionen, kommentar };

  let neuesPasswort = "";
  if (brauchtNeuesPasswort) {
    neuesPasswort = el("b-pw1").value;
    const wdh = el("b-pw2").value;
    if (neuesPasswort.length < 4) { meldung("b-fehler", "Bitte ein Passwort mit mindestens 4 Zeichen vergeben."); return; }
    if (neuesPasswort !== wdh) { meldung("b-fehler", "Die beiden Passwörter sind nicht gleich."); return; }
    payload.neuesPasswort = neuesPasswort;
  } else {
    payload.passwort = passwort;
  }

  const btn = el("btn-b-absenden");
  btn.disabled = true;
  btn.textContent = "Wird gespeichert …";
  try {
    const res = await ruf(payload);
    // Erst nach dem bestätigten Speichern übernehmen: sonst hielte die Seite
    // nach einem Fehlschlag ein Passwort für gesetzt, das der Server nie
    // bekommen hat — und das nächste Absenden liefe in "Falsches Passwort".
    if (neuesPasswort) { passwort = neuesPasswort; brauchtNeuesPasswort = false; }
    bestehendeBestellung = {
      positionen: res.positionen || positionen,
      kommentar,
      letzteAenderung: res.letzteAenderung || ""
    };
    const anzahl = (res.positionen || positionen).length;
    el("fertig-text").textContent = anzahl
      ? `Für ${ident.vorname} ${ident.nachname} ${anzahl === 1 ? "ist 1 Artikel" : "sind " + anzahl + " Artikel"} notiert.`
      : `Dein Kommentar für ${ident.vorname} ${ident.nachname} ist notiert.`;
    zeigeSchritt("schritt-fertig");
  } catch (e) {
    meldung("b-fehler", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Bestellung abschicken";
  }
}

// ---------- Start ----------

function zurueckZurIdent() {
  ident = null;
  passwort = "";
  bestehendeBestellung = null;
  brauchtNeuesPasswort = false;
  renderIdentKopf();
  zeigeSchritt("schritt-ident");
}

async function init() {
  token = tokenAusUrl();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    zeigeFehlerKarte("Dieser Link ist unvollständig. Wahrscheinlich ist beim Kopieren ein Stück verloren gegangen — scanne den QR-Code am besten noch einmal.");
    return;
  }

  try {
    const res = await ruf({ action: "kb-extern-start", token });
    aktion = res.aktion;
  } catch (e) {
    zeigeFehlerKarte(e.message);
    return;
  }

  renderIdentKopf();
  zeigeSchritt("schritt-ident");

  el("btn-ident-weiter").addEventListener("click", identWeiter);
  el("btn-pw-weiter").addEventListener("click", passwortWeiter);
  el("btn-pw-zurueck").addEventListener("click", zurueckZurIdent);
  el("btn-b-zurueck").addEventListener("click", zurueckZurIdent);
  el("btn-b-absenden").addEventListener("click", absenden);
  el("btn-fertig-aendern").addEventListener("click", () => {
    renderBestellung();
    zeigeSchritt("schritt-bestellung");
  });

  // Enter im Namensblock und im Passwortfeld soll weiterführen — am Handy ist
  // das der naheliegende Griff, und ohne das sucht man den Knopf hinter der
  // eingeblendeten Tastatur.
  ["ident-vorname", "ident-nachname", "ident-jahrgang"].forEach((id) => {
    el(id).addEventListener("keydown", (e) => { if (e.key === "Enter") identWeiter(); });
  });
  el("pw-eingabe").addEventListener("keydown", (e) => { if (e.key === "Enter") passwortWeiter(); });
}

init();
