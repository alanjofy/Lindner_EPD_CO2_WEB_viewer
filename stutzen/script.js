const COMMON_EPD_FILE = "Steel pedestals for system floors.pdf";
const COMMON_IMAGE_FILE = "stütze.jpg";

const state = {
  rows: [],
  selectedScenarios: [1],
  theme: "dark",
  expandedProductStage: false,
  expandedConstruction: false,
  expandedEndOfLife: false,
  expandedBenefits: false
};

const dom = {};

const COMMON_MODULES = [
  {
    key: "A4",
    code: "A4",
    title: "Transport to site",
    desc: "Transport to construction site.",
    area: "area-a4",
    tone: "tone-construction",
    codeClass: "code-construction"
  },
  {
    key: "A5",
    code: "A5",
    title: "Installation",
    desc: "Assembly and installation.",
    area: "area-a5",
    tone: "tone-construction",
    codeClass: "code-construction"
  }
];

const SCENARIO_MODULES = [
  {
    key: "C1",
    code: "C1",
    title: "Deconstruction / demolition",
    desc: "Removal at end of life.",
    area: "area-c1",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C2",
    code: "C2",
    title: "Transport",
    desc: "Transport after removal.",
    area: "area-c2",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C3",
    code: "C3",
    title: "Waste processing",
    desc: "Sorting or processing before final treatment.",
    area: "area-c3",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    key: "C4",
    code: "C4",
    title: "Disposal",
    desc: "Final disposal stage.",
    area: "area-c4",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  cacheDom();
  bindEvents();
  initTheme();
  updateDashboardVisibility();
  await loadData();
  populateClassifications();
  renderEmptyState("Choose classification, pedestal type and variant to load the dashboard.");
});

function cacheDom() {
  dom.classificationSelect = document.getElementById("classificationSelect");
  dom.pedestalSelect = document.getElementById("pedestalSelect");
  dom.variantSelect = document.getElementById("variantSelect");
  dom.selectionSummary = document.getElementById("selectionSummary");
  dom.mainLayout = document.querySelector(".main-layout");

  dom.epdDownloadBtn = document.getElementById("epdDownloadBtn");
  dom.reportDownloadBtn = document.getElementById("reportDownloadBtn");
  dom.themeToggle = document.getElementById("themeToggle");
  dom.themeLabel = document.getElementById("themeLabel");

  dom.productImage = document.getElementById("productImage");
  dom.productImagePlaceholder = document.getElementById("productImagePlaceholder");
  dom.selectedProductType = document.getElementById("selectedProductType");
  dom.selectedProductVariant = document.getElementById("selectedProductVariant");
  dom.issueDateValue = document.getElementById("issueDateValue");
  dom.validToValue = document.getElementById("validToValue");

  dom.technicalGrid = document.getElementById("technicalGrid");
  dom.scenarioList = document.getElementById("scenarioList");
  dom.scenarioPicker = document.getElementById("scenarioPicker");
  dom.resultsLifecycleGrid = document.getElementById("resultsLifecycleGrid");
  dom.moduleBarChart = document.getElementById("moduleBarChart");
}

function bindEvents() {
  dom.classificationSelect.addEventListener("change", onClassificationChange);
  dom.pedestalSelect.addEventListener("change", onPedestalChange);
  dom.variantSelect.addEventListener("change", onVariantChange);
  dom.themeToggle.addEventListener("click", toggleTheme);

  [dom.epdDownloadBtn, dom.reportDownloadBtn].forEach((button) => {
    button.addEventListener("click", (event) => {
      if (button.classList.contains("disabled")) {
        event.preventDefault();
      }
    });
  });
}

function updateDashboardVisibility() {
  const ready = Boolean(
    dom.classificationSelect.value &&
    dom.pedestalSelect.value &&
    dom.variantSelect.value
  );

  dom.selectionSummary.classList.toggle("hidden-until-ready", !ready);
  dom.mainLayout.classList.toggle("hidden-until-ready", !ready);
}

async function loadData() {
  try {
    state.rows = await fetchCsv("typesTable.csv");
  } catch (error) {
    console.error(error);
    renderEmptyState("Failed to load typesTable.csv");
  }
}

async function fetchCsv(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  const text = await response.text();
  return parseCsv(text);
}

