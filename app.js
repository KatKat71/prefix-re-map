const SUPABASE_URL = "https://peypgkgorkcczrpymguk.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBleXBna2dvcmtjY3pycHltZ3VrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NjM2MDYsImV4cCI6MjA5ODIzOTYwNn0.B7k6VkzjG2be5_CAumB0GFbfg-j2SX2AIS0FUomluc8";

const SUPABASE_PLACES_URL = `${SUPABASE_URL}/rest/v1/stadtbefunde`;
const SUPABASE_BELEGE_URL = `${SUPABASE_URL}/rest/v1/belege`;

const PRAEFIX_CONFIG = {
  ar: { label: "ar-", color: "#b54d2f" },
  re: { label: "re-", color: "#275fab" },
  ri: { label: "ri-", color: "#1c7c73" },
  r: { label: "r-", color: "#215e2d" },
  are: { label: "are-", color: "#6b4ca3" },
  arre: { label: "arre-", color: "#9b4d86" },
  unklar: { label: "unklar", color: "#b18b33" },
  gemischt: { label: "gemischt", color: "#39465f" },
  keine_daten: { label: "keine Daten", color: "#7f889b" },
};

const ANALYSE_CONFIG = {
  basis_re: { label: "basis_re", color: "#275fab" },
  re_synkope_r: { label: "re_synkope_r", color: "#215e2d" },
  r_prothese_ar: { label: "r_prothese_ar", color: "#b54d2f" },
  re_prothese_are_arre: { label: "re_prothese_are_arre", color: "#6b4ca3" },
  are_synkope_ar: { label: "are_synkope_ar", color: "#9b4d86" },
  unklar: { label: "unklar", color: "#b18b33" },
  gemischt: { label: "gemischt", color: "#39465f" },
  keine_daten: { label: "keine Daten", color: "#7f889b" },
};

const SICHERHEIT_WEIGHT = {
  sicher: 1,
  wahrscheinlich: 0.6,
  unsicher: 0.3,
};

const state = {
  places: [],
  belege: [],
  filteredBelege: [],
  derivedPlaces: [],
  selectedPlaceId: null,
  selectedBelegId: null,
  mapMode: "praefix",
  filters: {
    suche: "",
    region: "alle",
    praefix: Object.keys(PRAEFIX_CONFIG).filter((key) => !["gemischt", "keine_daten"].includes(key)),
    analyse: "alle",
    diasystematik: "alle",
    zeitstufe: "alle",
    rew: "alle",
    sicherheit: "alle",
    quelle: "",
  },
};

