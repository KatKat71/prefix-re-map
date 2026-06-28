const SUPABASE_URL = "https://peypgkgorkcczrpymguk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleXBna2dvcmtjY3pycHltZ3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM2MDYsImV4cCI6MjA5ODIzOTYwNn0.B7k6VkzjG2be5_CAumB0GFbfg-j2SX2AIS0FUomluc8";
const SUPABASE_TABLE_URL = `${SUPABASE_URL}/rest/v1/stadtbefunde`;

const CATEGORY_CONFIG = {
  ar: { label: "ar-", color: "#b54d2f" },
  re_ri: { label: "re-/ri-", color: "#275fab" },
  beide: { label: "beide", color: "#6b4ca3" },
  unklar: { label: "unklar", color: "#b18b33" },
  keine_daten: { label: "keine Daten", color: "#7f889b" },
};

const state = {
  entries: [],
  filteredEntries: [],
  selectedId: null,
  loading: false,
  filters: {
    suche: "",
    region: "alle",
    status: "alle",
    kategorien: Object.keys(CATEGORY_CONFIG),
  },
};

const elements = {
  statsGrid: document.getElementById("stats-grid"),
  legend: document.getElementById("legend"),
  searchInput: document.getElementById("search-input"),
  regionFilter: document.getElementById("region-filter"),
  statusFilter: document.getElementById("status-filter"),
  categoryCheckboxes: [...document.querySelectorAll(".checkbox-group input[type='checkbox']")],
  tableBody: document.getElementById("table-body"),
  tableCount: document.getElementById("table-count"),
  form: document.getElementById("entry-form"),
  formTitle: document.getElementById("form-title"),
  entryId: document.getElementById("entry-id"),
  city: document.getElementById("city-input"),
  region: document.getElementById("region-input"),
  category: document.getElementById("category-input"),
  entryStatus: document.getElementById("entry-status-input"),
  lemma: document.getElementById("lemma-input"),
  attestation: document.getElementById("attestation-input"),
  source: document.getElementById("source-input"),
  comment: document.getElementById("comment-input"),
  updatedAt: document.getElementById("updated-at"),
  syncStatus: document.getElementById("sync-status"),
  newEntryButton: document.getElementById("new-entry-button"),
  resetFormButton: document.getElementById("reset-form-button"),
  resetFiltersButton: document.getElementById("reset-filters-button"),
  deleteEntryButton: document.getElementById("delete-entry-button"),
  fitMapButton: document.getElementById("fit-map-button"),
  reloadDataButton: document.getElementById("reload-data-button"),
  exportCsvButton: document.getElementById("export-csv-button"),
  exportXlsxButton: document.getElementById("export-xlsx-button"),
};

const map = L.map("map", { zoomControl: true }).setView([42.5, 12.5], 6);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const markerRefs = new Map();

function setSyncStatus(message, stateName = "loading") {
  elements.syncStatus.textContent = message;
  elements.syncStatus.dataset.state = stateName;
}

function getRequestHeaders(hasBody = false, extraHeaders = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extraHeaders,
  };
  if (hasBody) headers["Content-Type"] = "application/json";
  return headers;
}