function parseCsv(text) {
  const rows = csvToRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];

  const headers = rows[0].map(canonicalHeader);

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => normalizeText(cell) !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = normalizeText(row[index] ?? "");
      });
      return record;
    });
}

function csvToRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanKeyText(value) {
  return normalizeText(value).toLowerCase();
}

function canonicalHeader(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, "");
}

function field(record, key) {
  return record?.[canonicalHeader(key)] ?? "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMetric(value) {
  const number = typeof value === "number" ? value : toNumber(value);
  if (number === null) return "—";
  return number.toFixed(2);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildPath(...parts) {
  return parts
    .filter(Boolean)
    .flatMap((part) => String(part).split("/"))
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function setOptions(select, items, placeholder, enabled = true) {
  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  select.disabled = !enabled;
}

function populateClassifications() {
  const classifications = uniqueSorted(
    state.rows.map((row) => field(row, "classification"))
  );

  setOptions(dom.classificationSelect, classifications, "Select classification", true);
  setOptions(dom.pedestalSelect, [], "Select pedestal type", false);
  setOptions(dom.variantSelect, [], "Select variant", false);
}

function resetExpansionState() {
  state.expandedProductStage = false;
  state.expandedConstruction = false;
  state.expandedEndOfLife = false;
  state.expandedBenefits = false;
}

function onClassificationChange() {
  const classification = dom.classificationSelect.value;
  resetExpansionState();

  setOptions(dom.variantSelect, [], "Select variant", false);

  if (!classification) {
    setOptions(dom.pedestalSelect, [], "Select pedestal type", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose classification, pedestal type and variant to load the dashboard.");
    return;
  }

  const pedestalTypes = uniqueSorted(
    state.rows
      .filter((row) => cleanKeyText(field(row, "classification")) === cleanKeyText(classification))
      .map((row) => field(row, "Pedestal type"))
  );

  setOptions(dom.pedestalSelect, pedestalTypes, "Select pedestal type", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Classification selected. Choose a pedestal type.");
}

function onPedestalChange() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  resetExpansionState();

  if (!classification || !pedestal) {
    setOptions(dom.variantSelect, [], "Select variant", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose a variant to continue.");
    return;
  }

  const variants = uniqueSorted(
    state.rows
      .filter(
        (row) =>
          cleanKeyText(field(row, "classification")) === cleanKeyText(classification) &&
          cleanKeyText(field(row, "Pedestal type")) === cleanKeyText(pedestal)
      )
      .map((row) => field(row, "Variant"))
  );

  setOptions(dom.variantSelect, variants, "Select variant", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Pedestal type selected. Choose a variant.");
}

function onVariantChange() {
  updateSelectionSummary();
  updateDashboardVisibility();

  if (!dom.variantSelect.value) {
    renderEmptyState("Choose a variant to continue.");
    return;
  }

  const record = findSelectedRecord();
  if (!record) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  resetExpansionState();
  state.selectedScenarios = [1];
  renderDashboard();
}

function findSelectedRecord() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  const variant = dom.variantSelect.value;

  return state.rows.find(
    (row) =>
      cleanKeyText(field(row, "classification")) === cleanKeyText(classification) &&
      cleanKeyText(field(row, "Pedestal type")) === cleanKeyText(pedestal) &&
      cleanKeyText(field(row, "Variant")) === cleanKeyText(variant)
  );
}

function getScenario() {
  return {
    id: 1,
    name: "95% Recycling · 5% landfilling"
  };
}

function calculateModules(record) {
  const weight = toNumber(field(record, "Wt of installation kit (kg)"));
  if (weight === null) return null;

  const x = weight - 0.18;

  const values = {
    "A1-A3": 2.37770482179021 * x + 0.128719095432339,
    "A4": 0.00981137514570162 * x + 0.00178844305645018,
    "A5": 0.0738221792872456 * x,
    "C1": 0,
    "C2": 0.00441947648597122 * x + 0.000805593702931929,
    "C3": 0.168928508185918,
    "C4": 0.000768418074781768 * x,
    "D": -1.56466494946565 * x
  };

  values["A1-C4"] =
    values["A1-A3"] +
    values["A4"] +
    values["A5"] +
    values["C1"] +
    values["C2"] +
    values["C3"] +
    values["C4"];

  return values;
}

function renderDashboard() {
  const record = findSelectedRecord();
  const scenario = getScenario();
  const values = calculateModules(record);

  if (!record || !values) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  renderDownloads(record);
  renderProductOverview(record);
  renderTechnicalDetails(record);
  renderScenarios(scenario);
  renderResults(values, scenario);
}

function renderDownloads(record) {
  const epdHref = buildPath(COMMON_EPD_FILE);
  const reportFile = field(record, "pdf");
  const reportHref = reportFile ? buildPath("report", reportFile) : "";

  setLinkState(dom.epdDownloadBtn, epdHref);
  setLinkState(dom.reportDownloadBtn, reportHref);
}

function setLinkState(link, href) {
  if (href) {
    link.href = href;
    link.classList.remove("disabled");
    link.setAttribute("aria-disabled", "false");
    link.setAttribute("download", "");
  } else {
    link.href = "#";
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
    link.removeAttribute("download");
  }
}

function renderProductOverview(record) {
  const classification = field(record, "classification");
  const variant = field(record, "Variant");

  dom.selectedProductType.textContent = classification || "—";
  dom.selectedProductVariant.textContent = variant || "—";
  dom.issueDateValue.textContent = "17.02.2026";
  dom.validToValue.textContent = "16.02.2031";

  const imagePath = buildPath(COMMON_IMAGE_FILE);

  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  dom.productImage.onload = () => {
    dom.productImage.style.display = "block";
    dom.productImagePlaceholder.style.display = "none";
  };

  dom.productImage.onerror = () => {
    dom.productImage.style.display = "none";
    dom.productImagePlaceholder.style.display = "grid";
    dom.productImagePlaceholder.textContent = "Product image will appear here";
  };

  dom.productImage.src = imagePath;
}

function renderTechnicalDetails(record) {
  const weight = field(record, "Wt of installation kit (kg)");

  dom.technicalGrid.className = "metrics-grid single-metric";
  dom.technicalGrid.innerHTML = `
    <div class="metric-box">
      <div>
        <span class="metric-label">Wt of installation kit (kg)</span>
        <div class="metric-value">${formatMetric(weight)}</div>
      </div>
    </div>
  `;
}

function renderScenarios(scenario) {
  dom.scenarioList.classList.remove("empty-grid");
  dom.scenarioList.innerHTML = `
    <div class="scenario-info-card selected">
      <div class="scenario-title-row">
        <div class="scenario-name">${scenario.name}</div>
      </div>
    </div>
  `;

  dom.scenarioPicker.innerHTML = `
    <button type="button" class="scenario-filter-btn active" disabled>
      ${scenario.name}
    </button>
  `;
}

function renderResults(values, scenario) {
  const parts = [];

  parts.push(
    createExpandableSummaryTile({
      area: "area-a13",
      tone: "tone-production",
      codeClass: "code-production",
      code: "A1-A3",
      title: "Product stage",
      value: values["A1-A3"],
      desc: "Raw materials, transport and manufacturing.",
      expanded: state.expandedProductStage,
      toggleTarget: "productStage"
    })
  );

  if (state.expandedConstruction) {
    parts.push(createSingleValueTile(COMMON_MODULES[0], values["A4"], "construction"));
    parts.push(createSingleValueTile(COMMON_MODULES[1], values["A5"], "construction"));
  } else {
    parts.push(
      createExpandableSummaryTile({
        area: "area-construction",
        tone: "tone-construction",
        codeClass: "code-construction",
        code: "A4-A5",
        title: "Construction stage",
        value: values["A4"] + values["A5"],
        desc: "Transport to site and installation.",
        expanded: false,
        toggleTarget: "construction"
      })
    );
  }

  if (state.expandedEndOfLife) {
    parts.push(...SCENARIO_MODULES.map((module) => createSingleValueTile(module, values[module.key], "endOfLife")));
  } else {
    parts.push(createEndOfLifeSummaryTile(values, scenario));
  }

  parts.push(createBenefitsTile(values, scenario));
  parts.push(createTotalTile(values, scenario));

  dom.resultsLifecycleGrid.className = `results-lifecycle-grid ${getResultsGridMode()}`;
  dom.resultsLifecycleGrid.innerHTML = parts.join("");

  bindResultToggleEvents();
  renderModuleBarChart(values, scenario);
}

function getResultsGridMode() {
  if (state.expandedConstruction && state.expandedEndOfLife) return "mode-both-expanded";
  if (state.expandedConstruction && !state.expandedEndOfLife) return "mode-construction-expanded";
  if (!state.expandedConstruction && state.expandedEndOfLife) return "mode-eol-expanded";
  return "mode-collapsed";
}

function bindResultToggleEvents() {
  dom.resultsLifecycleGrid.querySelectorAll("[data-toggle-target]").forEach((element) => {
    element.addEventListener("click", () => {
      const target = element.dataset.toggleTarget;

      if (target === "productStage") state.expandedProductStage = !state.expandedProductStage;
      if (target === "construction") state.expandedConstruction = !state.expandedConstruction;
      if (target === "endOfLife") state.expandedEndOfLife = !state.expandedEndOfLife;
      if (target === "benefits") state.expandedBenefits = !state.expandedBenefits;

      const record = findSelectedRecord();
      const values = calculateModules(record);
      if (values) renderResults(values, getScenario());
    });
  });
}

function createExpandableSummaryTile({ area, tone, codeClass, code, title, value, desc, expanded, toggleTarget }) {
  return `
    <div class="result-tile ${area} ${tone} toggle-tile ${expanded ? "is-open" : ""}" data-toggle-target="${toggleTarget}">
      <div class="result-head">
        <div>
          <h4 class="result-title">${title}</h4>
        </div>
        <span class="result-code ${codeClass}">${code}</span>
      </div>

      <div class="single-value">${formatMetric(value)}</div>

      <div class="tile-detail ${expanded ? "show" : ""}">
        <p class="result-desc detail-desc">${desc}</p>
      </div>
    </div>
  `;
}

function createSingleValueTile(module, value, toggleTarget = "") {
  const isToggle = Boolean(toggleTarget);

  return `
    <div class="result-tile ${module.area} ${module.tone} tile-appearing ${isToggle ? "toggle-tile" : ""}" ${isToggle ? `data-toggle-target="${toggleTarget}"` : ""}>
      <div class="result-head">
        <div>
          <h4 class="result-title">${module.title}</h4>
          <p class="result-desc">${module.desc}</p>
        </div>
        <span class="result-code ${module.codeClass}">${module.code}</span>
      </div>
      <div class="single-value">${formatMetric(value)}</div>
    </div>
  `;
}

function createEndOfLifeSummaryTile(values, scenario) {
  const total = values["C1"] + values["C2"] + values["C3"] + values["C4"];

  return `
    <div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
      <div class="result-head">
        <div>
          <h4 class="result-title">End of life stage</h4>
        </div>
        <span class="result-code code-endlife">C1-C4</span>
      </div>

      <div class="compare-stack">
        ${createScenarioValueLines([{ name: scenario.name, value: total }])}
      </div>
    </div>
  `;
}

function createBenefitsTile(values, scenario) {
  return `
    <div class="result-tile area-d tone-benefits toggle-tile ${state.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits">
      <div class="result-head">
        <div>
          <h4 class="result-title">Benefits beyond life cycle stage</h4>
        </div>
        <span class="result-code code-benefits">D</span>
      </div>

      <div class="compare-stack">
        ${createScenarioValueLines([{ name: scenario.name, value: values["D"] }])}
      </div>

      <div class="tile-detail ${state.expandedBenefits ? "show" : ""}">
        <p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p>
      </div>
    </div>
  `;
}

function createScenarioValueLines(rows) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return rows
    .map((row) => {
      const width = (Math.abs(row.value) / maxAbs) * 100;
      const type = row.value >= 0 ? "positive" : "negative";

      return `
        <div class="compare-line">
          <div class="compare-meta">
            <span>${escapeHtml(row.name)}</span>
            <strong>${formatMetric(row.value)}</strong>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${type}" style="--w:${width}"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function createTotalTile(values, scenario) {
  return `
    <div class="result-tile area-total tone-total">
      <div class="result-head">
        <div>
          <h4 class="result-title">A1-C4 Total (kg/m²)</h4>
          <p class="result-desc">Combined result up to end of life for the selected scenario.</p>
        </div>
        <span class="result-code code-total">A1-C4</span>
      </div>

      <div class="total-grid">
        <div class="total-card">
          <span>${escapeHtml(scenario.name)}</span>
          <strong>${formatMetric(values["A1-C4"])}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyState(message) {
  dom.selectedProductType.textContent = "—";
  dom.selectedProductVariant.textContent = message;
  dom.issueDateValue.textContent = "—";
  dom.validToValue.textContent = "—";

  dom.productImage.removeAttribute("src");
  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  dom.technicalGrid.className = "metrics-grid empty-grid";
  dom.technicalGrid.innerHTML = `<div class="empty-panel">Technical details will load here.</div>`;

  dom.scenarioList.className = "scenario-list empty-grid";
  dom.scenarioList.innerHTML = `<div class="empty-panel">Scenario details will appear here.</div>`;
  dom.scenarioPicker.innerHTML = "";

  dom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
  dom.resultsLifecycleGrid.innerHTML = `<div class="empty-panel">${message}</div>`;

  dom.moduleBarChart.className = "module-bar-chart empty-grid";
  dom.moduleBarChart.innerHTML = `<div class="empty-panel">${message}</div>`;

  setLinkState(dom.epdDownloadBtn, "");
  setLinkState(dom.reportDownloadBtn, "");
}

function updateSelectionSummary() {
  const classification = dom.classificationSelect.value;
  const pedestal = dom.pedestalSelect.value;
  const variant = dom.variantSelect.value;

  if (!classification || !pedestal || !variant) return;
  dom.selectionSummary.textContent = `Loaded configuration: ${classification} · ${variant}`;
}

function renderModuleBarChart(values, scenario) {
  if (!values || !dom.moduleBarChart) {
    dom.moduleBarChart.className = "module-bar-chart empty-grid";
    dom.moduleBarChart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  const groups = buildModuleChartGroups(values, scenario);
  if (!groups.length) {
    dom.moduleBarChart.className = "module-bar-chart empty-grid";
    dom.moduleBarChart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  const scale = getChartScale(groups);

  dom.moduleBarChart.className = "module-bar-chart";
  dom.moduleBarChart.innerHTML = `
    ${renderModuleChartLegend(scenario)}
    <div class="module-chart-canvas">
      <div class="module-chart-plot">
        ${groups.map((group, index) => createModuleChartGroup(group, scale, index)).join("")}
      </div>
      <div class="module-chart-note">
        The graph updates automatically when you expand or collapse the module tiles.
      </div>
    </div>
  `;
}

function buildModuleChartGroups(values, scenario) {
  const groups = [];

  groups.push({
    label: "A1-A3",
    sub: "Product stage",
    tone: "production",
    bars: [{ label: "A1-A3", value: values["A1-A3"], common: true }]
  });

  if (state.expandedConstruction) {
    groups.push({
      label: "A4",
      sub: "Transport to site",
      tone: "construction",
      bars: [{ label: "A4", value: values["A4"], common: true }]
    });

    groups.push({
      label: "A5",
      sub: "Installation",
      tone: "construction",
      bars: [{ label: "A5", value: values["A5"], common: true }]
    });
  } else {
    groups.push({
      label: "A4-A5",
      sub: "Construction stage",
      tone: "construction",
      bars: [{ label: "A4-A5", value: values["A4"] + values["A5"], common: true }]
    });
  }

  if (state.expandedEndOfLife) {
    groups.push({
      label: "C1",
      sub: "Deconstruction",
      tone: "endlife",
      bars: [{ label: scenario.name, value: values["C1"], seriesIndex: 0 }]
    });
    groups.push({
      label: "C2",
      sub: "Transport",
      tone: "endlife",
      bars: [{ label: scenario.name, value: values["C2"], seriesIndex: 0 }]
    });
    groups.push({
      label: "C3",
      sub: "Waste processing",
      tone: "endlife",
      bars: [{ label: scenario.name, value: values["C3"], seriesIndex: 0 }]
    });
    groups.push({
      label: "C4",
      sub: "Disposal",
      tone: "endlife",
      bars: [{ label: scenario.name, value: values["C4"], seriesIndex: 0 }]
    });
  } else {
    groups.push({
      label: "C1-C4",
      sub: "End of life stage",
      tone: "endlife",
      bars: [{
        label: scenario.name,
        value: values["C1"] + values["C2"] + values["C3"] + values["C4"],
        seriesIndex: 0
      }]
    });
  }

  groups.push({
    label: "D",
    sub: "Benefits beyond",
    tone: "benefits",
    bars: [{ label: scenario.name, value: values["D"], seriesIndex: 0 }]
  });

  return groups;
}

function getChartScale(groups) {
  const values = groups
    .flatMap((group) => group.bars.map((bar) => bar.value))
    .filter((value) => value !== null);

  const positives = values.filter((value) => value > 0);
  const negatives = values.filter((value) => value < 0).map((value) => Math.abs(value));

  const rawMaxPositive = positives.length ? Math.max(...positives) : 0;
  const rawMaxNegative = negatives.length ? Math.max(...negatives) : 0;
  const paddingFactor = 1.08;

  const maxPositive = rawMaxPositive * paddingFactor;
  const maxNegative = rawMaxNegative * paddingFactor;

  if (rawMaxPositive === 0 && rawMaxNegative === 0) {
    return { maxPositive: 1, maxNegative: 0, positiveZone: 100, negativeZone: 0, zeroBottom: 0 };
  }

  if (rawMaxNegative === 0) {
    return { maxPositive: maxPositive || 1, maxNegative: 0, positiveZone: 100, negativeZone: 0, zeroBottom: 0 };
  }

  if (rawMaxPositive === 0) {
    return { maxPositive: 0, maxNegative: maxNegative || 1, positiveZone: 0, negativeZone: 100, zeroBottom: 100 };
  }

  const total = maxPositive + maxNegative;
  const positiveZone = (maxPositive / total) * 100;
  const negativeZone = (maxNegative / total) * 100;

  return {
    maxPositive,
    maxNegative,
    positiveZone,
    negativeZone,
    zeroBottom: negativeZone
  };
}

function createModuleChartGroup(group, scale, groupIndex) {
  return `
    <div class="module-chart-group tone-${group.tone}" style="--group-index:${groupIndex};">
      <div class="module-chart-bars" style="--zero-line-bottom:${scale.zeroBottom}%;">
        <div class="module-chart-zero-line"></div>
        ${group.bars.map((bar, barIndex) => createModuleChartBar(group, bar, scale, barIndex)).join("")}
      </div>
      <div class="module-chart-group-label">
        ${group.label}
        <span class="module-chart-group-sub">${group.sub}</span>
      </div>
    </div>
  `;
}

function createModuleChartBar(group, bar, scale, barIndex) {
  const value = bar.value ?? 0;
  const minVisiblePct = 3;

  const positiveRaw =
    value > 0 && scale.maxPositive > 0
      ? (Math.abs(value) / scale.maxPositive) * scale.positiveZone
      : 0;

  const negativeRaw =
    value < 0 && scale.maxNegative > 0
      ? (Math.abs(value) / scale.maxNegative) * scale.negativeZone
      : 0;

  const positiveHeight =
    value > 0 ? Math.min(Math.max(positiveRaw, minVisiblePct), scale.positiveZone) : 0;

  const negativeHeight =
    value < 0 ? Math.min(Math.max(negativeRaw, minVisiblePct), scale.negativeZone) : 0;

  const barClass = bar.common ? `common ${group.tone}` : `series-${bar.seriesIndex ?? 0}`;

  const positionStyle =
    value > 0
      ? `height:${positiveHeight}%; bottom:${scale.zeroBottom}%;`
      : value < 0
      ? `height:${negativeHeight}%; bottom:calc(${scale.zeroBottom}% - ${negativeHeight}%);`
      : `height:0; bottom:${scale.zeroBottom}%;`;

  return `
    <div class="module-chart-slot">
      <div class="module-chart-tooltip">${formatMetric(value)}</div>
      <div
        class="module-chart-bar ${value >= 0 ? "positive" : "negative"} ${barClass}"
        style="${positionStyle}; --bar-index:${barIndex};"
      ></div>
    </div>
  `;
}

function renderModuleChartLegend(scenario) {
  return `
    <div class="module-chart-legend">
      <div class="module-legend-chip">
        <span class="module-legend-dot" style="${getLegendDotStyle()}"></span>
        <span>${escapeHtml(scenario.name)}</span>
      </div>
    </div>
  `;
}

function getLegendDotStyle() {
  return "background: linear-gradient(180deg, rgba(93, 140, 255, 0.98), rgba(122, 168, 255, 1));";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function initTheme() {
  const savedTheme = localStorage.getItem("stuetzen-lca-theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(savedTheme || (prefersLight ? "light" : "dark"));
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("stuetzen-lca-theme", nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  dom.themeLabel.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}