const elements = {
  statsGrid: document.getElementById("stats-grid"),
  legend: document.getElementById("legend"),
  searchInput: document.getElementById("search-input"),
  regionFilter: document.getElementById("region-filter"),
  mapMode: document.getElementById("map-mode"),
  praefixCheckboxes: [...document.querySelectorAll(".checkbox-group input[type='checkbox']")],
  analysisFilter: document.getElementById("analysis-filter"),
  diasystematikFilter: document.getElementById("diasystematik-filter"),
  zeitstufeFilter: document.getElementById("zeitstufe-filter"),
  rewFilter: document.getElementById("rew-filter"),
  sicherheitFilter: document.getElementById("sicherheit-filter"),
  quelleFilter: document.getElementById("quelle-filter"),
  tableBody: document.getElementById("table-body"),
  tableCount: document.getElementById("table-count"),
  belegeCount: document.getElementById("belege-count"),
  belegeBody: document.getElementById("belege-body"),
  syncStatus: document.getElementById("sync-status"),
  reloadDataButton: document.getElementById("reload-data-button"),
  exportCsvButton: document.getElementById("export-csv-button"),
  exportXlsxButton: document.getElementById("export-xlsx-button"),
  resetFiltersButton: document.getElementById("reset-filters-button"),
  fitMapButton: document.getElementById("fit-map-button"),
  newPlaceButton: document.getElementById("new-entry-button"),
  resetPlaceButton: document.getElementById("reset-form-button"),
  placeForm: document.getElementById("place-form"),
  placeId: document.getElementById("place-id"),
  placeCity: document.getElementById("city-input"),
  placeRegion: document.getElementById("region-input"),
  placeUpdatedAt: document.getElementById("place-updated-at"),
  deletePlaceButton: document.getElementById("delete-place-button"),
  newBelegButton: document.getElementById("new-beleg-button"),
  resetBelegButton: document.getElementById("reset-beleg-button"),
  belegFormTitle: document.getElementById("beleg-form-title"),
  belegForm: document.getElementById("beleg-form"),
  belegId: document.getElementById("beleg-id"),
  belegLemma: document.getElementById("beleg-lemma"),
  belegRew: document.getElementById("beleg-rew"),
  belegPraefix: document.getElementById("beleg-praefix"),
  belegAnalyse: document.getElementById("beleg-analyse"),
  belegDiasystematik: document.getElementById("beleg-diasystematik"),
  belegZeitstufe: document.getElementById("beleg-zeitstufe"),
  belegSicherheit: document.getElementById("beleg-sicherheit"),
  belegBelegform: document.getElementById("beleg-belegform"),
  belegItalienisch: document.getElementById("beleg-italienisch"),
  belegQuelle: document.getElementById("beleg-quelle"),
  belegSeite: document.getElementById("beleg-seite"),
  belegKommentar: document.getElementById("beleg-kommentar"),
  belegUpdatedAt: document.getElementById("beleg-updated-at"),
  deleteBelegButton: document.getElementById("delete-beleg-button"),
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

async function supabaseRequest(baseUrl, path = "", options = {}) {
  const method = options.method || "GET";
  const hasBody = options.body !== undefined;
  const response = await fetch(`${baseUrl}${path}`, {
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

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function mapPlaceRow(row) {
  return {
    id: row.id,
    ort: row.ort,
    region: row.region,
    breitengrad: Number(row.breitengrad),
    laengengrad: Number(row.laengengrad),
    aktualisiertAm: row.aktualisiert_am,
  };
}

function mapBelegRow(row) {
  return {
    id: row.id,
    ortId: row.ort_id,
    lemma: row.lemma || "",
    rewStatus: row.rew_status,
    belegform: row.belegform || "",
    italienisch: row.italienisch || "",
    praefixForm: row.praefix_form,
    analyseTyp: row.analyse_typ,
    diasystematik: row.diasystematik,
    zeitstufe: row.zeitstufe,
    sicherheit: row.sicherheit,
    quelleKurztitel: row.quelle_kurztitel || "",
    seitenangabe: row.seitenangabe || "",
    kommentar: row.kommentar || "",
    erstelltAm: row.erstellt_am,
    aktualisiertAm: row.aktualisiert_am,
  };
}

function mapBelegToRow(beleg) {
  return {
    id: beleg.id,
    ort_id: beleg.ortId,
    lemma: beleg.lemma || null,
    rew_status: beleg.rewStatus,
    belegform: beleg.belegform || null,
    italienisch: beleg.italienisch || null,
    praefix_form: beleg.praefixForm,
    analyse_typ: beleg.analyseTyp,
    diasystematik: beleg.diasystematik,
    zeitstufe: beleg.zeitstufe,
    sicherheit: beleg.sicherheit,
    quelle_kurztitel: beleg.quelleKurztitel || null,
    seitenangabe: beleg.seitenangabe || null,
    kommentar: beleg.kommentar || null,
  };
}

async function loadPlaces() {
  const rows = await supabaseRequest(
    SUPABASE_PLACES_URL,
    "?select=id,ort,region,breitengrad,laengengrad,aktualisiert_am&order=ort.asc",
  );
  state.places = rows.map(mapPlaceRow);
}

async function loadBelege() {
  const rows = await supabaseRequest(SUPABASE_BELEGE_URL, "?select=*&order=aktualisiert_am.desc");
  state.belege = rows.map(mapBelegRow);
}

function applyBelegFilters() {
  const query = normalize(state.filters.suche);
  const quelleQuery = normalize(state.filters.quelle);

  state.filteredBelege = state.belege.filter((beleg) => {
    if (state.filters.praefix.length && !state.filters.praefix.includes(beleg.praefixForm)) return false;
    if (state.filters.analyse !== "alle" && beleg.analyseTyp !== state.filters.analyse) return false;
    if (state.filters.diasystematik !== "alle" && beleg.diasystematik !== state.filters.diasystematik) return false;
    if (state.filters.zeitstufe !== "alle" && beleg.zeitstufe !== state.filters.zeitstufe) return false;
    if (state.filters.rew !== "alle" && beleg.rewStatus !== state.filters.rew) return false;

    if (state.filters.sicherheit === "sicher" && beleg.sicherheit !== "sicher") return false;
    if (state.filters.sicherheit === "wahrscheinlich" && beleg.sicherheit === "unsicher") return false;

    if (quelleQuery && !normalize(beleg.quelleKurztitel).includes(quelleQuery)) return false;

    if (!query) return true;

    const place = state.places.find((item) => item.id === beleg.ortId);
    const haystack = [
      place?.ort,
      place?.region,
      beleg.lemma,
      beleg.belegform,
      beleg.italienisch,
      beleg.quelleKurztitel,
      beleg.seitenangabe,
      beleg.kommentar,
    ]
      .filter(Boolean)
      .join(" ");

    return normalize(haystack).includes(query);
  });
}

function deriveCategoryForPlace(placeId) {
  const belege = state.filteredBelege.filter((item) => item.ortId === placeId);
  if (!belege.length) {
    return { category: "keine_daten", belegCount: 0 };
  }

  const keyName = state.mapMode === "praefix" ? "praefixForm" : "analyseTyp";
  const scores = new Map();

  belege.forEach((beleg) => {
    const key = beleg[keyName];
    const weight = SICHERHEIT_WEIGHT[beleg.sicherheit] ?? 0.3;
    scores.set(key, (scores.get(key) || 0) + weight);
  });

  const entries = [...scores.entries()];
  entries.sort((a, b) => b[1] - a[1]);
  const maxScore = entries[0][1];
  const topKeys = entries.filter(([, score]) => Math.abs(score - maxScore) < 1e-9).map(([key]) => key);

  if (topKeys.length > 1) {
    return { category: "gemischt", belegCount: belege.length };
  }

  return { category: topKeys[0], belegCount: belege.length };
}

function buildDerivedPlaces() {
  state.derivedPlaces = state.places.map((place) => {
    const derived = deriveCategoryForPlace(place.id);
    return {
      ...place,
      derivedCategory: derived.category,
      belegCount: derived.belegCount,
    };
  });
}

function filterPlaces() {
  state.derivedPlaces = state.derivedPlaces.filter((place) => {
    if (state.filters.region !== "alle" && place.region !== state.filters.region) return false;

    const query = normalize(state.filters.suche);
    if (!query) return true;

    const placeText = normalize(`${place.ort} ${place.region}`);
    if (placeText.includes(query)) return true;

    return state.filteredBelege.some((beleg) => beleg.ortId === place.id);
  });
}

function currentConfig() {
  return state.mapMode === "praefix" ? PRAEFIX_CONFIG : ANALYSE_CONFIG;
}

function renderLegend() {
  const config = currentConfig();
  const keys = Object.keys(config);
  elements.legend.innerHTML = keys
    .map(
      (key) =>
        `<span class="legend-item"><span class="dot" style="background:${config[key].color}"></span>${config[key].label}</span>`,
    )
    .join("");
}

function renderStats() {
  const config = currentConfig();
  const counts = new Map();

  state.derivedPlaces.forEach((place) => {
    counts.set(place.derivedCategory, (counts.get(place.derivedCategory) || 0) + 1);
  });

  const cards = [
    {
      key: "gesamt",
      label: "Orte gesamt",
      value: state.derivedPlaces.length,
      color: "#0d2853",
    },
    ...Object.keys(config).map((key) => ({
      key,
      label: config[key].label,
      value: counts.get(key) || 0,
      color: config[key].color,
    })),
  ];

  elements.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <article class="stat-card">
          <span class="badge"><span class="dot" style="background:${card.color}"></span>${card.label}</span>
          <strong>${card.value}</strong>
        </article>
      `,
    )
    .join("");
}

function populateRegionFilter() {
  const regions = [...new Set(state.places.map((place) => place.region).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de"),
  );
  elements.regionFilter.innerHTML =
    '<option value="alle">Alle Regionen</option>' +
    regions.map((region) => `<option value="${region}">${region}</option>`).join("");
  elements.regionFilter.value = regions.includes(state.filters.region) ? state.filters.region : "alle";
}

function createPopup(place) {
  const config = currentConfig();
  const label = config[place.derivedCategory]?.label ?? place.derivedCategory;
  return `
    <div>
      <p class="popup-title">${place.ort}</p>
      <p class="popup-text">${place.region}</p>
      <p class="popup-text">${label} | ${place.belegCount} Belege</p>
    </div>
  `;
}

function renderMarkers() {
  const config = currentConfig();

  markerLayer.clearLayers();
  markerRefs.clear();

  state.derivedPlaces.forEach((place) => {
    const marker = L.circleMarker([place.breitengrad, place.laengengrad], {
      radius: state.selectedPlaceId === place.id ? 11 : 8,
      fillColor: config[place.derivedCategory]?.color ?? config.keine_daten.color,
      color: "#fff9ec",
      weight: state.selectedPlaceId === place.id ? 3 : 2,
      fillOpacity: 0.92,
    });
    marker.bindPopup(createPopup(place));
    marker.on("click", () => selectPlace(place.id, true));
    markerRefs.set(place.id, marker);
    markerLayer.addLayer(marker);
  });

  if (state.selectedPlaceId && markerRefs.has(state.selectedPlaceId)) {
    markerRefs.get(state.selectedPlaceId).openPopup();
  }
}

function renderPlaceTable() {
  const config = currentConfig();

  elements.tableCount.textContent = `${state.derivedPlaces.length} Orte sichtbar`;
  elements.tableBody.innerHTML = state.derivedPlaces
    .slice()
    .sort((a, b) => a.ort.localeCompare(b.ort, "de"))
    .map((place) => {
      const label = config[place.derivedCategory]?.label ?? place.derivedCategory;
      const color = config[place.derivedCategory]?.color ?? config.keine_daten.color;

      return `
        <tr data-id="${place.id}" class="${state.selectedPlaceId === place.id ? "is-active" : ""}">
          <td>${place.ort}</td>
          <td>${place.region}</td>
          <td>
            <span class="category-pill">
              <span class="dot" style="background:${color}"></span>
              ${label}
            </span>
          </td>
          <td>${place.belegCount}</td>
        </tr>
      `;
    })
    .join("");

  elements.tableBody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => selectPlace(row.dataset.id, true));
  });
}

function currentPlace() {
  return state.places.find((place) => place.id === state.selectedPlaceId) || null;
}

function currentBelegeForSelected() {
  if (!state.selectedPlaceId) return [];
  return state.filteredBelege.filter((item) => item.ortId === state.selectedPlaceId);
}

function renderBelegeTable() {
  const belege = currentBelegeForSelected();

  elements.belegeCount.textContent = state.selectedPlaceId
    ? `${belege.length} Belege (nach Filter) fuer diesen Ort`
    : "Bitte zuerst einen Ort auswaehlen.";

  elements.belegeBody.innerHTML = belege
    .slice()
    .sort((a, b) => (a.lemma || "").localeCompare(b.lemma || "", "de"))
    .map(
      (beleg) => `
        <tr data-id="${beleg.id}" class="${state.selectedBelegId === beleg.id ? "is-active" : ""}">
          <td>${beleg.lemma || ""}</td>
          <td>${beleg.italienisch || ""}</td>
          <td>${beleg.praefixForm}</td>
          <td>${beleg.analyseTyp}</td>
          <td>${beleg.diasystematik}</td>
          <td>${beleg.zeitstufe}</td>
          <td>${beleg.sicherheit}</td>
          <td>${beleg.quelleKurztitel || ""}</td>
        </tr>
      `,
    )
    .join("");

  elements.belegeBody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => selectBeleg(row.dataset.id));
  });
}

function fillPlaceForm(place) {
  elements.placeId.value = place?.id || "";
  elements.placeCity.value = place?.ort || "";
  elements.placeRegion.value = place?.region || "";

  elements.placeUpdatedAt.textContent = place?.aktualisiertAm
    ? `Zuletzt aktualisiert: ${new Date(place.aktualisiertAm).toLocaleString("de-DE")}`
    : "Noch nicht gespeichert.";
}

function fillBelegForm(beleg) {
  elements.belegFormTitle.textContent = beleg ? "Beleg bearbeiten" : "Neuen Beleg erfassen";
  elements.belegId.value = beleg?.id || "";
  elements.belegLemma.value = beleg?.lemma || "";
  elements.belegRew.value = beleg?.rewStatus || "unsicher";
  elements.belegPraefix.value = beleg?.praefixForm || "ar";
  elements.belegAnalyse.value = beleg?.analyseTyp || "unklar";
  elements.belegDiasystematik.value = beleg?.diasystematik || "ohne_markierung";
  elements.belegZeitstufe.value = beleg?.zeitstufe || "undatiert";
  elements.belegSicherheit.value = beleg?.sicherheit || "unsicher";
  elements.belegBelegform.value = beleg?.belegform || "";
  elements.belegItalienisch.value = beleg?.italienisch || "";
  elements.belegQuelle.value = beleg?.quelleKurztitel || "";
  elements.belegSeite.value = beleg?.seitenangabe || "";
  elements.belegKommentar.value = beleg?.kommentar || "";

  elements.belegUpdatedAt.textContent = beleg?.aktualisiertAm
    ? `Zuletzt aktualisiert: ${new Date(beleg.aktualisiertAm).toLocaleString("de-DE")}`
    : "Noch nicht gespeichert.";
}

function resetBelegForm() {
  state.selectedBelegId = null;
  fillBelegForm(null);
}

function resetPlaceForm() {
  state.selectedPlaceId = null;
  state.selectedBelegId = null;
  fillPlaceForm(null);
  resetBelegForm();
  refreshView();
}

function selectPlace(placeId, focusMap = false) {
  state.selectedPlaceId = placeId;
  state.selectedBelegId = null;
  const place = currentPlace();
  fillPlaceForm(place);
  resetBelegForm();
  refreshView();

  if (place && focusMap) {
    map.flyTo([place.breitengrad, place.laengengrad], Math.max(map.getZoom(), 7), { duration: 0.5 });
  }
}

function selectBeleg(belegId) {
  state.selectedBelegId = belegId;
  const beleg = state.belege.find((item) => item.id === belegId) || null;
  fillBelegForm(beleg);
  renderBelegeTable();
}

function fitMapToPlaces() {
  if (!state.derivedPlaces.length) return;
  const bounds = L.latLngBounds(state.derivedPlaces.map((place) => [place.breitengrad, place.laengengrad]));
  map.fitBounds(bounds.pad(0.18));
}

function refreshView() {
  populateRegionFilter();
  applyBelegFilters();
  buildDerivedPlaces();
  filterPlaces();
  renderLegend();
  renderStats();
  renderMarkers();
  renderPlaceTable();
  renderBelegeTable();
}

async function reloadData() {
  setSyncStatus("Lade Daten aus Supabase.", "loading");
  try {
    await Promise.all([loadPlaces(), loadBelege()]);
    setSyncStatus(`Orte: ${state.places.length} | Belege: ${state.belege.length}`, "success");
    if (state.selectedPlaceId && !state.places.some((place) => place.id === state.selectedPlaceId)) {
      resetPlaceForm();
    }
    refreshView();
  } catch (error) {
    setSyncStatus(`Laden fehlgeschlagen: ${error.message}`, "error");
  }
}

function readPlaceForm() {
  const id = elements.placeId.value || crypto.randomUUID();
  const ort = elements.placeCity.value.trim();
  const region = elements.placeRegion.value.trim();
  return { id, ort, region };
}

async function savePlace(event) {
  event.preventDefault();
  const place = readPlaceForm();
  const exists = state.places.some((item) => item.id === place.id);

  setSyncStatus(`${exists ? "Aktualisiere" : "Speichere"} Ort in Supabase.`, "loading");

  try {
    if (exists) {
      const rows = await supabaseRequest(SUPABASE_PLACES_URL, `?id=eq.${encodeURIComponent(place.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: {
          ort: place.ort,
          region: place.region,
        },
      });
      const saved = mapPlaceRow(rows[0]);
      const idx = state.places.findIndex((item) => item.id === saved.id);
      state.places.splice(idx, 1, saved);
      state.selectedPlaceId = saved.id;
      fillPlaceForm(saved);
      setSyncStatus(`Ort ${saved.ort} gespeichert.`, "success");
    } else {
      const rows = await supabaseRequest(SUPABASE_PLACES_URL, "", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: {
          id: place.id,
          ort: place.ort,
          region: place.region,
          breitengrad: Number(map.getCenter().lat.toFixed(4)),
          laengengrad: Number(map.getCenter().lng.toFixed(4)),
          kategorie: "keine_daten",
          status: "offen",
          belegform: "",
          lemma: "",
          quelle: "",
          kommentar: "",
        },
      });
      const saved = mapPlaceRow(rows[0]);
      state.places.push(saved);
      state.selectedPlaceId = saved.id;
      fillPlaceForm(saved);
      setSyncStatus(`Ort ${saved.ort} angelegt.`, "success");
    }

    refreshView();
    const selectedDerived = state.derivedPlaces.find((item) => item.id === state.selectedPlaceId);
    if (selectedDerived) {
      map.flyTo([selectedDerived.breitengrad, selectedDerived.laengengrad], Math.max(map.getZoom(), 7), { duration: 0.5 });
    }
  } catch (error) {
    setSyncStatus(`Ort speichern fehlgeschlagen: ${error.message}`, "error");
  }
}

async function deletePlace() {
  const place = currentPlace();
  if (!place) return;

  setSyncStatus(`Loesche Ort ${place.ort}.`, "loading");

  try {
    await supabaseRequest(SUPABASE_PLACES_URL, `?id=eq.${encodeURIComponent(place.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    state.places = state.places.filter((item) => item.id !== place.id);
    state.belege = state.belege.filter((item) => item.ortId !== place.id);
    resetPlaceForm();
    setSyncStatus(`Ort ${place.ort} geloescht.`, "success");
    refreshView();
  } catch (error) {
    setSyncStatus(`Ort loeschen fehlgeschlagen: ${error.message}`, "error");
  }
}

function readBelegForm() {
  const id = elements.belegId.value || crypto.randomUUID();
  const ortId = state.selectedPlaceId;
  return {
    id,
    ortId,
    lemma: elements.belegLemma.value.trim(),
    rewStatus: elements.belegRew.value,
    belegform: elements.belegBelegform.value.trim(),
    italienisch: elements.belegItalienisch.value.trim(),
    praefixForm: elements.belegPraefix.value,
    analyseTyp: elements.belegAnalyse.value,
    diasystematik: elements.belegDiasystematik.value,
    zeitstufe: elements.belegZeitstufe.value,
    sicherheit: elements.belegSicherheit.value,
    quelleKurztitel: elements.belegQuelle.value.trim(),
    seitenangabe: elements.belegSeite.value.trim(),
    kommentar: elements.belegKommentar.value.trim(),
  };
}

async function saveBeleg(event) {
  event.preventDefault();
  if (!state.selectedPlaceId) {
    setSyncStatus("Bitte zuerst einen Ort auswaehlen.", "error");
    return;
  }

  const beleg = readBelegForm();
  const exists = state.belege.some((item) => item.id === beleg.id);

  setSyncStatus(`${exists ? "Aktualisiere" : "Speichere"} Beleg in Supabase.`, "loading");

  try {
    const rows = await supabaseRequest(
      SUPABASE_BELEGE_URL,
      exists ? `?id=eq.${encodeURIComponent(beleg.id)}` : "",
      {
        method: exists ? "PATCH" : "POST",
        headers: { Prefer: "return=representation" },
        body: mapBelegToRow(beleg),
      },
    );

    const saved = mapBelegRow(Array.isArray(rows) ? rows[0] : rows);
    const idx = state.belege.findIndex((item) => item.id === saved.id);
    if (idx >= 0) state.belege.splice(idx, 1, saved);
    else state.belege.push(saved);

    state.selectedBelegId = saved.id;
    fillBelegForm(saved);
    setSyncStatus("Beleg gespeichert.", "success");
    refreshView();
  } catch (error) {
    setSyncStatus(`Beleg speichern fehlgeschlagen: ${error.message}`, "error");
  }
}

async function deleteBeleg() {
  if (!state.selectedBelegId) return;
  const beleg = state.belege.find((item) => item.id === state.selectedBelegId);
  if (!beleg) return;

  setSyncStatus("Loesche Beleg.", "loading");

  try {
    await supabaseRequest(SUPABASE_BELEGE_URL, `?id=eq.${encodeURIComponent(beleg.id)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    state.belege = state.belege.filter((item) => item.id !== beleg.id);
    resetBelegForm();
    setSyncStatus("Beleg geloescht.", "success");
    refreshView();
  } catch (error) {
    setSyncStatus(`Beleg loeschen fehlgeschlagen: ${error.message}`, "error");
  }
}

function exportRows() {
  const placeById = new Map(state.places.map((place) => [place.id, place]));

  return state.filteredBelege
    .slice()
    .sort((a, b) => {
      const pa = placeById.get(a.ortId);
      const pb = placeById.get(b.ortId);
      const k1 = `${pa?.ort || ""} ${a.lemma || ""}`;
      const k2 = `${pb?.ort || ""} ${b.lemma || ""}`;
      return k1.localeCompare(k2, "de");
    })
    .map((beleg) => {
      const place = placeById.get(beleg.ortId);
      return {
        Ort: place?.ort || "",
        Region: place?.region || "",
        Lemma: beleg.lemma,
        REW_Status: beleg.rewStatus,
        Belegform: beleg.belegform,
        Italienisch: beleg.italienisch,
        Praefix_Form: beleg.praefixForm,
        Analyse_Typ: beleg.analyseTyp,
        Diasystematik: beleg.diasystematik,
        Zeitstufe: beleg.zeitstufe,
        Sicherheit: beleg.sicherheit,
        Quelle: beleg.quelleKurztitel,
        Seitenangabe: beleg.seitenangabe,
        Kommentar: beleg.kommentar,
        AktualisiertAm: beleg.aktualisiertAm,
      };
    });
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
  downloadFile(`belege-italien-${timestamp()}.csv`, csv, "text/csv;charset=utf-8");
}

function exportXlsx() {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows());
  XLSX.utils.book_append_sheet(workbook, worksheet, "Belege");
  XLSX.writeFile(workbook, `belege-italien-${timestamp()}.xlsx`);
}

function resetFilters() {
  state.filters.suche = "";
  state.filters.region = "alle";
  state.filters.praefix = Object.keys(PRAEFIX_CONFIG).filter((key) => !["gemischt", "keine_daten"].includes(key));
  state.filters.analyse = "alle";
  state.filters.diasystematik = "alle";
  state.filters.zeitstufe = "alle";
  state.filters.rew = "alle";
  state.filters.sicherheit = "alle";
  state.filters.quelle = "";

  elements.searchInput.value = "";
  elements.quelleFilter.value = "";
  elements.analysisFilter.value = "alle";
  elements.diasystematikFilter.value = "alle";
  elements.zeitstufeFilter.value = "alle";
  elements.rewFilter.value = "alle";
  elements.sicherheitFilter.value = "alle";
  elements.regionFilter.value = "alle";
  elements.praefixCheckboxes.forEach((checkbox) => {
    checkbox.checked = true;
  });

  refreshView();
  fitMapToPlaces();
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.suche = event.target.value;
    refreshView();
  });

  elements.quelleFilter.addEventListener("input", (event) => {
    state.filters.quelle = event.target.value;
    refreshView();
  });

  elements.regionFilter.addEventListener("change", (event) => {
    state.filters.region = event.target.value;
    refreshView();
  });

  elements.mapMode.addEventListener("change", (event) => {
    state.mapMode = event.target.value;
    refreshView();
  });

  elements.analysisFilter.addEventListener("change", (event) => {
    state.filters.analyse = event.target.value;
    refreshView();
  });

  elements.diasystematikFilter.addEventListener("change", (event) => {
    state.filters.diasystematik = event.target.value;
    refreshView();
  });

  elements.zeitstufeFilter.addEventListener("change", (event) => {
    state.filters.zeitstufe = event.target.value;
    refreshView();
  });

  elements.rewFilter.addEventListener("change", (event) => {
    state.filters.rew = event.target.value;
    refreshView();
  });

  elements.sicherheitFilter.addEventListener("change", (event) => {
    state.filters.sicherheit = event.target.value;
    refreshView();
  });

  elements.praefixCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const active = elements.praefixCheckboxes.filter((item) => item.checked).map((item) => item.value);
      state.filters.praefix = active.length ? active : state.filters.praefix;
      if (!active.length) {
        checkbox.checked = true;
        state.filters.praefix = [checkbox.value];
      }
      refreshView();
    });
  });

  elements.resetFiltersButton.addEventListener("click", resetFilters);
  elements.fitMapButton.addEventListener("click", fitMapToPlaces);
  elements.reloadDataButton.addEventListener("click", reloadData);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportXlsxButton.addEventListener("click", exportXlsx);

  elements.newPlaceButton.addEventListener("click", resetPlaceForm);
  elements.resetPlaceButton.addEventListener("click", resetPlaceForm);
  elements.placeForm.addEventListener("submit", savePlace);
  elements.deletePlaceButton.addEventListener("click", deletePlace);

  elements.newBelegButton.addEventListener("click", resetBelegForm);
  elements.resetBelegButton.addEventListener("click", resetBelegForm);
  elements.belegForm.addEventListener("submit", saveBeleg);
  elements.deleteBelegButton.addEventListener("click", deleteBeleg);
}

async function init() {
  bindEvents();
  renderLegend();
  renderStats();
  await reloadData();
  fitMapToPlaces();
}

init();
