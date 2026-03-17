const GLASS_EPD_FILE = "epd-nb-w-rr-001-glass-partition-walls--en.pdf";

const state = {
  types: [],
  results: [],
  selectedScenarios: [],
  theme: "dark",
  expandedProductStage: false,
  expandedConstruction: false,
  expandedEndOfLife: false,
  expandedBenefits: false
};

const dom = {};

const COMMON_MODULES = [
  {
    key: "A1-A3",
    code: "A1-A3",
    title: "Product stage",
    desc: "Raw materials, transport and manufacturing.",
    area: "area-a13",
    tone: "tone-production",
    codeClass: "code-production"
  },
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
    base: "C1",
    code: "C1",
    title: "Deconstruction / demolition",
    desc: "Removal at end of life.",
    area: "area-c1",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    base: "C2",
    code: "C2",
    title: "Transport",
    desc: "Transport after removal.",
    area: "area-c2",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    base: "C3",
    code: "C3",
    title: "Waste processing",
    desc: "Sorting or processing before final treatment.",
    area: "area-c3",
    tone: "tone-endlife",
    codeClass: "code-endlife"
  },
  {
    base: "C4",
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
  populateWallTypes();
  renderEmptyState("Choose a wall type and product type to load the dashboard.");
});

function cacheDom() {
  dom.wallTypeSelect = document.getElementById("wallTypeSelect");
  dom.productSelect = document.getElementById("productSelect");
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
  dom.verificationValue = document.getElementById("verificationValue");
  dom.epdStatusValue = document.getElementById("epdStatusValue");

  dom.technicalGrid = document.getElementById("technicalGrid");
  dom.scenarioList = document.getElementById("scenarioList");
  dom.scenarioPicker = document.getElementById("scenarioPicker");
  dom.resultsLifecycleGrid = document.getElementById("resultsLifecycleGrid");
  dom.moduleBarChart = document.getElementById("moduleBarChart");
}

function bindEvents() {
  dom.wallTypeSelect.addEventListener("change", onWallTypeChange);
  dom.productSelect.addEventListener("change", onProductChange);
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
  const ready = Boolean(dom.wallTypeSelect.value && dom.productSelect.value);
  dom.selectionSummary.classList.toggle("hidden-until-ready", !ready);
  dom.mainLayout.classList.toggle("hidden-until-ready", !ready);
}

