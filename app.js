const STORAGE_KEY = "verbkarte-italien-daten";

const CATEGORY_CONFIG = {
  ar: { label: "ar-", color: "#b54d2f" },
  re_ri: { label: "re-/ri-", color: "#275fab" },
  beide: { label: "beide", color: "#6b4ca3" },
  unklar: { label: "unklar", color: "#b18b33" },
  keine_daten: { label: "keine Daten", color: "#7f889b" },
};

const seedEntries = [
  ["Rom", "Latium", 41.9028, 12.4964],
  ["Mailand", "Lombardei", 45.4642, 9.19],
  ["Turin", "Piemont", 45.0703, 7.6869],
  ["Genua", "Ligurien", 44.4056, 8.9463],
  ["Venedig", "Venetien", 45.4408, 12.3155],
  ["Triest", "Friaul-Julisch Venetien", 45.6495, 13.7768],
  ["Bologna", "Emilia-Romagna", 44.4949, 11.3426],
  ["Florenz", "Toskana", 43.7696, 11.2558],
  ["Perugia", "Umbrien", 43.1107, 12.3908],
  ["Ancona", "Marken", 43.6158, 13.5189],
  ["Neapel", "Kampanien", 40.8518, 14.2681],
  ["Bari", "Apulien", 41.1171, 16.8719],
  ["Potenza", "Basilikata", 40.6401, 15.8051],
  ["Catanzaro", "Kalabrien", 38.9098, 16.5877],
  ["Palermo", "Sizilien", 38.1157, 13.3615],
  ["Cagliari", "Sardinien", 39.2238, 9.1217],
  ["Trient", "Trentino-Suedtirol", 46.0748, 11.1217],
  ["L'Aquila", "Abruzzen", 42.3498, 13.3995],
].map(([ort, region, breitengrad, laengengrad], index) => ({
  id: `seed-${index + 1}`,
  ort,
  region,
  breitengrad,
  laengengrad,
  kategorie: "keine_daten",
  belegform: "",
  lemma: "",
  quelle: "",
  kommentar: "",
  status: "offen",
  aktualisiertAm: new Date().toISOString(),
}));

const state = {
  entries: [],
  filteredEntries: [],
  selectedId: null,
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
  lat: document.getElementById("lat-input"),
  lng: document.getElementById("lng-input"),
  category: document.getElementById("category-input"),
  entryStatus: document.getElementById("entry-status-input"),
  lemma: document.getElementById("lemma-input"),
  attestation: document.getElementById("attestation-input"),
  source: document.getElementById("source-input"),
  comment: document.getElementById("comment-input"),
  updatedAt: document.getElementById("updated-at"),
  newEntryButton: document.getElementById("new-entry-button"),
  resetFormButton: document.getElementById("reset-form-button"),
  resetFiltersButton: document.getElementById("reset-filters-button"),
  deleteEntryButton: document.getElementById("delete-entry-button"),
  fitMapButton: document.getElementById("fit-map-button"),
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

function loadEntries() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [...seedEntries];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [...seedEntries];
  } catch {
    return [...seedEntries];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
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
  elements.lat.value = entry?.breitengrad ?? map.getCenter().lat.toFixed(4);
  elements.lng.value = entry?.laengengrad ?? map.getCenter().lng.toFixed(4);
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
    Breitengrad: entry.breitengrad,
    Laengengrad: entry.laengengrad,
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
  return {
    id: elements.entryId.value || `entry-${crypto.randomUUID()}`,
    ort: elements.city.value.trim(),
    region: elements.region.value.trim(),
    breitengrad: Number(elements.lat.value),
    laengengrad: Number(elements.lng.value),
    kategorie: elements.category.value,
    lemma: elements.lemma.value.trim(),
    belegform: elements.attestation.value.trim(),
    quelle: elements.source.value.trim(),
    kommentar: elements.comment.value.trim(),
    status: elements.entryStatus.value,
    aktualisiertAm: new Date().toISOString(),
  };
}

function upsertEntry(event) {
  event.preventDefault();
  const entry = readFormData();
  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) state.entries.splice(existingIndex, 1, entry);
  else state.entries.push(entry);
  state.selectedId = entry.id;
  saveEntries();
  refreshView();
  fillForm(entry);
  map.flyTo([entry.breitengrad, entry.laengengrad], Math.max(map.getZoom(), 7), { duration: 0.5 });
}

function deleteEntry() {
  if (!state.selectedId) return;
  state.entries = state.entries.filter((entry) => entry.id !== state.selectedId);
  saveEntries();
  resetForm();
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

  map.on("click", (event) => {
    elements.lat.value = event.latlng.lat.toFixed(4);
    elements.lng.value = event.latlng.lng.toFixed(4);
  });
}

function init() {
  state.entries = loadEntries();
  bindEvents();
  fillForm(null);
  refreshView();
  fitMapToFiltered();
}

init();
