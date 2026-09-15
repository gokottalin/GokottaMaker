(function () {
  "use strict";
  const TYPES = ["article", "project", "derivation", "formula", "miniapp"];
  const LABELS = { article: "文章", project: "开源项目", derivation: "推导节点", formula: "公式", miniapp: "小程序" };
  const state = { type: "article", query: "", sort: "comprehensive", direction: "desc", category: "", date: "all", duration: "", request: 0, controller: null };
  const el = {
    form: document.querySelector("#publicSearchForm"), input: document.querySelector("#publicSearchInput"),
    tabs: document.querySelector("#publicSearchTabs"), sort: document.querySelector("#publicSearchSort"),
    direction: document.querySelector("#publicSearchDirection"), more: document.querySelector("#publicSearchMore"),
    filters: document.querySelector("#publicSearchFilters"), category: document.querySelector("#publicSearchCategory"),
    date: document.querySelector("#publicSearchDate"), duration: document.querySelector("#publicSearchDuration"),
    durationField: document.querySelector("#publicSearchDurationField"), summary: document.querySelector("#publicSearchSummary"),
    results: document.querySelector("#publicSearchResults")
  };
  let debounceTimer = 0;

  function escapeHtml(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function safeRoute(value) {
    const route = String(value || "");
    if (!route || /^(?:javascript|data):/i.test(route)) return "./maker.html";
    try {
      const target = new URL(route, location.href);
      return target.origin === location.origin ? `${target.pathname}${target.search}${target.hash}` : "./maker.html";
    } catch { return "./maker.html"; }
  }
  function compactViews(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    if (count < 10000) return String(count);
    const scaled = Math.round((count / 10000) * 10) / 10;
    return `${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}万`;
  }
  function durationLabel(value) {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 1) return "";
    if (minutes < 60) return `${minutes}分`;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}时${String(minutes % 60).padStart(2, "0")}分`;
  }
  function exactViews(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    return `<span class="public-card-view" title="精确浏览量：${count}" aria-label="浏览量 ${count} 次"><span aria-hidden="true">◉</span> ${compactViews(count)}</span>`;
  }
  function fallbackCover(type) {
    if (type === "derivation") return `<span class="public-card-derivation-map" aria-hidden="true"><i></i><i></i><i></i></span><span>${LABELS[type]}</span>`;
    return `<span class="public-card-cover-label">${LABELS[type] || "公开内容"}</span>`;
  }
  function formulaCover(item) {
    const source = String(item.latex || "").trim();
    let output = "";
    if (source && window.LarkixMath?.render) {
      const rendered = window.LarkixMath.render(source, { displayMode: true });
      if (rendered.valid && !rendered.blocking) output = rendered.html;
    }
    return `<div class="public-formula-fit"><div class="formula-card-latex" data-formula-source="${escapeHtml(source)}">${output || `<span class="public-formula-fallback">${escapeHtml(source || item.name || "公式")}</span>`}</div></div>`;
  }
  function card(item) {
    const type = state.type;
    const title = item.name || item.title || item.id || "未命名内容";
    const metadata = ["formula", "derivation"].includes(type) ? item.module || item.category : item.category || item.module;
    const duration = ["article", "project"].includes(type) ? durationLabel(item.durationMinutes) : "";
    const cover = type === "formula" ? formulaCover(item) : item.cover ? `<img src="${escapeHtml(item.cover)}" alt="" loading="lazy" />` : fallbackCover(type);
    const route = escapeHtml(safeRoute(item.route));
    return `<article class="public-media-card public-media-card--${type}" data-result-id="${escapeHtml(item.id)}">
      <a class="public-card-cover" href="${route}" aria-label="打开${escapeHtml(title)}">${cover}
        <span class="public-card-overlays">${duration ? `<span class="public-card-duration"><span aria-hidden="true">◷</span> ${duration}</span>` : "<span></span>"}${exactViews(item.viewCount)}</span>
      </a><div class="public-card-copy"><h2><a href="${route}">${escapeHtml(title)}</a></h2><p>${escapeHtml(metadata || LABELS[type])}</p></div>
    </article>`;
  }
  function fitFormulaCards(root = el.results) {
    root?.querySelectorAll(".public-formula-fit").forEach((frame) => {
      const math = frame.firstElementChild;
      if (!math) return;
      math.style.setProperty("--formula-fit-scale", "1");
      const width = Math.max(math.scrollWidth, math.getBoundingClientRect().width);
      const height = Math.max(math.scrollHeight, math.getBoundingClientRect().height);
      const availableWidth = Math.max(1, frame.clientWidth - 24);
      const availableHeight = Math.max(1, frame.clientHeight - 24);
      math.style.setProperty("--formula-fit-scale", String(Math.min(1, availableWidth / width, availableHeight / height)));
    });
    window.LarkixMath?.adaptiveLayout?.refresh?.(root);
  }
  function params(page = 1) {
    const value = new URLSearchParams({ type: state.type, q: state.query, sort: state.sort, direction: state.direction, date: state.date, page: String(page), pageSize: "50" });
    if (state.category) value.set("category", state.category);
    if (state.duration && ["article", "project"].includes(state.type)) {
      const [minimum, maximum] = state.duration.split("-");
      value.set("durationMin", minimum); value.set("durationMax", maximum);
    }
    return value;
  }
  function writeUrl() {
    const value = params(); value.delete("page"); value.delete("pageSize");
    if (!state.query) value.delete("q");
    if (!state.category) value.delete("category");
    if (state.date === "all") value.delete("date");
    if (state.sort === "comprehensive") value.delete("sort");
    if (state.direction === "desc") value.delete("direction");
    if (state.duration) value.set("duration", state.duration);
    history.replaceState(null, "", `${location.pathname}${value.size ? `?${value}` : ""}`);
  }
  function updateControls() {
    el.tabs.querySelectorAll("[data-search-type]").forEach((tab) => {
      const selected = tab.dataset.searchType === state.type;
      tab.setAttribute("aria-selected", String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    el.durationField.hidden = !["article", "project"].includes(state.type);
    el.direction.hidden = !["newest", "common-level"].includes(state.sort);
    el.direction.textContent = state.direction === "asc" ? "升序 ↑" : "降序 ↓";
    el.direction.setAttribute("aria-label", state.direction === "asc" ? "当前升序，点击切换为降序" : "当前降序，点击切换为升序");
  }
  function updateCategories(categories) {
    const selected = state.category;
    el.category.innerHTML = `<option value="">全部分类</option>${categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    if ([...el.category.options].some((option) => option.value === selected)) el.category.value = selected;
    else state.category = "";
  }
  async function requestAll(signal) {
    const response = await fetch(`./api/public/search?${params(1)}`, { cache: "no-store", signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const first = await response.json();
    const items = [...(Array.isArray(first.items) ? first.items : [])];
    for (let page = 2; page <= Number(first.pagination?.pageCount || 0); page += 1) {
      const nextResponse = await fetch(`./api/public/search?${params(page)}`, { cache: "no-store", signal });
      if (!nextResponse.ok) throw new Error(`HTTP ${nextResponse.status}`);
      const next = await nextResponse.json();
      items.push(...(Array.isArray(next.items) ? next.items : []));
    }
    return { ...first, items };
  }
  async function runSearch({ preserveCategories = false } = {}) {
    state.controller?.abort();
    const controller = new AbortController(); state.controller = controller;
    const request = ++state.request;
    el.results.setAttribute("aria-busy", "true"); el.summary.textContent = "正在读取当前类型的公开内容…"; writeUrl();
    try {
      const payload = await requestAll(controller.signal);
      if (request !== state.request) return;
      if (!preserveCategories) updateCategories(Array.isArray(payload.facets?.categories) ? payload.facets.categories : []);
      el.results.innerHTML = payload.items.map(card).join("") || `<div class="empty-state public-search-empty">当前条件下没有公开${LABELS[state.type]}。</div>`;
      el.summary.textContent = `${LABELS[state.type]} · ${payload.items.length} 项公开结果`;
      el.results.setAttribute("aria-busy", "false"); fitFormulaCards();
    } catch (error) {
      if (error.name === "AbortError" || request !== state.request) return;
      el.results.innerHTML = '<div class="empty-state public-search-empty">暂时无法读取公开内容，请稍后重试。</div>';
      el.summary.textContent = "公开内容读取失败"; el.results.setAttribute("aria-busy", "false");
    }
  }
  function restoreState() {
    const url = new URL(location.href);
    state.type = TYPES.includes(url.searchParams.get("type")) ? url.searchParams.get("type") : "article";
    state.query = url.searchParams.get("q") || "";
    state.sort = ["comprehensive", "views", "newest", "common-level"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "comprehensive";
    state.direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
    state.category = url.searchParams.get("category") || "";
    state.date = ["all", "day", "week", "half-year"].includes(url.searchParams.get("date")) ? url.searchParams.get("date") : "all";
    state.duration = /^\d+-\d+$/.test(url.searchParams.get("duration") || "") ? url.searchParams.get("duration") : "";
    el.input.value = state.query; el.sort.value = state.sort; el.date.value = state.date; el.duration.value = state.duration;
  }
  el.form.addEventListener("submit", (event) => { event.preventDefault(); state.query = el.input.value.trim(); runSearch({ preserveCategories: true }); });
  el.input.addEventListener("input", () => { state.query = el.input.value.trim(); clearTimeout(debounceTimer); debounceTimer = setTimeout(() => runSearch({ preserveCategories: true }), 120); });
  el.tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-search-type]");
    if (!tab || tab.dataset.searchType === state.type) return;
    state.type = tab.dataset.searchType; state.category = ""; state.duration = ""; updateControls(); runSearch();
  });
  el.tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...el.tabs.querySelectorAll("[data-search-type]")];
    const current = tabs.findIndex((tab) => tab.dataset.searchType === state.type);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click(); tabs[next].focus();
  });
  el.sort.addEventListener("change", () => { state.sort = el.sort.value; updateControls(); runSearch({ preserveCategories: true }); });
  el.direction.addEventListener("click", () => { state.direction = state.direction === "asc" ? "desc" : "asc"; updateControls(); runSearch({ preserveCategories: true }); });
  el.more.addEventListener("click", () => { const expanded = el.more.getAttribute("aria-expanded") === "true"; el.more.setAttribute("aria-expanded", String(!expanded)); el.filters.hidden = expanded; });
  el.category.addEventListener("change", () => { state.category = el.category.value; runSearch({ preserveCategories: true }); });
  el.date.addEventListener("change", () => { state.date = el.date.value; runSearch({ preserveCategories: true }); });
  el.duration.addEventListener("change", () => { state.duration = el.duration.value; runSearch({ preserveCategories: true }); });
  window.addEventListener("resize", () => fitFormulaCards());
  restoreState(); updateControls(); runSearch();
  window.LarkixPublicSearch = Object.freeze({ compactViews, durationLabel, fitFormulaCards });
})();