async function supabaseRequest(path = "", options = {}) {
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const response = await fetch(`${SUPABASE_TABLE_URL}${path}`, {
    method,
    headers: getRequestHeaders(hasBody, options.headers || {}),
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Supabase-Fehler (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function mapRowToEntry(row) {
  return {
    id: row.id,
    ort: row.ort,
    region: row.region,
    breitengrad: Number(row.breitengrad),
    laengengrad: Number(row.laengengrad),
    kategorie: row.kategorie,
    belegform: row.belegform || "",
    lemma: row.lemma || "",
    quelle: row.quelle || "",
    kommentar: row.kommentar || "",
    status: row.status,
    aktualisiertAm: row.aktualisiert_am,
  };
}

function mapEntryToRow(entry) {
  return {
    id: entry.id,
    ort: entry.ort,
    region: entry.region,
    breitengrad: entry.breitengrad,
    laengengrad: entry.laengengrad,
    kategorie: entry.kategorie,
    belegform: entry.belegform || null,
    lemma: entry.lemma || null,
    quelle: entry.quelle || null,
    kommentar: entry.kommentar || null,
    status: entry.status,
  };
}

async function loadEntriesFromSupabase() {
  state.loading = true;
  setSyncStatus("Lade gemeinsamen Datenbestand aus Supabase.", "loading");
  const rows = await supabaseRequest("?select=*&order=ort.asc&order=region.asc");
  state.entries = rows.map(mapRowToEntry);
  state.loading = false;
  setSyncStatus(`${state.entries.length} Orte aus der gemeinsamen Datenbank geladen.`, "success");
}

function getStats() {
  const counts = { gesamt: state.entries.length };
  Object.keys(CATEGORY_CONFIG).forEach((category) => {
    counts[category] = state.entries.filter((entry) => entry.kategorie === category).length;
  });
  return counts;
}

function renderStats() {
  const stats = getStats();
  const cards = [
    ["gesamt", "Orte gesamt", "#0d2853"],
    ["ar", "ar-", CATEGORY_CONFIG.ar.color],
    ["re_ri", "re-/ri-", CATEGORY_CONFIG.re_ri.color],
    ["beide", "beide", CATEGORY_CONFIG.beide.color],
    ["unklar", "unklar", CATEGORY_CONFIG.unklar.color],
    ["keine_daten", "keine Daten", CATEGORY_CONFIG.keine_daten.color],
  ];
  elements.statsGrid.innerHTML = cards
    .map(
      ([key, label, color]) => `
        <article class="stat-card">
          <span class="badge"><span class="dot" style="background:${color}"></span>${label}</span>
          <strong>${stats[key]}</strong>
        </article>
      `,
    )
    .join("");
}

function renderLegend() {
  elements.legend.innerHTML = Object.entries(CATEGORY_CONFIG)
    .map(
      ([key, config]) =>
        `<span class="legend-item"><span class="dot" style="background:${config.color}"></span>${config.label}</span>`,
    )
    .join("");
}

function populateRegionFilter() {
  const regions = [...new Set(state.entries.map((entry) => entry.region).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  elements.regionFilter.innerHTML =
    `<option value="alle">Alle Regionen</option>` +
    regions.map((region) => `<option value="${region}">${region}</option>`).join("");
  elements.regionFilter.value = regions.includes(state.filters.region) ? state.filters.region : "alle";
}

function filterEntries() {
  const query = state.filters.suche.trim().toLowerCase();
  state.filteredEntries = state.entries.filter((entry) => {
    const matchesRegion = state.filters.region === "alle" || entry.region === state.filters.region;
    const matchesStatus = state.filters.status === "alle" || entry.status === state.filters.status;
    const matchesCategory = state.filters.kategorien.includes(entry.kategorie);
    const haystack = [
      entry.ort,
      entry.region,
      entry.lemma,
      entry.belegform,
      entry.quelle,
      entry.kommentar,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    return matchesRegion && matchesStatus && matchesCategory && matchesSearch;
  });
}

function createPopup(entry) {
  return `
    <div>
      <p class="popup-title">${entry.ort}</p>
      <p class="popup-text">${entry.region} | ${CATEGORY_CONFIG[entry.kategorie].label}</p>
      <p class="popup-text">${entry.lemma || "Kein Lemma eingetragen"}</p>
    </div>
  `;
}

function renderMarkers() {
  markerLayer.clearLayers();
  markerRefs.clear();
  state.filteredEntries.forEach((entry) => {
    const marker = L.circleMarker([entry.breitengrad, entry.laengengrad], {
      radius: state.selectedId === entry.id ? 11 : 8,
      fillColor: CATEGORY_CONFIG[entry.kategorie].color,
      color: "#fff9ec",
      weight: state.selectedId === entry.id ? 3 : 2,
      fillOpacity: 0.92,
    });
    marker.bindPopup(createPopup(entry));
    marker.on("click", () => selectEntry(entry.id, true));
    markerRefs.set(entry.id, marker);
    markerLayer.addLayer(marker);
  });
  if (state.selectedId && markerRefs.has(state.selectedId)) {
    markerRefs.get(state.selectedId).openPopup();
  }
}

function renderTable() {
  elements.tableCount.textContent = `${state.filteredEntries.length} Eintraege sichtbar`;
  elements.tableBody.innerHTML = state.filteredEntries
    .slice()
    .sort((a, b) => a.ort.localeCompare(b.ort, "de"))
    .map(
      (entry) => `
        <tr data-id="${entry.id}" class="${state.selectedId === entry.id ? "is-active" : ""}">
          <td>${entry.ort}</td>
          <td>${entry.region}</td>
          <td>
            <span class="category-pill">
              <span class="dot" style="background:${CATEGORY_CONFIG[entry.kategorie].color}"></span>
              ${CATEGORY_CONFIG[entry.kategorie].label}
            </span>
          </td>
          <td>${entry.status}</td>
        </tr>
      `,
    )
    .join("");
  elements.tableBody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => selectEntry(row.dataset.id, true));
  });
}

function fillForm(entry) {
  elements.formTitle.textContent = entry ? `${entry.ort} bearbeiten` : "Neuen Ort erfassen";
  elements.entryId.value = entry?.id || "";
  elements.city.value = entry?.ort || "";
  elements.region.value = entry?.region || "";


  elements.category.value = entry?.kategorie || "keine_daten";
  elements.entryStatus.value = entry?.status || "offen";
  elements.lemma.value = entry?.lemma || "";
  elements.attestation.value = entry?.belegform || "";
  elements.source.value = entry?.quelle || "";
  elements.comment.value = entry?.kommentar || "";
  elements.updatedAt.textContent = entry?.aktualisiertAm
    ? `Zuletzt aktualisiert: ${new Date(entry.aktualisiertAm).toLocaleString("de-DE")}`
    : "Noch nicht gespeichert.";
}

function selectEntry(entryId, focusMap = false) {
  state.selectedId = entryId;
  const entry = state.entries.find((item) => item.id === entryId) || null;
  fillForm(entry);
  refreshView();
  if (entry && focusMap) {
    map.flyTo([entry.breitengrad, entry.laengengrad], Math.max(map.getZoom(), 7), { duration: 0.5 });
  }
}

function resetForm() {
  state.selectedId = null;
  fillForm(null);
  refreshView();
}

function fitMapToFiltered() {
  if (!state.filteredEntries.length) return;
  const bounds = L.latLngBounds(state.filteredEntries.map((entry) => [entry.breitengrad, entry.laengengrad]));
  map.fitBounds(bounds.pad(0.18));
}

function refreshView() {
  populateRegionFilter();
  filterEntries();
  renderStats();
  renderLegend();
  renderMarkers();
  renderTable();
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function exportRows() {
  return state.entries.map((entry) => ({
    Ort: entry.ort,
    Region: entry.region,

    Kategorie: CATEGORY_CONFIG[entry.kategorie].label,
    Lemma: entry.lemma,
    Belegform: entry.belegform,
    Quelle: entry.quelle,
    Kommentar: entry.kommentar,
    Status: entry.status,
    AktualisiertAm: entry.aktualisiertAm,
  }));
}

function exportCsv() {
  const rows = exportRows();
  const headers = Object.keys(rows[0] || {});
  const csv = [headers.join(";")]
    .concat(
      rows.map((row) =>
        headers
          .map((header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`)
          .join(";"),
      ),
    )
    .join("\n");
  downloadFile(`verbkarte-italien-${timestamp()}.csv`, csv, "text/csv;charset=utf-8");
}

function exportXlsx() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows());
  XLSX.utils.book_append_sheet(workbook, worksheet, "Verbkarte");
  XLSX.writeFile(workbook, `verbkarte-italien-${timestamp()}.xlsx`);
}

function readFormData() {
  const existingEntry = state.entries.find((item) => item.id === elements.entryId.value);
  const coordinates = existingEntry
    ? { breitengrad: existingEntry.breitengrad, laengengrad: existingEntry.laengengrad }
    : { breitengrad: map.getCenter().lat, laengengrad: map.getCenter().lng };

  return {
    id: elements.entryId.value || crypto.randomUUID(),
    ort: elements.city.value.trim(),
    region: elements.region.value.trim(),
    breitengrad: Number(coordinates.breitengrad.toFixed(4)),
    laengengrad: Number(coordinates.laengengrad.toFixed(4)),
    kategorie: elements.category.value,
    lemma: elements.lemma.value.trim(),
    belegform: elements.attestation.value.trim(),
    quelle: elements.source.value.trim(),
    kommentar: elements.comment.value.trim(),
    status: elements.entryStatus.value,
    aktualisiertAm: new Date().toISOString(),
  };
}

function upsertLocalEntry(entry) {
  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) state.entries.splice(existingIndex, 1, entry);
  else state.entries.push(entry);
}

async function upsertEntry(event) {
  event.preventDefault();
  const entry = readFormData();
  const exists = state.entries.some((item) => item.id === entry.id);
  setSyncStatus(`${exists ? "Aktualisiere" : "Speichere"} Datensatz in Supabase.`, "loading");

  try {
    const path = exists ? `?id=eq.${encodeURIComponent(entry.id)}` : "";
    const rows = await supabaseRequest(path, {
      method: exists ? "PATCH" : "POST",
      body: mapEntryToRow(entry),
      headers: { Prefer: "return=representation" },
    });
    const savedEntry = mapRowToEntry(Array.isArray(rows) ? rows[0] : rows);
    upsertLocalEntry(savedEntry);
    state.selectedId = savedEntry.id;
    refreshView();
    fillForm(savedEntry);
    map.flyTo([savedEntry.breitengrad, savedEntry.laengengrad], Math.max(map.getZoom(), 7), { duration: 0.5 });
    setSyncStatus(`Datensatz fuer ${savedEntry.ort} wurde gemeinsam gespeichert.`, "success");
  } catch (error) {
    setSyncStatus(`Speichern fehlgeschlagen: ${error.message}`, "error");
  }
}

async function deleteEntry() {
  if (!state.selectedId) return;
  const entry = state.entries.find((item) => item.id === state.selectedId);
  if (!entry) return;

  setSyncStatus(`Loesche Datensatz fuer ${entry.ort}.`, "loading");
  try {
    await supabaseRequest(`?id=eq.${encodeURIComponent(entry.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    resetForm();
    setSyncStatus(`Datensatz fuer ${entry.ort} wurde geloescht.`, "success");
  } catch (error) {
    setSyncStatus(`Loeschen fehlgeschlagen: ${error.message}`, "error");
  }
}

async function reloadEntries() {
  try {
    await loadEntriesFromSupabase();
    if (state.selectedId && !state.entries.some((entry) => entry.id === state.selectedId)) {
      state.selectedId = null;
      fillForm(null);
    }
    refreshView();
    fitMapToFiltered();
  } catch (error) {
    setSyncStatus(`Laden fehlgeschlagen: ${error.message}`, "error");
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.suche = event.target.value;
    refreshView();
  });

  elements.regionFilter.addEventListener("change", (event) => {
    state.filters.region = event.target.value;
    refreshView();
  });

  elements.statusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    refreshView();
  });

  elements.categoryCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.filters.kategorien = elements.categoryCheckboxes.filter((item) => item.checked).map((item) => item.value);
      if (!state.filters.kategorien.length) {
        checkbox.checked = true;
        state.filters.kategorien = [checkbox.value];
      }
      refreshView();
    });
  });

  elements.form.addEventListener("submit", upsertEntry);
  elements.newEntryButton.addEventListener("click", resetForm);
  elements.resetFormButton.addEventListener("click", resetForm);
  elements.deleteEntryButton.addEventListener("click", deleteEntry);
  elements.fitMapButton.addEventListener("click", fitMapToFiltered);
  elements.reloadDataButton.addEventListener("click", reloadEntries);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportXlsxButton.addEventListener("click", exportXlsx);
  elements.resetFiltersButton.addEventListener("click", () => {
    state.filters = {
      suche: "",
      region: "alle",
      status: "alle",
      kategorien: Object.keys(CATEGORY_CONFIG),
    };
    elements.searchInput.value = "";
    elements.statusFilter.value = "alle";
    elements.categoryCheckboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });
    refreshView();
    fitMapToFiltered();
  });


}

async function init() {
  bindEvents();
  fillForm(null);
  renderLegend();
  renderStats();
  await reloadEntries();
}

init();


