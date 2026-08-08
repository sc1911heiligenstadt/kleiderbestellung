let appData = { aktionen: [] };
let currentUsername = null;
let currentIsAdmin = false;
let currentCanAdmin = false;
let currentCanEdit = false;

function canEdit() { return currentIsAdmin || currentCanEdit; }
// Dritte Stufe "Administrieren" (Tools-Übersicht): Bestellaktionen, Katalog,
// Bestellübersicht und fremde Bestellungen löschen sind Verwaltungssache —
// die eigene Bestellung abgeben darf jeder mit Bearbeiten-Recht.
function canAdmin() { return currentIsAdmin || currentCanAdmin; }
let currentVorname = null;
let currentNachname = null;
let currentMannschaften = [];

// Aktion, deren Bestellliste im Export-Panel ausgewählt ist ("" = alle Aktionen).
let exportAktionId = "";

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
}

function localDateIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function download(filename, type, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Fallback, falls der Gateway (noch) kein vorname/nachname liefert (älterer, noch nicht
// neu deployter admin-worker.js). Rät den Namen aus dem username (Format "vorname.nachname").
function deriveNameFromUsername(username) {
  const parts = String(username || "").split(".");
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  return { vorname: cap(parts[0] || ""), nachname: cap(parts.slice(1).join(" ") || "") };
}

// ---------- Datenmodell ----------
//
// { aktionen: [ { id, name, offen, artikel: [ {id, name, groessen, standardMenge, aktiv} ],
//                 bestellungen: { "<username>": {vorname, nachname, positionen, kommentar, letzteAenderung} } } ] }
//
// Jede Bestellaktion (Trainerpaket, Spielerpaket, ...) trägt ihre eigenen Artikel,
// ihr eigenes Bestellfenster und ihre eigenen Bestellungen. Positionen zeigen immer
// auf einen Artikel DERSELBEN Aktion.

function normalizeAktion(a, index) {
  const x = a && typeof a === "object" ? a : {};
  if (typeof x.id !== "string" || !x.id) x.id = "aktion-" + (index + 1);
  if (typeof x.name !== "string" || !x.name.trim()) x.name = "Bestellaktion " + (index + 1);
  if (typeof x.offen !== "boolean") x.offen = true;
  if (!Array.isArray(x.artikel)) x.artikel = [];
  if (!x.bestellungen || typeof x.bestellungen !== "object") x.bestellungen = {};
  for (const b of Object.values(x.bestellungen)) {
    if (b && !Array.isArray(b.positionen)) b.positionen = [];
  }
  return x;
}

function normalizeAppData(data) {
  const d = data && typeof data === "object" ? data : {};
  if (!Array.isArray(d.aktionen)) {
    // Migration aus der Ein-Topf-Struktur (bis 08/2026): der alte Katalog samt aller
    // bereits abgegebenen Bestellungen wird zur ersten Bestellaktion. Sie behält den
    // Zustand des alten globalen Bestellfensters, damit sich für niemanden etwas
    // öffnet oder schließt, was vorher anders stand.
    const altArtikel = (d.katalog && Array.isArray(d.katalog.artikel)) ? d.katalog.artikel : [];
    const altBestellungen = (d.bestellungen && typeof d.bestellungen === "object") ? d.bestellungen : {};
    d.aktionen = (altArtikel.length || Object.keys(altBestellungen).length)
      ? [{
          id: "bestellaktion-1",
          name: "Bestellaktion 1",
          offen: d.bestellfensterOffen !== false,
          artikel: altArtikel,
          bestellungen: altBestellungen
        }]
      : [];
  }
  d.aktionen = d.aktionen.map(normalizeAktion);
  // Doppelte Aktions-IDs auseinanderziehen, sonst trifft findAktion() die falsche.
  const gesehen = new Set();
  d.aktionen.forEach((a, i) => {
    while (gesehen.has(a.id)) a.id = a.id + "-" + (i + 1);
    gesehen.add(a.id);
  });
  // Alt-Felder entfernen, damit es nach der Migration nur eine Wahrheit gibt.
  delete d.katalog;
  delete d.bestellungen;
  delete d.bestellfensterOffen;
  return d;
}

function findAktion(aktionId, data) {
  return (data || appData).aktionen.find((a) => a.id === aktionId) || null;
}

function alleArtikel() {
  return appData.aktionen.flatMap((a) => a.artikel);
}

function meineBestellung(aktion) {
  return aktion.bestellungen[currentUsername] || { positionen: [], kommentar: "" };
}

function hatPosition(mine, artikelId) {
  return (mine.positionen || []).some((p) => p.artikelId === artikelId);
}

function hatEigeneBestellung(aktion) {
  const mine = aktion.bestellungen[currentUsername];
  return !!(mine && ((mine.positionen || []).length || (mine.kommentar || "").trim()));
}

// Wendet mutate() auf appData an und speichert. Bei Konflikt (409) wird der aktuelle
// Remote-Stand nachgeladen und dieselbe Mutation erneut angewendet, bevor erneut
// gespeichert wird. mutate() darf werfen (z.B. wenn das Bestellfenster zwischenzeitlich
// geschlossen wurde) — der Fehler wird dann an den Aufrufer durchgereicht.
async function saveWithConflictRetry(mutate) {
  mutate(appData);
  try {
    await gatewaySave(appData);
  } catch (e) {
    if (!(e instanceof ConflictError)) throw e;
    const data = await gatewayLoad();
    appData = normalizeAppData(data);
    mutate(appData);
    await gatewaySave(appData);
  }
}

function renderChangelog() {
  const list = document.getElementById("changelog-list");
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <span class="cv">Version ${escapeHtml(entry.version)}</span>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>
      `).join("")}
    </div>
  `).join("");
}

function renderHeaderUser() {
  const el = document.getElementById("header-user");
  if (!el) return;
  if (!currentUsername) { el.textContent = ""; return; }
  const name = (currentVorname || currentNachname)
    ? `${currentVorname || ""} ${currentNachname || ""}`.trim()
    : currentUsername;
  const mannschaftHinweis = currentMannschaften.length ? ` (${currentMannschaften.join(", ")})` : "";
  el.textContent = "👤 " + name + mannschaftHinweis + (currentIsAdmin ? " (Admin)" : "");
}

function activateTab(name) {
  document.querySelectorAll("nav button[data-tab]").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.remove("active"));
  const btn = document.querySelector('nav button[data-tab="' + name + '"]');
  if (btn) btn.classList.add("active");
  const section = document.getElementById("tab-" + name);
  if (section) section.classList.add("active");
}