async function loadData() {
  try {
    const [types, results] = await Promise.all([
      fetchCsv("types.csv"),
      fetchCsv("results.csv")
    ]);

    state.types = types;
    state.results = results;
  } catch (error) {
    console.error(error);
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
  return normalizeText(value)
    .toLowerCase()
    .replace(/[®™]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

  const abs = Math.abs(number);
  if (abs === 0) return "0";
  if (abs >= 1000 || abs < 0.001) return number.toExponential(2);
  if (abs >= 100) return number.toFixed(1);
  if (abs >= 10) return number.toFixed(2);
  if (abs >= 1) return number.toFixed(2);
  return number.toFixed(3);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildTypeKey(type, product) {
  return [type, product].map(cleanKeyText).join("||");
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

function populateWallTypes() {
  const types = uniqueSorted(state.types.map((row) => field(row, "type")));
  setOptions(dom.wallTypeSelect, types, "Select wall type", true);
  setOptions(dom.productSelect, [], "Select product type", false);
}

function resetExpansionState() {
  state.expandedProductStage = false;
  state.expandedConstruction = false;
  state.expandedEndOfLife = false;
  state.expandedBenefits = false;
}

function onWallTypeChange() {
  const wallType = dom.wallTypeSelect.value;
  state.selectedScenarios = [];
  resetExpansionState();

  if (!wallType) {
    setOptions(dom.productSelect, [], "Select product type", false);
    updateSelectionSummary();
    updateDashboardVisibility();
    renderEmptyState("Choose a wall type and product type to load the dashboard.");
    return;
  }

  const products = uniqueSorted(
    state.types
      .filter((row) => cleanKeyText(field(row, "type")) === cleanKeyText(wallType))
      .map((row) => field(row, "product"))
  );

  setOptions(dom.productSelect, products, "Select product type", true);
  updateSelectionSummary();
  updateDashboardVisibility();
  renderEmptyState("Wall type selected. Choose a product type.");
}

function onProductChange() {
  updateSelectionSummary();
  updateDashboardVisibility();

  if (!dom.productSelect.value) {
    renderEmptyState("Choose a product type to continue.");
    return;
  }

  const record = findSelectedTypeRecord();
  if (!record) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  resetExpansionState();
  state.selectedScenarios = getAvailableScenarios(record).map((scenario) => scenario.id);
  renderDashboard();
}

function findSelectedTypeRecord() {
  const targetKey = buildTypeKey(dom.wallTypeSelect.value, dom.productSelect.value);
  return state.types.find(
    (row) =>
      buildTypeKey(field(row, "type"), field(row, "product")) === targetKey
  );
}

function findResultRecord(productName) {
  return state.results.find(
    (row) => cleanKeyText(field(row, "product")) === cleanKeyText(productName)
  );
}

function isGlassWall(record) {
  return cleanKeyText(field(record, "type")) === cleanKeyText("Glass partition walls");
}

function renderDashboard() {
  const record = findSelectedTypeRecord();
  if (!record) {
    renderEmptyState("No matching product was found for the selected combination.");
    return;
  }

  const productName = field(record, "product");
  const impact = findResultRecord(productName);
  const scenarios = getAvailableScenarios(record);

  if (!state.selectedScenarios.length) {
    state.selectedScenarios = scenarios.map((scenario) => scenario.id);
  }

  renderDownloads(record);
  renderProductOverview(record);
  renderTechnicalDetails(record);
  renderScenarios(scenarios);
  renderResults(impact, scenarios);
}

function renderDownloads(record) {
  const epdHref = isGlassWall(record) ? buildPath(GLASS_EPD_FILE) : "";
  const lcaFile = field(record, "lca");
  const reportHref = lcaFile ? buildPath("report", lcaFile) : "";

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
  const type = field(record, "type");
  const product = field(record, "product");
  const glass = isGlassWall(record);

  dom.selectedProductType.textContent = type || "—";
  dom.selectedProductVariant.textContent = product || "—";
  dom.verificationValue.textContent = glass ? "Third-party EPD" : "Project-specific LCA";
  dom.epdStatusValue.textContent = glass ? "EPD available" : "EPD not available";

  const imageName = field(record, "image");
  const imagePath = imageName ? buildPath(imageName) : "";

  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  if (!imagePath) {
    dom.productImage.removeAttribute("src");
    return;
  }

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
  const items = [
    {
      label: "Grammage (kg/m²)",
      value: field(record, "Grammage (kg/m2)")
    },
    {
      label: "dU (m²)",
      value: field(record, "dU (m2)")
    },
    {
      label: "Layer thickness (mm)",
      value: field(record, "Layer thickness (mm)")
    }
  ];

  dom.technicalGrid.classList.remove("empty-grid");
  dom.technicalGrid.innerHTML = items
    .map(
      (item) => `
        <div class="metric-box">
          <div>
            <span class="metric-label">${item.label}</span>
            <div class="metric-value">${item.value || "—"}</div>
          </div>
        </div>
      `
    )
    .join("");
}

function getScenarioEmoji(name) {
  const text = normalizeText(name).toLowerCase();

  if (text.includes("reuse") || text.includes("refurb")) return "♻️";
  if (text.includes("repurpose")) return "🧩";
  if (text.includes("recycl")) return "🔄";
  if (text.includes("conventional")) return "🏗️";
  if (text.includes("landfill") || text.includes("landfil")) return "🗑️";
  if (text.includes("inciner")) return "🔥";

  return "📦";
}

function getAvailableScenarios(record) {
  return [1, 2, 3]
    .map((id) => {
      const name = field(record, `Scenario ${id}`);
      if (!name) return null;

      return {
        id,
        name,
        emoji: getScenarioEmoji(name)
      };
    })
    .filter(Boolean);
}

function renderScenarios(scenarios) {
  if (!scenarios.length) {
    dom.scenarioList.classList.add("empty-grid");
    dom.scenarioList.innerHTML = `<div class="empty-panel">No scenario details are available for this product.</div>`;
    dom.scenarioPicker.innerHTML = "";
    return;
  }

  dom.scenarioList.classList.remove("empty-grid");
  dom.scenarioList.innerHTML = scenarios
    .map((scenario) => {
      const active = state.selectedScenarios.includes(scenario.id);

      return `
        <div class="scenario-info-card ${active ? "selected" : ""}">
          <div class="scenario-title-row">
            <div class="scenario-name">${scenario.emoji} ${scenario.name}</div>
          </div>
        </div>
      `;
    })
    .join("");

  dom.scenarioPicker.innerHTML = scenarios
    .map((scenario) => {
      const active = state.selectedScenarios.includes(scenario.id);
      return `
        <button type="button" class="scenario-filter-btn ${active ? "active" : ""}" data-scenario-id="${scenario.id}">
          ${scenario.emoji} ${scenario.name}
        </button>
      `;
    })
    .join("");

  dom.scenarioPicker.querySelectorAll("[data-scenario-id]").forEach((button) => {
    button.addEventListener("click", () => toggleScenarioSelection(Number(button.dataset.scenarioId), scenarios));
  });
}

function toggleScenarioSelection(scenarioId, scenarios) {
  const selected = new Set(state.selectedScenarios);

  if (selected.has(scenarioId)) {
    if (selected.size === 1) return;
    selected.delete(scenarioId);
  } else {
    selected.add(scenarioId);
  }

  state.selectedScenarios = scenarios
    .map((scenario) => scenario.id)
    .filter((id) => selected.has(id));

  renderDashboard();
}

function renderResults(impact, scenarios) {
  if (!impact) {
    dom.resultsLifecycleGrid.className = "results-lifecycle-grid empty-grid";
    dom.resultsLifecycleGrid.innerHTML = `
      <div class="empty-panel">
        No matching result was found in results.csv for this selected product.
      </div>
    `;
    dom.moduleBarChart.className = "module-bar-chart empty-grid";
    dom.moduleBarChart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  const selectedScenarios = scenarios.filter((scenario) => state.selectedScenarios.includes(scenario.id));
  const parts = [];

  parts.push(createExpandableSummaryTile({
    area: "area-a13",
    tone: "tone-production",
    codeClass: "code-production",
    code: "A1-A3",
    title: "Product stage",
    value: toNumber(field(impact, "A1-A3")),
    desc: "Raw materials, transport and manufacturing.",
    expanded: state.expandedProductStage,
    toggleTarget: "productStage"
  }));

  if (state.expandedConstruction) {
  parts.push(createSingleTile(COMMON_MODULES[1], impact, "construction"));
  parts.push(createSingleTile(COMMON_MODULES[2], impact, "construction"));
} else {
  parts.push(createExpandableSummaryTile({
    area: "area-construction",
    tone: "tone-construction",
    codeClass: "code-construction",
    code: "A4-A5",
    title: "Construction stage",
    value: sumValues([field(impact, "A4"), field(impact, "A5")]),
    desc: "Transport to site and installation.",
    expanded: false,
    toggleTarget: "construction"
  }));
}

if (state.expandedEndOfLife) {
  parts.push(
    ...SCENARIO_MODULES.map((module) =>
      createScenarioTile(module, impact, selectedScenarios, "endOfLife")
    )
  );
} else {
  parts.push(createEndOfLifeSummaryTile(impact, selectedScenarios));
}

  parts.push(createBenefitsTile(impact, selectedScenarios));
  parts.push(createTotalTile(impact, selectedScenarios));

  dom.resultsLifecycleGrid.className = `results-lifecycle-grid ${getResultsGridMode()}`;
  dom.resultsLifecycleGrid.innerHTML = parts.join("");

  bindResultToggleEvents();
  renderModuleBarChart(impact, selectedScenarios);
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

      if (target === "productStage") {
        state.expandedProductStage = !state.expandedProductStage;
      } else if (target === "construction") {
        state.expandedConstruction = !state.expandedConstruction;
      } else if (target === "endOfLife") {
        state.expandedEndOfLife = !state.expandedEndOfLife;
      } else if (target === "benefits") {
        state.expandedBenefits = !state.expandedBenefits;
      }

      const record = findSelectedTypeRecord();
      const impact = record ? findResultRecord(field(record, "product")) : null;
      const scenarios = record ? getAvailableScenarios(record) : [];
      renderResults(impact, scenarios);
    });
  });
}

function createExpandableSummaryTile({
  area,
  tone,
  codeClass,
  code,
  title,
  value,
  desc,
  expanded,
  toggleTarget
}) {
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

function createSingleTile(module, impact, toggleTarget = "") {
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
      <div class="single-value">${formatMetric(field(impact, module.key))}</div>
    </div>
  `;
}

function createEndOfLifeSummaryTile(impact, selectedScenarios) {
  const rows = selectedScenarios
    .map((scenario) => {
      const total = sumValues([
        field(impact, impactColumnForScenario("C1", scenario.id)),
        field(impact, impactColumnForScenario("C2", scenario.id)),
        field(impact, impactColumnForScenario("C3", scenario.id)),
        field(impact, impactColumnForScenario("C4", scenario.id))
      ]);

      return {
        name: scenario.name,
        emoji: scenario.emoji,
        value: total
      };
    })
    .filter((row) => row.value !== null);

  return `
    <div class="result-tile area-eol tone-endlife toggle-tile" data-toggle-target="endOfLife">
      <div class="result-head">
        <div>
          <h4 class="result-title">End of life stage</h4>
        </div>
        <span class="result-code code-endlife">C1-C4</span>
      </div>

      <div class="compare-stack">
        ${createScenarioValueLines(rows)}
      </div>
    </div>
  `;
}

function createBenefitsTile(impact, selectedScenarios) {
  const rows = selectedScenarios
    .map((scenario) => {
      const value = toNumber(field(impact, impactColumnForScenario("D", scenario.id)));
      return {
        name: scenario.name,
        emoji: scenario.emoji,
        value
      };
    })
    .filter((row) => row.value !== null);

  return `
    <div class="result-tile area-d tone-benefits toggle-tile ${state.expandedBenefits ? "is-open" : ""}" data-toggle-target="benefits">
      <div class="result-head">
        <div>
          <h4 class="result-title">Benefits beyond life cycle stage</h4>
        </div>
        <span class="result-code code-benefits">D</span>
      </div>

      <div class="compare-stack">
        ${createScenarioValueLines(rows)}
      </div>

      <div class="tile-detail ${state.expandedBenefits ? "show" : ""}">
        <p class="result-desc detail-desc">Potential benefits or loads beyond the system boundary.</p>
      </div>
    </div>
  `;
}

function createScenarioValueLines(rows) {
  const maxAbs = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return rows.length
    ? rows
        .map((row) => {
          const width = (Math.abs(row.value) / maxAbs) * 100;
          const type = row.value >= 0 ? "positive" : "negative";

          return `
            <div class="compare-line">
              <div class="compare-meta">
                <span>${row.emoji} ${row.name}</span>
                <strong>${formatMetric(row.value)}</strong>
              </div>
              <div class="bar-track">
                <div class="bar-fill ${type}" style="--w:${width}"></div>
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-panel">No data</div>`;
}

function createScenarioTile(module, impact, selectedScenarios, toggleTarget = "") {
  const rows = selectedScenarios
    .map((scenario) => {
      const column = impactColumnForScenario(module.base, scenario.id);
      const value = toNumber(field(impact, column));

      return {
        name: scenario.name,
        emoji: scenario.emoji,
        value
      };
    })
    .filter((row) => row.value !== null);

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

      <div class="compare-stack">
        ${createScenarioValueLines(rows)}
      </div>
    </div>
  `;
}

function createTotalTile(impact, selectedScenarios) {
  const cards = selectedScenarios
    .map((scenario) => {
      const value = toNumber(field(impact, impactColumnForScenario("(A1-C4)", scenario.id)));
      return `
        <div class="total-card">
          <span>${scenario.emoji} ${scenario.name}</span>
          <strong>${formatMetric(value)}</strong>
        </div>
      `;
    })
    .join("");

  return `
    <div class="result-tile area-total tone-total">
      <div class="result-head">
        <div>
          <h4 class="result-title">A1-C4 Total (kg/m²)</h4>
          <p class="result-desc">Combined result up to end of life for the selected scenarios.</p>
        </div>
        <span class="result-code code-total">A1-C4</span>
      </div>

      <div class="total-grid">
        ${cards || `<div class="empty-panel">No total values available.</div>`}
      </div>
    </div>
  `;
}

function sumValues(values) {
  const numbers = values.map(toNumber).filter((value) => value !== null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function impactColumnForScenario(base, scenarioId) {
  if (scenarioId === 1) return base;
  return `${base}/${scenarioId - 1}`;
}

function renderEmptyState(message) {
  dom.selectedProductType.textContent = "—";
  dom.selectedProductVariant.textContent = message;
  dom.verificationValue.textContent = "—";
  dom.epdStatusValue.textContent = "—";

  dom.productImage.removeAttribute("src");
  dom.productImage.style.display = "none";
  dom.productImagePlaceholder.style.display = "grid";
  dom.productImagePlaceholder.textContent = "Product image will appear here";

  dom.technicalGrid.classList.add("empty-grid");
  dom.technicalGrid.innerHTML = `<div class="empty-panel">Technical details will load here.</div>`;

  dom.scenarioList.classList.add("empty-grid");
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
  const wallType = dom.wallTypeSelect.value;
  const product = dom.productSelect.value;

  if (!wallType || !product) return;

  dom.selectionSummary.textContent = `Loaded configuration: ${wallType} · ${product}`;
}

function renderModuleBarChart(impact, selectedScenarios) {
  if (!impact || !dom.moduleBarChart) {
    dom.moduleBarChart.className = "module-bar-chart empty-grid";
    dom.moduleBarChart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  const groups = buildModuleChartGroups(impact, selectedScenarios);

  if (!groups.length) {
    dom.moduleBarChart.className = "module-bar-chart empty-grid";
    dom.moduleBarChart.innerHTML = `<div class="empty-panel">No graph data available.</div>`;
    return;
  }

  const scale = getChartScale(groups);

  dom.moduleBarChart.className = "module-bar-chart";
  dom.moduleBarChart.innerHTML = `
    ${renderModuleChartLegend(selectedScenarios)}
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

  const barClass = bar.common
    ? `common ${group.tone}`
    : `series-${bar.seriesIndex ?? 0}`;

  const positionStyle =
    value > 0
      ? `height:${positiveHeight}%; bottom:calc(${scale.zeroBottom}% + 1px);`
      : value < 0
      ? `height:${negativeHeight}%; bottom:calc(${scale.zeroBottom}% - ${negativeHeight}% - 1px);`
      : `height:0; bottom:${scale.zeroBottom}%;`;

  return `
    <div class="module-chart-slot">
      <div class="module-chart-tooltip ${value >= 0 ? "positive" : "negative"}">
        ${formatMetric(value)}
      </div>

      <div
        class="module-chart-bar ${value >= 0 ? "positive" : "negative"} ${barClass}"
        style="${positionStyle} --bar-index:${barIndex};"
      ></div>
    </div>
  `;
}

function buildModuleChartGroups(impact, selectedScenarios) {
  const groups = [];

  groups.push({
    key: "A1-A3",
    label: "A1-A3",
    sub: state.expandedProductStage
      ? "Raw materials, transport and manufacturing."
      : "Product stage",
    tone: "production",
    bars: [
      {
        label: "Product stage",
        value: toNumber(field(impact, "A1-A3")),
        common: true
      }
    ]
  });

  if (state.expandedConstruction) {
    groups.push({
      key: "A4",
      label: "A4",
      sub: "Transport to site",
      tone: "construction",
      bars: [
        {
          label: "A4",
          value: toNumber(field(impact, "A4")),
          common: true
        }
      ]
    });

    groups.push({
      key: "A5",
      label: "A5",
      sub: "Installation",
      tone: "construction",
      bars: [
        {
          label: "A5",
          value: toNumber(field(impact, "A5")),
          common: true
        }
      ]
    });
  } else {
    groups.push({
      key: "A4-A5",
      label: "A4-A5",
      sub: "Construction stage",
      tone: "construction",
      bars: [
        {
          label: "Construction stage",
          value: sumValues([field(impact, "A4"), field(impact, "A5")]),
          common: true
        }
      ]
    });
  }

  if (state.expandedEndOfLife) {
    const eolMap = {
      C1: "Deconstruction",
      C2: "Transport",
      C3: "Waste processing",
      C4: "Disposal"
    };

    ["C1", "C2", "C3", "C4"].forEach((base) => {
      groups.push({
        key: base,
        label: base,
        sub: eolMap[base],
        tone: "endlife",
        bars: selectedScenarios
          .map((scenario, scenarioIndex) => ({
            label: scenario.name,
            value: toNumber(field(impact, impactColumnForScenario(base, scenario.id))),
            seriesIndex: scenarioIndex
          }))
          .filter((bar) => bar.value !== null)
      });
    });
  } else {
    groups.push({
      key: "C1-C4",
      label: "C1-C4",
      sub: "End of life stage",
      tone: "endlife",
      bars: selectedScenarios
        .map((scenario, scenarioIndex) => ({
          label: scenario.name,
          value: sumValues([
            field(impact, impactColumnForScenario("C1", scenario.id)),
            field(impact, impactColumnForScenario("C2", scenario.id)),
            field(impact, impactColumnForScenario("C3", scenario.id)),
            field(impact, impactColumnForScenario("C4", scenario.id))
          ]),
          seriesIndex: scenarioIndex
        }))
        .filter((bar) => bar.value !== null)
    });
  }

  groups.push({
    key: "D",
    label: "D",
    sub: state.expandedBenefits
      ? "Potential benefits or loads beyond the system boundary."
      : "Benefits beyond",
    tone: "benefits",
    bars: selectedScenarios
      .map((scenario, scenarioIndex) => ({
        label: scenario.name,
        value: toNumber(field(impact, impactColumnForScenario("D", scenario.id))),
        seriesIndex: scenarioIndex
      }))
      .filter((bar) => bar.value !== null)
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
    return {
      maxPositive: 1,
      maxNegative: 0,
      positiveZone: 100,
      negativeZone: 0,
      zeroBottom: 0
    };
  }

  if (rawMaxNegative === 0) {
    return {
      maxPositive: maxPositive || 1,
      maxNegative: 0,
      positiveZone: 100,
      negativeZone: 0,
      zeroBottom: 0
    };
  }

  if (rawMaxPositive === 0) {
    return {
      maxPositive: 0,
      maxNegative: maxNegative || 1,
      positiveZone: 0,
      negativeZone: 100,
      zeroBottom: 100
    };
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

  const barClass = bar.common
    ? `common ${group.tone}`
    : `series-${bar.seriesIndex ?? 0}`;

  const positionStyle =
    value > 0
      ? `height:${positiveHeight}%; bottom:calc(${scale.zeroBottom}% + 1px);`
      : value < 0
      ? `height:${negativeHeight}%; bottom:calc(${scale.zeroBottom}% - ${negativeHeight}% - 1px);`
      : `height:0; bottom:${scale.zeroBottom}%;`;

  return `
    <div class="module-chart-slot">
      <div class="module-chart-tooltip ${value >= 0 ? "positive" : "negative"}">
        ${formatMetric(value)}
      </div>

      <div
        class="module-chart-bar ${value >= 0 ? "positive" : "negative"} ${barClass}"
        style="${positionStyle} --bar-index:${barIndex};"
      ></div>
    </div>
  `;
}

function renderModuleChartLegend(selectedScenarios) {
  if (!selectedScenarios.length) return "";

  return `
    <div class="module-chart-legend">
      ${selectedScenarios
        .map(
          (scenario, index) => `
            <div class="module-legend-chip">
              <span class="module-legend-dot" style="${getLegendDotStyle(index)}"></span>
              <span>${escapeHtml(scenario.name)}</span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function getLegendDotStyle(index) {
  if (index === 0) {
    return "background: linear-gradient(180deg, rgba(93, 140, 255, 0.98), rgba(122, 168, 255, 1));";
  }
  if (index === 1) {
    return "background: linear-gradient(180deg, rgba(207, 90, 64, 0.98), rgba(235, 125, 99, 1));";
  }
  return "background: linear-gradient(180deg, rgba(96, 200, 191, 0.98), rgba(131, 225, 214, 1));";
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
  const savedTheme = localStorage.getItem("wall-lca-theme");
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  applyTheme(savedTheme || (prefersLight ? "light" : "dark"));
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("wall-lca-theme", nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  dom.themeLabel.textContent = theme === "dark" ? "Light mode" : "Dark mode";
}