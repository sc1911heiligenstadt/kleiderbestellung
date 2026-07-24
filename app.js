let appData = { katalog: { artikel: [] }, bestellfensterOffen: true, bestellungen: {} };
let currentUsername = null;
let currentIsAdmin = false;
let currentCanAdmin = false;
let currentCanEdit = false;

function canEdit() { return currentIsAdmin || currentCanEdit; } // seit 2026-07-24 ohne Konsument — die ganze Verwaltung hängt an canAdmin(), bestellen darf jeder Sichtbare
// Dritte Stufe "Administrieren" (Tools-Übersicht): Katalog, Bestellfenster,
// Bestellübersicht und fremde Bestellungen löschen sind Verwaltungssache —
// das Bearbeiten-Häkchen hat in dieser App bewusst keine Funktion mehr.
function canAdmin() { return currentIsAdmin || currentCanAdmin; }
let currentVorname = null;
let currentNachname = null;
let currentMannschaften = [];

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

function normalizeAppData(data) {
  const d = data && typeof data === "object" ? data : {};
  if (!d.katalog) d.katalog = { artikel: [] };
  if (!Array.isArray(d.katalog.artikel)) d.katalog.artikel = [];
  if (typeof d.bestellfensterOffen !== "boolean") d.bestellfensterOffen = true;
  if (!d.bestellungen) d.bestellungen = {};
  return d;
}

function hatPosition(mine, artikelId) {
  return (mine.positionen || []).some((p) => p.artikelId === artikelId);
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

  // Versionshistorie liegt im oeffentlichen Bestellung-Tab (siehe index.html), nicht im
  // admin-only Einstellungen-Tab — fuer jeden eingeloggten Nutzer erreichbar.
  const versionBadgeHeader = document.getElementById("version-badge");
  const openVersionHistory = () => activateTab("info");
  versionBadgeHeader.addEventListener("click", openVersionHistory);
  versionBadgeHeader.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openVersionHistory(); }
  });
}