function setupTabs() {
  document.querySelectorAll("nav button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });

}

function showAktionError(aktionId, msg) {
  const el = document.querySelector(`.bestell-aktion[data-aktion-id="${CSS.escape(aktionId)}"] .aktion-form-error`);
  if (!el) return;
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function showKatalogError(msg) {
  const el = document.getElementById("katalog-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function showAktionenError(msg) {
  const el = document.getElementById("aktionen-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function showUebersichtError(msg) {
  const el = document.getElementById("uebersicht-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

// ---------- Tab "Meine Bestellung" ----------

// Sichtbar ist eine Aktion, solange sie läuft — und danach nur noch für die, die
// dort auch bestellt haben. So sammeln sich abgeschlossene Aktionen nicht bei
// allen anderen im Formular an.
function sichtbareAktionen() {
  return appData.aktionen.filter((a) => a.offen !== false || hatEigeneBestellung(a));
}

function renderBestellAktionCard(aktion) {
  const offen = aktion.offen !== false;
  // Bestellen setzt Bearbeiten-Recht voraus (Sehen = absolut nichts editierbar).
  const bearbeitbar = offen && canEdit();
  const mine = meineBestellung(aktion);
  const aktiveArtikel = aktion.artikel.filter((a) => a.aktiv !== false || hatPosition(mine, a.id));

  const bannerText = !offen
    ? "🔒 Diese Bestellaktion ist geschlossen — Änderungen sind nicht mehr möglich. Bei Fragen wende dich an den Admin."
    : "👁 Nur Ansicht — Bestellungen aufgeben ist Bearbeitern vorbehalten.";
  const bannerHtml = bearbeitbar ? "" : `<div class="fenster-banner">${escapeHtml(bannerText)}</div>`;

  const rowsHtml = !aktiveArtikel.length
    ? `<div class="empty-state">${offen ? "Noch keine Artikel in dieser Bestellaktion." : "Keine Bestellung abgegeben."}</div>`
    : aktiveArtikel.map((a) => {
        const pos = mine.positionen.find((p) => p.artikelId === a.id);
        const groesse = pos ? pos.groesse : "";
        const menge = a.standardMenge || 1;
        const inaktivLabel = a.aktiv === false ? " (nicht mehr bestellbar)" : "";
        return `
        <div class="bestell-row" data-artikel-id="${escapeHtml(a.id)}">
          <span class="bestell-artikel-name">${escapeHtml(a.name)}${inaktivLabel}</span>
          <select class="bestell-groesse" ${bearbeitbar ? "" : "disabled"}>
            <option value="">— keine Auswahl —</option>
            ${(a.groessen || []).map((g) => `<option value="${escapeHtml(g)}" ${g === groesse ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
          </select>
          <input type="number" class="bestell-menge" min="1" step="1" value="${escapeHtml(menge)}" placeholder="Menge" disabled title="Die Menge ist je Artikel fest vom Verein vorgegeben." />
        </div>`;
      }).join("");

  return `
    <div class="card bestell-aktion" data-aktion-id="${escapeHtml(aktion.id)}">
      <div class="aktion-head">
        <h2>${escapeHtml(aktion.name)}</h2>
        <span class="aktion-status ${offen ? "offen" : "zu"}">${offen ? "läuft" : "geschlossen"}</span>
      </div>
      ${bannerHtml}
      <p class="muted">Wähle je Artikel deine Größe (die Menge ist fest vorgegeben). Du kannst deine Bestellung jederzeit ändern, solange diese Bestellaktion läuft.</p>
      <div class="bestellung-rows">${rowsHtml}</div>
      <div class="form-field" style="margin-top:14px;">
        <label>Kommentar (optional)</label>
        <textarea class="aktion-kommentar" rows="2" placeholder="z.B. Rückfrage zur Größe" ${bearbeitbar ? "" : "disabled"}>${escapeHtml(mine.kommentar || "")}</textarea>
      </div>
      <p class="muted aktion-form-error" style="display:none; color:#c0392b; margin-top:10px;"></p>
      <div class="btn-row" style="justify-content:flex-end; margin-top:16px; ${bearbeitbar ? "" : "display:none;"}">
        <button type="button" class="btn success btn-submit-aktion">Bestellung speichern</button>
      </div>
      <p class="muted aktion-letzte-aenderung" style="margin-top:10px;">${mine.letzteAenderung ? "Zuletzt geändert am " + escapeHtml(fmtDate(mine.letzteAenderung)) + "." : ""}</p>
    </div>`;
}

function renderMeineBestellung() {
  const container = document.getElementById("bestellung-aktionen");
  const aktionen = sichtbareAktionen();
  if (!aktionen.length) {
    container.innerHTML = `
      <div class="card">
        <h2>Meine Bestellung</h2>
        <div class="empty-state">Zurzeit läuft keine Bestellaktion.</div>
      </div>`;
    return;
  }
  container.innerHTML = aktionen.map(renderBestellAktionCard).join("");
}

function collectPositionenFromCard(card) {
  const positionen = [];
  card.querySelectorAll(".bestell-row").forEach((row) => {
    const artikelId = row.dataset.artikelId;
    const groesse = row.querySelector(".bestell-groesse").value;
    const menge = Number(row.querySelector(".bestell-menge").value);
    if (groesse && menge > 0) positionen.push({ artikelId, groesse, menge });
  });
  return positionen;
}

async function submitBestellung(aktionId) {
  const aktion = findAktion(aktionId);
  if (!aktion || aktion.offen === false) return;
  const card = document.querySelector(`.bestell-aktion[data-aktion-id="${CSS.escape(aktionId)}"]`);
  if (!card) return;
  showAktionError(aktionId, "");

  const positionen = collectPositionenFromCard(card);
  const kommentar = card.querySelector(".aktion-kommentar").value.trim();
  const fallback = deriveNameFromUsername(currentUsername);
  const entry = {
    vorname: currentVorname || fallback.vorname,
    nachname: currentNachname || fallback.nachname,
    positionen,
    kommentar,
    letzteAenderung: new Date().toISOString()
  };

  const btn = card.querySelector(".btn-submit-aktion");
  btn.disabled = true;
  btn.textContent = "Wird gespeichert…";

  try {
    await saveWithConflictRetry((data) => {
      const ziel = findAktion(aktionId, data);
      if (!ziel) throw new Error("Diese Bestellaktion wurde inzwischen entfernt.");
      if (ziel.offen === false) throw new Error("Diese Bestellaktion wurde inzwischen geschlossen.");
      ziel.bestellungen[currentUsername] = entry;
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Bestellung speichern";
    renderMeineBestellung();
    showAktionError(aktionId, "Speichern fehlgeschlagen: " + e.message);
    return;
  }

  renderMeineBestellung();
  // Gleiche Stufe wie beim Start-Rendering der Übersicht (canAdmin) — sonst
  // bleibt sie nach dem Speichern der eigenen Bestellung auf dem alten Stand.
  if (canAdmin()) renderBestellungsuebersicht();
}

// ---------- Tab "Einstellungen": Bestellaktionen ----------

function slugify(name, vergeben) {
  const base = name.trim().toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const stem = base || "eintrag";
  let slug = stem;
  let n = 2;
  while (vergeben.includes(slug)) { slug = `${stem}-${n++}`; }
  return slug;
}

function aktionHatBestellungen(aktion) {
  return Object.values(aktion.bestellungen).some((b) =>
    (b.positionen || []).length || (b.kommentar || "").trim());
}

function renderAktionenVerwaltung() {
  const aktionen = appData.aktionen;
  document.getElementById("aktionen-empty").style.display = aktionen.length ? "none" : "block";
  document.getElementById("aktionen-rows").innerHTML = aktionen.map((a) => {
    const offen = a.offen !== false;
    // Gleiche Zählweise wie aktionHatBestellungen() — sonst steht hier "0 Bestellungen",
    // während das Entfernen der Aktion mit Verweis auf vorhandene Bestellungen abgelehnt wird.
    const anzahl = Object.values(a.bestellungen).filter((b) => (b.positionen || []).length || (b.kommentar || "").trim()).length;
    return `
    <div class="aktion-row ${offen ? "" : "zu"}" data-aktion-id="${escapeHtml(a.id)}">
      <div class="aktion-row-main">
        <input type="text" class="aktion-name" value="${escapeHtml(a.name)}" />
        <span class="muted aktion-row-meta">${a.artikel.length} Artikel · ${anzahl} Bestellung${anzahl === 1 ? "" : "en"} · ${offen ? "läuft" : "geschlossen"}</span>
      </div>
      <div class="aktion-row-actions">
        <button type="button" class="btn secondary small btn-save-aktion">Speichern</button>
        <button type="button" class="btn secondary small btn-toggle-aktion">${offen ? "Schließen" : "Wieder öffnen"}</button>
        <button type="button" class="btn secondary small btn-delete-aktion">Entfernen</button>
      </div>
    </div>`;
  }).join("");
}

async function addAktion() {
  if (!canAdmin()) return;
  showAktionenError("");
  const name = document.getElementById("nb-name").value.trim();
  if (!name) { showAktionenError("Bitte einen Namen eingeben, z.B. Trainerpaket."); return; }
  const id = slugify(name, appData.aktionen.map((a) => a.id));
  try {
    await saveWithConflictRetry((data) => {
      data.aktionen.push({ id, name, offen: true, artikel: [], bestellungen: {} });
    });
  } catch (e) {
    showAktionenError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  document.getElementById("nb-name").value = "";
  renderEinstellungen();
  renderMeineBestellung();
}

async function updateAktion(aktionId, changes) {
  if (!canAdmin()) return;
  showAktionenError("");
  try {
    await saveWithConflictRetry((data) => {
      const a = findAktion(aktionId, data);
      if (a) Object.assign(a, changes);
    });
  } catch (e) {
    showAktionenError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  renderEinstellungen();
  renderMeineBestellung();
}

async function toggleAktion(aktionId) {
  const aktion = findAktion(aktionId);
  if (!aktion) return;
  const offen = aktion.offen !== false;
  if (offen && !confirm(`Bestellaktion "${aktion.name}" wirklich schließen? Bestellungen lassen sich danach nicht mehr ändern.`)) return;
  await updateAktion(aktionId, { offen: !offen });
}

async function deleteAktion(aktionId) {
  if (!canAdmin()) return;
  showAktionenError("");
  const aktion = findAktion(aktionId);
  if (!aktion) return;
  if (aktionHatBestellungen(aktion)) {
    showAktionenError(`Zu "${aktion.name}" liegen noch Bestellungen vor. Erst die Bestellungen in der Übersicht löschen, dann lässt sich die Aktion entfernen.`);
    return;
  }
  const zusatz = aktion.artikel.length ? ` Die ${aktion.artikel.length} Artikel darin werden mit entfernt.` : "";
  if (!confirm(`Bestellaktion "${aktion.name}" wirklich entfernen?` + zusatz)) return;
  try {
    await saveWithConflictRetry((data) => {
      data.aktionen = data.aktionen.filter((a) => a.id !== aktionId);
    });
  } catch (e) {
    showAktionenError("Entfernen fehlgeschlagen: " + e.message);
    return;
  }
  if (exportAktionId === aktionId) exportAktionId = "";
  renderEinstellungen();
  renderMeineBestellung();
}

// ---------- Tab "Einstellungen": Artikelkatalog ----------

function istArtikelInBestellungVerwendet(aktion, artikelId) {
  return Object.values(aktion.bestellungen).some((b) =>
    (b.positionen || []).some((p) => p.artikelId === artikelId));
}

function aktionOptionsHtml(selectedId) {
  return appData.aktionen.map((a) =>
    `<option value="${escapeHtml(a.id)}" ${a.id === selectedId ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
}

function renderKatalogVerwaltung() {
  const hatAktionen = appData.aktionen.length > 0;
  document.getElementById("katalog-empty").style.display = hatAktionen ? "none" : "block";
  document.getElementById("katalog-neu").style.display = hatAktionen ? "" : "none";
  document.getElementById("katalog-rows").innerHTML = appData.aktionen.map((a) => `
    <div class="katalog-gruppe">
      <h3 class="katalog-gruppe-titel">${escapeHtml(a.name)}</h3>
      ${a.artikel.length
        ? a.artikel.map((art) => `
        <div class="katalog-row ${art.aktiv === false ? "inaktiv" : ""}" data-artikel-id="${escapeHtml(art.id)}" data-aktion-id="${escapeHtml(a.id)}">
          <div class="katalog-row-main">
            <input type="text" class="katalog-name" value="${escapeHtml(art.name)}" />
            <input type="text" class="katalog-groessen" value="${escapeHtml((art.groessen || []).join(", "))}" />
            <input type="number" class="katalog-menge" min="1" step="1" value="${escapeHtml(art.standardMenge || 1)}" title="Standardmenge" />
            <select class="katalog-aktion" title="Zu welcher Bestellaktion gehört der Artikel?">${aktionOptionsHtml(a.id)}</select>
          </div>
          <div class="katalog-row-actions">
            <label class="katalog-aktiv-toggle">
              <input type="checkbox" class="katalog-aktiv" ${art.aktiv !== false ? "checked" : ""} /> Aktiv
            </label>
            <button type="button" class="btn secondary small btn-save-artikel">Speichern</button>
            <button type="button" class="btn secondary small btn-delete-artikel">Entfernen</button>
          </div>
        </div>`).join("")
        : `<p class="muted">Noch keine Artikel in dieser Bestellaktion.</p>`}
    </div>
  `).join("");
  document.getElementById("na-aktion").innerHTML = aktionOptionsHtml(appData.aktionen[0] && appData.aktionen[0].id);
}

async function addArtikel() {
  if (!canAdmin()) return;
  showKatalogError("");
  const aktionId = document.getElementById("na-aktion").value;
  const name = document.getElementById("na-name").value.trim();
  const groessenRaw = document.getElementById("na-groessen").value.trim();
  const standardMenge = Number(document.getElementById("na-menge").value) || 1;
  if (!findAktion(aktionId)) { showKatalogError("Bitte eine Bestellaktion auswählen."); return; }
  if (!name) { showKatalogError("Bitte einen Namen eingeben."); return; }
  const groessen = groessenRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!groessen.length) { showKatalogError("Bitte mindestens eine Größe eingeben."); return; }
  // Artikel-IDs sind über alle Aktionen hinweg eindeutig — dann bleibt ein Artikel
  // beim Verschieben in eine andere Aktion derselbe und kollidiert dort mit nichts.
  const id = slugify(name, alleArtikel().map((a) => a.id));
  try {
    await saveWithConflictRetry((data) => {
      const ziel = findAktion(aktionId, data);
      if (!ziel) throw new Error("Diese Bestellaktion wurde inzwischen entfernt.");
      ziel.artikel.push({ id, name, groessen, standardMenge, aktiv: true });
    });
  } catch (e) {
    showKatalogError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  document.getElementById("na-name").value = "";
  document.getElementById("na-groessen").value = "";
  document.getElementById("na-menge").value = "1";
  renderEinstellungen();
  renderMeineBestellung();
}

// Verschiebt einen Artikel samt aller bereits abgegebenen Positionen in eine andere
// Aktion. Ohne die Positionen zu bewegen, zeigten die Bestellungen der Quell-Aktion
// auf einen Artikel, den es dort nicht mehr gibt.
function moveArtikelInData(data, artikelId, vonId, nachId) {
  const von = findAktion(vonId, data);
  const nach = findAktion(nachId, data);
  if (!von || !nach || von === nach) return;
  const idx = von.artikel.findIndex((a) => a.id === artikelId);
  if (idx === -1) throw new Error("Der Artikel wurde inzwischen entfernt.");
  const [artikel] = von.artikel.splice(idx, 1);
  nach.artikel.push(artikel);

  for (const [username, b] of Object.entries(von.bestellungen)) {
    const mitgenommen = (b.positionen || []).filter((p) => p.artikelId === artikelId);
    if (!mitgenommen.length) continue;
    b.positionen = (b.positionen || []).filter((p) => p.artikelId !== artikelId);
    let ziel = nach.bestellungen[username];
    if (!ziel) {
      ziel = { vorname: b.vorname, nachname: b.nachname, positionen: [], kommentar: "", letzteAenderung: b.letzteAenderung };
      nach.bestellungen[username] = ziel;
    }
    if (!Array.isArray(ziel.positionen)) ziel.positionen = [];
    ziel.positionen.push(...mitgenommen);
    if (!ziel.vorname && b.vorname) ziel.vorname = b.vorname;
    if (!ziel.nachname && b.nachname) ziel.nachname = b.nachname;
    if (!ziel.letzteAenderung) ziel.letzteAenderung = b.letzteAenderung;
    // Bestellung, die durch das Verschieben leer geworden ist, nicht als Karteileiche stehen lassen.
    if (!b.positionen.length && !(b.kommentar || "").trim()) delete von.bestellungen[username];
  }
}

async function updateArtikel(aktionId, artikelId, changes, neueAktionId) {
  if (!canAdmin()) return;
  showKatalogError("");
  const wechsel = neueAktionId && neueAktionId !== aktionId;
  if (wechsel) {
    const von = findAktion(aktionId);
    const nach = findAktion(neueAktionId);
    const artikel = von && von.artikel.find((a) => a.id === artikelId);
    if (von && nach && artikel && istArtikelInBestellungVerwendet(von, artikelId)) {
      if (!confirm(`"${artikel.name}" wurde in "${von.name}" schon bestellt. Beim Verschieben nach "${nach.name}" wandern diese Bestellpositionen mit. Fortfahren?`)) return;
    }
  }
  try {
    await saveWithConflictRetry((data) => {
      const von = findAktion(aktionId, data);
      const a = von && von.artikel.find((x) => x.id === artikelId);
      if (a) Object.assign(a, changes);
      if (wechsel) moveArtikelInData(data, artikelId, aktionId, neueAktionId);
    });
  } catch (e) {
    showKatalogError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  renderEinstellungen();
  renderMeineBestellung();
}

async function deleteArtikel(aktionId, artikelId) {
  if (!canAdmin()) return;
  showKatalogError("");
  const aktion = findAktion(aktionId);
  if (!aktion) return;
  if (istArtikelInBestellungVerwendet(aktion, artikelId)) {
    showKatalogError("Dieser Artikel wird noch bestellt und kann nur deaktiviert, nicht entfernt werden.");
    return;
  }
  const artikel = aktion.artikel.find((a) => a.id === artikelId);
  if (!artikel) return;
  if (!confirm(`Artikel "${artikel.name}" wirklich entfernen?`)) return;
  try {
    await saveWithConflictRetry((data) => {
      const ziel = findAktion(aktionId, data);
      if (ziel) ziel.artikel = ziel.artikel.filter((a) => a.id !== artikelId);
    });
  } catch (e) {
    showKatalogError("Entfernen fehlgeschlagen: " + e.message);
    return;
  }
  renderEinstellungen();
  renderMeineBestellung();
}

// ---------- Tab "Einstellungen": Bestellungsübersicht ----------

function positionenLabel(positionen, artikelById) {
  const label = (positionen || []).map((p) => {
    const artikel = artikelById[p.artikelId];
    const name = artikel ? artikel.name : `(gelöscht: ${p.artikelId})`;
    return `${name} ${p.groesse} ×${p.menge}`;
  }).join(", ");
  return label || "—";
}

function renderBestellungsuebersicht() {
  const mitBestellungen = appData.aktionen.filter(aktionHatBestellungen);
  document.getElementById("uebersicht-empty").style.display = mitBestellungen.length ? "none" : "block";
  document.getElementById("uebersicht-rows").innerHTML = mitBestellungen.map((aktion) => {
    const artikelById = Object.fromEntries(aktion.artikel.map((a) => [a.id, a]));
    const rows = Object.entries(aktion.bestellungen)
      .map(([username, b]) => Object.assign({ username }, b))
      .sort((a, b) => `${a.vorname} ${a.nachname}`.localeCompare(`${b.vorname} ${b.nachname}`, "de"));
    return `
      <div class="uebersicht-gruppe">
        <h3 class="katalog-gruppe-titel">${escapeHtml(aktion.name)}</h3>
        ${rows.map((r) => `
        <div class="confirm-row">
          <div class="confirm-row-info">
            <span class="confirm-name">${escapeHtml((r.vorname + " " + r.nachname).trim() || r.username)}</span>
            <span class="muted">${escapeHtml(positionenLabel(r.positionen, artikelById))}</span>
            <span class="muted">Zuletzt geändert: ${escapeHtml(fmtDate(r.letzteAenderung))}${r.kommentar ? " — " + escapeHtml(r.kommentar) : ""}</span>
          </div>
          <button type="button" class="btn secondary small btn-delete-bestellung" data-username="${escapeHtml(r.username)}" data-aktion-id="${escapeHtml(aktion.id)}">Löschen</button>
        </div>`).join("")}
      </div>`;
  }).join("");
}

async function deleteBestellung(aktionId, username) {
  if (!canAdmin()) return;
  const aktion = findAktion(aktionId);
  if (!aktion) return;
  const entry = aktion.bestellungen[username];
  if (!entry) return;
  const name = `${entry.vorname || ""} ${entry.nachname || ""}`.trim() || username;
  if (!confirm(`Bestellung von ${name} aus "${aktion.name}" wirklich löschen?`)) return;
  showUebersichtError("");
  try {
    await saveWithConflictRetry((data) => {
      const ziel = findAktion(aktionId, data);
      if (ziel) delete ziel.bestellungen[username];
    });
  } catch (e) {
    showUebersichtError("Löschen fehlgeschlagen: " + e.message);
    return;
  }
  renderEinstellungen();
  if (username === currentUsername) renderMeineBestellung();
}

// ---------- Tab "Einstellungen": Export ----------

function groessenIndex(artikelById, artikelId, groesse) {
  const artikel = artikelById[artikelId];
  if (!artikel) return 999;
  const idx = (artikel.groessen || []).indexOf(groesse);
  return idx === -1 ? 999 : idx;
}

// Summiert die Bestellungen EINER Aktion nach Artikel und Größe.
function exportZeilen(aktion) {
  const proArtikel = new Map();
  for (const b of Object.values(aktion.bestellungen)) {
    for (const p of (b.positionen || [])) {
      if (!p.menge) continue;
      if (!proArtikel.has(p.artikelId)) proArtikel.set(p.artikelId, new Map());
      const proGroesse = proArtikel.get(p.artikelId);
      proGroesse.set(p.groesse, (proGroesse.get(p.groesse) || 0) + Number(p.menge));
    }
  }
  const artikelById = Object.fromEntries(aktion.artikel.map((a) => [a.id, a]));
  const zeilen = [];
  for (const [artikelId, proGroesse] of proArtikel) {
    const artikel = artikelById[artikelId];
    for (const [groesse, summe] of proGroesse) {
      zeilen.push({
        artikelId,
        groesse,
        summe,
        artikelName: artikel ? artikel.name : `(gelöscht: ${artikelId})`
      });
    }
  }
  return zeilen.sort((a, b) => a.artikelName.localeCompare(b.artikelName, "de") ||
    groessenIndex(artikelById, a.artikelId, a.groesse) - groessenIndex(artikelById, b.artikelId, b.groesse));
}

// Die im Export-Panel gewählten Aktionen, jeweils mit ihren summierten Zeilen.
function exportBloecke() {
  const gewaehlt = exportAktionId
    ? appData.aktionen.filter((a) => a.id === exportAktionId)
    : appData.aktionen;
  return gewaehlt
    .map((aktion) => ({ aktion, zeilen: exportZeilen(aktion) }))
    .filter((b) => b.zeilen.length);
}

function exportDateiname(endung) {
  const aktion = exportAktionId ? findAktion(exportAktionId) : null;
  const teil = aktion ? "_" + slugify(aktion.name, []) : "";
  return `kleiderbestellung${teil}_${localDateIso()}.${endung}`;
}

function exportText() {
  const bloecke = exportBloecke();
  if (!bloecke.length) { alert("Es liegen noch keine Bestellungen vor."); return; }
  const fields = [
    { label: "Artikel", key: "artikelName", num: false },
    { label: "Größe", key: "groesse", num: false },
    { label: "Menge", key: "summe", num: true }
  ];
  const alleZeilen = bloecke.flatMap((b) => b.zeilen);
  const widths = fields.map((f) => Math.max(f.label.length, ...alleZeilen.map((z) => String(z[f.key]).length)));
  const line = (cells) => cells.map((c, i) => {
    const s = String(c);
    return fields[i].num ? s.padStart(widths[i]) : s.padEnd(widths[i]);
  }).join("  ");
  const sepLine = widths.map((w) => "-".repeat(w)).join("  ");

  let out = `Kleiderbestellung — Zusammenfassung\n`;
  out += `Erstellt am ${new Date().toLocaleString("de-DE")}\n`;
  for (const { aktion, zeilen } of bloecke) {
    const gesamt = zeilen.reduce((a, z) => a + z.summe, 0);
    out += `\n${aktion.name}${aktion.offen === false ? " (geschlossen)" : ""}\n`;
    out += line(fields.map((f) => f.label)) + "\n" + sepLine + "\n";
    out += zeilen.map((z) => line(fields.map((f) => z[f.key]))).join("\n") + "\n";
    out += sepLine + "\n" + `Gesamt: ${gesamt} Stück\n`;
  }
  download(exportDateiname("txt"), "text/plain", "﻿" + out);
}

function exportPdf() {
  const bloecke = exportBloecke();
  if (!bloecke.length) { alert("Es liegen noch keine Bestellungen vor."); return; }
  const theadHtml = `<tr><th>Artikel</th><th>Größe</th><th class="num">Menge</th></tr>`;
  const abschnitte = bloecke.map(({ aktion, zeilen }) => {
    const rowsHtml = zeilen.map((z) => `<tr><td>${escapeHtml(z.artikelName)}</td><td>${escapeHtml(z.groesse)}</td><td class="num">${escapeHtml(z.summe)}</td></tr>`).join("");
    const gesamt = zeilen.reduce((a, z) => a + z.summe, 0);
    const totalRow = `<tr class="total-row"><td>Gesamt</td><td></td><td class="num">${escapeHtml(gesamt)}</td></tr>`;
    return `
      <h2 class="print-aktion">${escapeHtml(aktion.name)}${aktion.offen === false ? " (geschlossen)" : ""}</h2>
      <table class="print-table">
        <thead>${theadHtml}</thead>
        <tbody>${rowsHtml}${totalRow}</tbody>
      </table>`;
  }).join("");
  document.getElementById("print-content").innerHTML = `
    <h1>👕 Kleiderbestellung</h1>
    <p class="print-meta">Zusammenfassung nach Bestellaktion, Artikel und Größe — erstellt am ${new Date().toLocaleString("de-DE")}</p>
    ${abschnitte}`;
  document.body.classList.add("printing-report");
  const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 150);
}

function renderExportAuswahl() {
  const sel = document.getElementById("export-aktion");
  if (!appData.aktionen.some((a) => a.id === exportAktionId)) exportAktionId = "";
  sel.innerHTML = `<option value="">Alle Bestellaktionen</option>` +
    appData.aktionen.map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === exportAktionId ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("");
}

function renderEinstellungen() {
  renderAktionenVerwaltung();
  renderKatalogVerwaltung();
  renderBestellungsuebersicht();
  renderExportAuswahl();
}

// ---------- Start ----------

function startApp() {
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "block";
}

function showConnectScreen(errorMsg) {
  document.getElementById("connect-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
  const err = document.getElementById("cloud-error");
  err.style.display = errorMsg ? "block" : "none";
  err.textContent = errorMsg || "";
}

async function init() {
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();

  document.getElementById("bestellung-aktionen").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-submit-aktion");
    if (!btn) return;
    const card = btn.closest(".bestell-aktion");
    if (card) submitBestellung(card.dataset.aktionId);
  });

  document.getElementById("btn-add-aktion").addEventListener("click", addAktion);
  document.getElementById("btn-add-artikel").addEventListener("click", addArtikel);
  document.getElementById("btn-export-text").addEventListener("click", exportText);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPdf);
  document.getElementById("export-aktion").addEventListener("change", (e) => { exportAktionId = e.target.value; });

  document.getElementById("aktionen-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".aktion-row");
    if (!row) return;
    const aktionId = row.dataset.aktionId;
    if (e.target.closest(".btn-save-aktion")) {
      const name = row.querySelector(".aktion-name").value.trim();
      if (!name) { showAktionenError("Der Name darf nicht leer sein."); return; }
      updateAktion(aktionId, { name });
    } else if (e.target.closest(".btn-toggle-aktion")) {
      toggleAktion(aktionId);
    } else if (e.target.closest(".btn-delete-aktion")) {
      deleteAktion(aktionId);
    }
  });

  document.getElementById("katalog-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".katalog-row");
    if (!row) return;
    const artikelId = row.dataset.artikelId;
    const aktionId = row.dataset.aktionId;
    if (e.target.closest(".btn-save-artikel")) {
      const name = row.querySelector(".katalog-name").value.trim();
      const groessen = row.querySelector(".katalog-groessen").value.split(",").map((s) => s.trim()).filter(Boolean);
      const standardMenge = Number(row.querySelector(".katalog-menge").value) || 1;
      const aktiv = row.querySelector(".katalog-aktiv").checked;
      const neueAktionId = row.querySelector(".katalog-aktion").value;
      if (!name || !groessen.length) { showKatalogError("Name und mindestens eine Größe erforderlich."); return; }
      updateArtikel(aktionId, artikelId, { name, groessen, standardMenge, aktiv }, neueAktionId);
    } else if (e.target.closest(".btn-delete-artikel")) {
      deleteArtikel(aktionId, artikelId);
    }
  });

  document.getElementById("uebersicht-rows").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete-bestellung");
    if (btn) deleteBestellung(btn.dataset.aktionId, btn.dataset.username);
  });

  if (!getSessionToken()) {
    showConnectScreen();
    return;
  }

  try {
    // Nacheinander statt Promise.all — und das ist hier schneller, nicht
    // langsamer: dav-load liefert das "me" mittlerweile gratis mit (der Worker
    // hat nutzer.json und die Rechte-Datei für diesen Request ohnehin gelesen),
    // der zweite Aufruf kostet also gar keinen Request mehr. Parallel wären es
    // zwei echte Requests mit zwei Session-Prüfungen.
    const data = await gatewayLoad();
    const me = await fetchMe();
    currentUsername = me.username;
    currentIsAdmin = !!me.isAdmin;
    currentCanAdmin = !!me.canAdmin;
    currentCanEdit = !!me.canEdit;
    currentVorname = me.vorname || null;
    currentNachname = me.nachname || null;
    currentMannschaften = Array.isArray(me.mannschaften) ? me.mannschaften : [];
    appData = normalizeAppData(data);
    document.getElementById("nav-einstellungen").style.display = canAdmin() ? "" : "none";
    startApp();
    renderHeaderUser();
    renderMeineBestellung();
    if (canAdmin()) renderEinstellungen();
  } catch (e) {
    if (e instanceof NotLoggedInError) {
      showConnectScreen();
    } else {
      showConnectScreen("Fehler beim Laden: " + e.message);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