function showFormError(msg) {
  const el = document.getElementById("form-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function showKatalogError(msg) {
  const el = document.getElementById("katalog-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

function showUebersichtError(msg) {
  const el = document.getElementById("uebersicht-error");
  el.textContent = msg || "";
  el.style.display = msg ? "block" : "none";
}

// ---------- Tab "Meine Bestellung" ----------

function renderMeineBestellung() {
  const offen = appData.bestellfensterOffen !== false;
  // Bestellen setzt seit 2026-07-24 (2. Runde) Bearbeiten-Recht voraus (Sehen = absolut
  // nichts editierbar); serverseitig zusätzlich via WRITE_REQUIRES_EDIT_PERMISSION.
  const bearbeitbar = offen && canEdit();
  const mine = appData.bestellungen[currentUsername] || { positionen: [], kommentar: "" };
  const aktiveArtikel = appData.katalog.artikel.filter((a) => a.aktiv !== false || hatPosition(mine, a.id));

  document.getElementById("fenster-banner-card").style.display = bearbeitbar ? "none" : "block";
  if (!bearbeitbar) {
    document.getElementById("fenster-banner").textContent = !offen
      ? "🔒 Das Bestellfenster ist geschlossen — Änderungen sind nicht mehr möglich. Bei Fragen wende dich an den Admin."
      : "👁 Nur Ansicht — Bestellungen aufgeben ist Bearbeitern vorbehalten.";
  }

  const rowsEl = document.getElementById("bestellung-rows");
  if (!aktiveArtikel.length) {
    rowsEl.innerHTML = `<div class="empty-state">${offen ? "Noch keine Artikel im Katalog." : "Keine Bestellung abgegeben."}</div>`;
  } else {
    rowsEl.innerHTML = aktiveArtikel.map((a) => {
      const pos = mine.positionen.find((p) => p.artikelId === a.id);
      const groesse = pos ? pos.groesse : "";
      const menge = a.standardMenge || 1;
      const inaktivLabel = a.aktiv === false ? " (nicht mehr bestellbar)" : "";
      return `
        <div class="bestell-row" data-artikel-id="${escapeHtml(a.id)}">
          <span class="bestell-artikel-name">${escapeHtml(a.name)}${inaktivLabel}</span>
          <select class="bestell-groesse" ${bearbeitbar ? "" : "disabled"}>
            <option value="">— keine Auswahl —</option>
            ${a.groessen.map((g) => `<option value="${escapeHtml(g)}" ${g === groesse ? "selected" : ""}>${escapeHtml(g)}</option>`).join("")}
          </select>
          <input type="number" class="bestell-menge" min="1" step="1" value="${escapeHtml(menge)}" placeholder="Menge" disabled title="Die Menge ist je Artikel fest vom Verein vorgegeben." />
        </div>`;
    }).join("");
  }

  const kommentarEl = document.getElementById("f-kommentar");
  kommentarEl.value = mine.kommentar || "";
  kommentarEl.disabled = !bearbeitbar;
  document.getElementById("btn-submit").style.display = bearbeitbar ? "" : "none";

  document.getElementById("letzte-aenderung").textContent =
    mine.letzteAenderung ? `Zuletzt geändert am ${fmtDate(mine.letzteAenderung)}.` : "";
}

function collectPositionenFromForm() {
  const positionen = [];
  document.querySelectorAll("#bestellung-rows .bestell-row").forEach((row) => {
    const artikelId = row.dataset.artikelId;
    const groesse = row.querySelector(".bestell-groesse").value;
    const menge = Number(row.querySelector(".bestell-menge").value);
    if (groesse && menge > 0) positionen.push({ artikelId, groesse, menge });
  });
  return positionen;
}

async function submitBestellung() {
  if (appData.bestellfensterOffen === false) return;
  showFormError("");
  const positionen = collectPositionenFromForm();
  const kommentar = document.getElementById("f-kommentar").value.trim();
  const fallback = deriveNameFromUsername(currentUsername);
  const entry = {
    vorname: currentVorname || fallback.vorname,
    nachname: currentNachname || fallback.nachname,
    positionen,
    kommentar,
    letzteAenderung: new Date().toISOString()
  };

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  btn.textContent = "Wird gespeichert…";

  try {
    await saveWithConflictRetry((data) => {
      if (data.bestellfensterOffen === false) throw new Error("Das Bestellfenster wurde inzwischen geschlossen.");
      data.bestellungen[currentUsername] = entry;
    });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Bestellung speichern";
    showFormError("Speichern fehlgeschlagen: " + e.message);
    renderMeineBestellung();
    return;
  }

  btn.disabled = false;
  btn.textContent = "Bestellung speichern";
  renderMeineBestellung();
  // Gleiche Stufe wie beim Start-Rendering der Übersicht (canAdmin) — sonst
  // bleibt sie nach dem Speichern der eigenen Bestellung auf dem alten Stand.
  if (canAdmin()) renderBestellungsuebersicht();
}

// ---------- Tab "Einstellungen": Bestellfenster ----------

function renderFensterEinstellungen() {
  const offen = appData.bestellfensterOffen !== false;
  document.getElementById("fenster-status-text").textContent = offen
    ? "Das Bestellfenster ist derzeit OFFEN — Trainer:innen können Bestellungen abgeben und ändern."
    : "Das Bestellfenster ist derzeit GESCHLOSSEN — Bestellungen sind nur noch lesbar.";
  const btn = document.getElementById("btn-toggle-fenster");
  btn.textContent = offen ? "Bestellfenster schließen" : "Bestellfenster wieder öffnen";
  btn.classList.toggle("secondary", offen);
}

async function toggleBestellfenster() {
  if (!canAdmin()) return;
  const offen = appData.bestellfensterOffen !== false;
  if (offen && !confirm("Bestellfenster wirklich schließen? Trainer:innen können ihre Bestellung danach nicht mehr ändern.")) return;
  const btn = document.getElementById("btn-toggle-fenster");
  btn.disabled = true;
  try {
    await saveWithConflictRetry((data) => { data.bestellfensterOffen = !offen; });
  } catch (e) {
    alert("Speichern fehlgeschlagen: " + e.message);
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  renderFensterEinstellungen();
  renderMeineBestellung();
}

// ---------- Tab "Einstellungen": Artikelkatalog ----------

function slugify(name) {
  const base = name.trim().toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const stem = base || "artikel";
  let slug = stem;
  let n = 2;
  while (appData.katalog.artikel.some((a) => a.id === slug)) { slug = `${stem}-${n++}`; }
  return slug;
}

function istArtikelInBestellungVerwendet(artikelId) {
  return Object.values(appData.bestellungen).some((b) =>
    (b.positionen || []).some((p) => p.artikelId === artikelId));
}

function renderKatalogVerwaltung() {
  const artikel = appData.katalog.artikel;
  document.getElementById("katalog-empty").style.display = artikel.length ? "none" : "block";
  document.getElementById("katalog-rows").innerHTML = artikel.map((a) => `
    <div class="katalog-row ${a.aktiv === false ? "inaktiv" : ""}" data-artikel-id="${escapeHtml(a.id)}">
      <div class="katalog-row-main">
        <input type="text" class="katalog-name" value="${escapeHtml(a.name)}" />
        <input type="text" class="katalog-groessen" value="${escapeHtml((a.groessen || []).join(", "))}" />
        <input type="number" class="katalog-menge" min="1" step="1" value="${escapeHtml(a.standardMenge || 1)}" title="Standardmenge" />
      </div>
      <div class="katalog-row-actions">
        <label class="katalog-aktiv-toggle">
          <input type="checkbox" class="katalog-aktiv" ${a.aktiv !== false ? "checked" : ""} /> Aktiv
        </label>
        <button type="button" class="btn secondary small btn-save-artikel">Speichern</button>
        <button type="button" class="btn secondary small btn-delete-artikel">Entfernen</button>
      </div>
    </div>
  `).join("");
}

async function addArtikel() {
  if (!canAdmin()) return;
  showKatalogError("");
  const name = document.getElementById("na-name").value.trim();
  const groessenRaw = document.getElementById("na-groessen").value.trim();
  const standardMenge = Number(document.getElementById("na-menge").value) || 1;
  if (!name) { showKatalogError("Bitte einen Namen eingeben."); return; }
  const groessen = groessenRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!groessen.length) { showKatalogError("Bitte mindestens eine Größe eingeben."); return; }
  const id = slugify(name);
  try {
    await saveWithConflictRetry((data) => {
      data.katalog.artikel.push({ id, name, groessen, standardMenge, aktiv: true });
    });
  } catch (e) {
    showKatalogError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  document.getElementById("na-name").value = "";
  document.getElementById("na-groessen").value = "";
  document.getElementById("na-menge").value = "1";
  renderKatalogVerwaltung();
  renderMeineBestellung();
}

async function updateArtikel(artikelId, changes) {
  if (!canAdmin()) return;
  showKatalogError("");
  try {
    await saveWithConflictRetry((data) => {
      const a = data.katalog.artikel.find((x) => x.id === artikelId);
      if (a) Object.assign(a, changes);
    });
  } catch (e) {
    showKatalogError("Speichern fehlgeschlagen: " + e.message);
    return;
  }
  renderKatalogVerwaltung();
  renderMeineBestellung();
}

async function deleteArtikel(artikelId) {
  if (!canAdmin()) return;
  showKatalogError("");
  if (istArtikelInBestellungVerwendet(artikelId)) {
    showKatalogError("Dieser Artikel wird noch bestellt und kann nur deaktiviert, nicht entfernt werden.");
    return;
  }
  const artikel = appData.katalog.artikel.find((a) => a.id === artikelId);
  if (!artikel) return;
  if (!confirm(`Artikel "${artikel.name}" wirklich entfernen?`)) return;
  try {
    await saveWithConflictRetry((data) => {
      data.katalog.artikel = data.katalog.artikel.filter((a) => a.id !== artikelId);
    });
  } catch (e) {
    showKatalogError("Entfernen fehlgeschlagen: " + e.message);
    return;
  }
  renderKatalogVerwaltung();
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
  const artikelById = Object.fromEntries(appData.katalog.artikel.map((a) => [a.id, a]));
  const rows = Object.entries(appData.bestellungen)
    .map(([username, b]) => Object.assign({ username }, b))
    .sort((a, b) => `${a.vorname} ${a.nachname}`.localeCompare(`${b.vorname} ${b.nachname}`, "de"));
  document.getElementById("uebersicht-empty").style.display = rows.length ? "none" : "block";
  document.getElementById("uebersicht-rows").innerHTML = rows.map((r) => `
    <div class="confirm-row">
      <div class="confirm-row-info">
        <span class="confirm-name">${escapeHtml(r.vorname + " " + r.nachname)}</span>
        <span class="muted">${escapeHtml(positionenLabel(r.positionen, artikelById))}</span>
        <span class="muted">Zuletzt geändert: ${escapeHtml(fmtDate(r.letzteAenderung))}${r.kommentar ? " — " + escapeHtml(r.kommentar) : ""}</span>
      </div>
      <button type="button" class="btn secondary small btn-delete-bestellung" data-username="${escapeHtml(r.username)}">Löschen</button>
    </div>
  `).join("");
}

async function deleteBestellung(username) {
  if (!canAdmin()) return;
  const entry = appData.bestellungen[username];
  if (!entry) return;
  const name = `${entry.vorname} ${entry.nachname}`.trim() || username;
  if (!confirm(`Bestellung von ${name} wirklich löschen?`)) return;
  showUebersichtError("");
  try {
    await saveWithConflictRetry((data) => { delete data.bestellungen[username]; });
  } catch (e) {
    showUebersichtError("Löschen fehlgeschlagen: " + e.message);
    return;
  }
  renderBestellungsuebersicht();
  if (username === currentUsername) renderMeineBestellung();
}

// ---------- Tab "Einstellungen": Export ----------

function groessenIndex(artikelById, artikelId, groesse) {
  const artikel = artikelById[artikelId];
  if (!artikel) return 999;
  const idx = artikel.groessen.indexOf(groesse);
  return idx === -1 ? 999 : idx;
}

function exportZeilen() {
  const map = new Map();
  for (const b of Object.values(appData.bestellungen)) {
    for (const p of (b.positionen || [])) {
      if (!p.menge) continue;
      const key = p.artikelId + "" + p.groesse;
      map.set(key, (map.get(key) || 0) + Number(p.menge));
    }
  }
  const artikelById = Object.fromEntries(appData.katalog.artikel.map((a) => [a.id, a]));
  return [...map.entries()]
    .map(([key, summe]) => {
      const [artikelId, groesse] = key.split("");
      const artikel = artikelById[artikelId];
      return {
        artikelId,
        groesse,
        summe,
        artikelName: artikel ? artikel.name : `(gelöscht: ${artikelId})`
      };
    })
    .sort((a, b) => a.artikelName.localeCompare(b.artikelName, "de") ||
      groessenIndex(artikelById, a.artikelId, a.groesse) - groessenIndex(artikelById, b.artikelId, b.groesse));
}

function exportText() {
  const zeilen = exportZeilen();
  if (!zeilen.length) { alert("Es liegen noch keine Bestellungen vor."); return; }
  const fields = [
    { label: "Artikel", key: "artikelName", num: false },
    { label: "Größe", key: "groesse", num: false },
    { label: "Menge", key: "summe", num: true }
  ];
  const widths = fields.map((f) => Math.max(f.label.length, ...zeilen.map((z) => String(z[f.key]).length)));
  const line = (cells) => cells.map((c, i) => {
    const s = String(c);
    return fields[i].num ? s.padStart(widths[i]) : s.padEnd(widths[i]);
  }).join("  ");
  const sepLine = widths.map((w) => "-".repeat(w)).join("  ");
  let out = `Kleiderbestellung — Zusammenfassung\n`;
  out += `Erstellt am ${new Date().toLocaleString("de-DE")}\n\n`;
  out += line(fields.map((f) => f.label)) + "\n" + sepLine + "\n";
  out += zeilen.map((z) => line(fields.map((f) => z[f.key]))).join("\n") + "\n";
  const gesamt = zeilen.reduce((a, z) => a + z.summe, 0);
  out += sepLine + "\n" + `Gesamt: ${gesamt} Stück\n`;
  download(`kleiderbestellung_${localDateIso()}.txt`, "text/plain", "﻿" + out);
}

function exportPdf() {
  const zeilen = exportZeilen();
  if (!zeilen.length) { alert("Es liegen noch keine Bestellungen vor."); return; }
  const theadHtml = `<tr><th>Artikel</th><th>Größe</th><th class="num">Menge</th></tr>`;
  const rowsHtml = zeilen.map((z) => `<tr><td>${escapeHtml(z.artikelName)}</td><td>${escapeHtml(z.groesse)}</td><td class="num">${escapeHtml(z.summe)}</td></tr>`).join("");
  const gesamt = zeilen.reduce((a, z) => a + z.summe, 0);
  const totalRow = `<tr class="total-row"><td>Gesamt</td><td></td><td class="num">${escapeHtml(gesamt)}</td></tr>`;
  document.getElementById("print-content").innerHTML = `
    <h1>👕 Kleiderbestellung</h1>
    <p class="print-meta">Zusammenfassung nach Artikel und Größe — erstellt am ${new Date().toLocaleString("de-DE")}</p>
    <table class="print-table">
      <thead>${theadHtml}</thead>
      <tbody>${rowsHtml}${totalRow}</tbody>
    </table>`;
  document.body.classList.add("printing-report");
  const cleanup = () => { document.body.classList.remove("printing-report"); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  setTimeout(() => window.print(), 150);
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
  document.getElementById("version-badge").textContent = "v" + APP_VERSION;
  document.getElementById("version-badge-2").textContent = "v" + APP_VERSION;
  renderChangelog();
  setupTabs();

  document.getElementById("btn-submit").addEventListener("click", submitBestellung);
  document.getElementById("btn-toggle-fenster").addEventListener("click", toggleBestellfenster);
  document.getElementById("btn-add-artikel").addEventListener("click", addArtikel);
  document.getElementById("btn-export-text").addEventListener("click", exportText);
  document.getElementById("btn-export-pdf").addEventListener("click", exportPdf);

  document.getElementById("katalog-rows").addEventListener("click", (e) => {
    const row = e.target.closest(".katalog-row");
    if (!row) return;
    const artikelId = row.dataset.artikelId;
    if (e.target.closest(".btn-save-artikel")) {
      const name = row.querySelector(".katalog-name").value.trim();
      const groessen = row.querySelector(".katalog-groessen").value.split(",").map((s) => s.trim()).filter(Boolean);
      const standardMenge = Number(row.querySelector(".katalog-menge").value) || 1;
      const aktiv = row.querySelector(".katalog-aktiv").checked;
      if (!name || !groessen.length) { showKatalogError("Name und mindestens eine Größe erforderlich."); return; }
      updateArtikel(artikelId, { name, groessen, standardMenge, aktiv });
    } else if (e.target.closest(".btn-delete-artikel")) {
      deleteArtikel(artikelId);
    }
  });

  document.getElementById("uebersicht-rows").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete-bestellung");
    if (btn) deleteBestellung(btn.dataset.username);
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
    if (canAdmin()) {
      renderFensterEinstellungen();
      renderKatalogVerwaltung();
      renderBestellungsuebersicht();
    }
  } catch (e) {
    if (e instanceof NotLoggedInError) {
      showConnectScreen();
    } else {
      showConnectScreen("Fehler beim Laden: " + e.message);
    }
  }
}

window.addEventListener("DOMContentLoaded", () => { init(); });
