(function formulaDualViewPage(global) {
  "use strict";

  const VALID_VIEWS = new Set(["formula", "derivation"]);
  const content = global.document.querySelector("#formulaContent");
  const hero = global.document.querySelector("#formulaHero");
  const tabs = [...global.document.querySelectorAll("[data-formula-view]")];
  let currentCard = null;
  let requestSequence = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function routeState() {
    const match = global.location.pathname.match(/^\/formula\/([^/]+)$/);
    let slug = "";
    try {
      slug = match ? decodeURIComponent(match[1]) : "";
    } catch {
      slug = "";
    }
    const requested = new URL(global.location.href).searchParams.get("view");
    return { slug, view: VALID_VIEWS.has(requested) ? requested : "formula" };
  }

  function setActiveView(view) {
    tabs.forEach((tab) => {
      const active = tab.dataset.formulaView === view;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    content.dataset.activeView = view;
  }

  function destroyGraph() {
    content.querySelector("#publicFormulaGraph")?._formulaGraph?.destroy?.();
  }

  function renderState(title, message) {
    destroyGraph();
    currentCard = null;
    global.document.title = `${title} | LarkixMaker`;
    hero.innerHTML = `<div class="post-hero-content derive-hero-content"><span class="category-pill">公式</span><div class="section-title-block split-title post-title-block"><h1>${escapeHtml(title)}</h1><span>Formula</span></div><p>${escapeHtml(message)}</p></div>`;
    content.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div>`;
  }

  function compactViews(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    if (count < 10000) return String(count);
    const scaled = Math.round((count / 10000) * 10) / 10;
    return `${Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)}万`;
  }

  function viewMeta(value) {
    const count = Math.max(0, Math.trunc(Number(value) || 0));
    return `<span class="public-card-view" title="精确浏览量：${count}" aria-label="浏览量 ${count} 次"><span aria-hidden="true">◉</span> ${compactViews(count)}</span>`;
  }

  function formulaCover(card) {
    const source = String(card.latex || "").trim();
    const rendered = source && global.LarkixMath?.render?.(source, { displayMode: true });
    const output = rendered?.valid && !rendered.blocking
      ? rendered.html
      : `<span class="public-formula-fallback"><strong>公式暂不可显示</strong><code>${escapeHtml(source || card.displayName || "公式")}</code></span>`;
    return `<div class="public-formula-fit"><div class="formula-card-latex" data-formula-source="${escapeHtml(source)}">${output}</div></div>`;
  }

  function formulaCardHtml(card) {
    const route = `/formula/${encodeURIComponent(card.slug)}`;
    return `<article class="public-media-card public-media-card--formula formula-single-card" data-formula-id="${escapeHtml(card.formulaId || "")}">
      <a class="public-card-cover" href="${route}" aria-label="打开${escapeHtml(card.displayName)}">${formulaCover(card)}
        <span class="public-card-overlays"><span></span>${viewMeta(card.viewCount)}</span>
      </a>
      <div class="public-card-copy"><h2><a href="${route}">${escapeHtml(card.displayName)}</a></h2><p>${escapeHtml(card.moduleKey || card.categoryPath || "公式")}</p></div>
    </article>`;
  }

  function fitFormulaCards(root = content) {
    root.querySelectorAll(".public-formula-fit").forEach((frame) => {
      const math = frame.firstElementChild;
      if (!math) return;
      math.style.setProperty("--formula-fit-scale", "1");
      const width = Math.max(math.scrollWidth, math.getBoundingClientRect().width);
      const height = Math.max(math.scrollHeight, math.getBoundingClientRect().height);
      const availableWidth = Math.max(1, frame.clientWidth - 24);
      const availableHeight = Math.max(1, frame.clientHeight - 24);
      math.style.setProperty("--formula-fit-scale", String(Math.min(1, availableWidth / width, availableHeight / height)));
    });
    global.LarkixMath?.adaptiveLayout?.refresh?.(root);
  }

  function renderHero(card) {
    global.document.title = `${card.displayName} | LarkixMaker`;
    const canonical = global.document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `${global.location.origin}/formula/${encodeURIComponent(card.slug)}`;
    hero.innerHTML = `<div class="post-hero-content derive-hero-content"><span class="category-pill">公式</span><div class="section-title-block split-title post-title-block"><h1>${escapeHtml(card.displayName)}</h1><span>Formula &amp; Derivation</span></div><p>${escapeHtml(card.moduleKey || card.categoryPath || "已发布公式")}</p></div>`;
  }

  function renderFormulaView(card) {
    destroyGraph();
    content.innerHTML = `${formulaCardHtml(card)}<div class="formula-single-actions"><button class="button primary" type="button" data-open-derivation>查看推导链路</button></div>`;
    global.requestAnimationFrame(() => fitFormulaCards(content));
  }

  function normalizedGraph(card) {
    const source = card.graph && typeof card.graph === "object" ? card.graph : {};
    const nodes = Array.isArray(source.nodes) ? [...source.nodes] : [];
    if (!nodes.length) {
      nodes.push({
        id: card.formulaId || card.slug,
        slug: card.slug,
        displayName: card.displayName,
        latex: card.latex,
        current: true,
        direction: "current",
        rank: 0,
        nodeType: "formula"
      });
    }
    const currentNodeId = source.currentNodeId || String(nodes.find((node) => node.current)?.id || nodes[0].id);
    return {
      ...source,
      currentNodeId,
      nodes,
      edges: Array.isArray(source.edges) ? source.edges : [],
      initialNodeIds: Array.isArray(source.initialNodeIds) && source.initialNodeIds.length ? source.initialNodeIds : [currentNodeId]
    };
  }

  function renderDerivationView(card) {
    destroyGraph();
    const graph = normalizedGraph(card);
    const relationCount = graph.edges.length;
    content.innerHTML = `<section class="formula-graph-public" aria-labelledby="formulaGraphTitle"><div class="formula-graph-heading"><div><h2 id="formulaGraphTitle">公式推导</h2><p>节点展示公式名称与结论；点击公式节点可切换公式视图。</p></div><span>${graph.nodes.length} 个关联节点</span></div><div id="publicFormulaGraph" class="formula-graph-host"></div>${relationCount ? "" : '<p class="formula-derivation-empty-root">暂无上游依赖</p>'}</section>`;
    const host = content.querySelector("#publicFormulaGraph");
    if (!global.LarkixFormulaGraph?.mount) {
      host.innerHTML = '<div class="empty-state">推导图暂不可显示。</div>';
      return;
    }
    global.LarkixFormulaGraph.mount(host, graph, {
      hrefPrefix: "/formula/",
      onNavigate(href, slug, node) {
        if (node?.nodeType === "article") {
          global.location.href = href;
          return;
        }
        navigate(slug, "formula", true);
      },
      loadContinuation: async (cursor) => {
        const response = await fetch(`/api/formulas/${encodeURIComponent(card.slug)}?cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()).card?.graph;
      }
    });
  }

  function renderCurrent(view) {
    if (!currentCard) return;
    setActiveView(view);
    if (view === "derivation") renderDerivationView(currentCard);
    else renderFormulaView(currentCard);
  }

  async function load(slug, view) {
    const request = ++requestSequence;
    setActiveView(view);
    renderState("正在加载公式", "正在读取已发布公式。");
    try {
      const response = await fetch(`/api/formulas/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (request !== requestSequence) return;
      if (response.status === 404) {
        renderState("公式不可用", "此公式不存在、仍为草稿或已归档。");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload.card) throw new Error("missing public card");
      currentCard = payload.card;
      renderHero(currentCard);
      renderCurrent(view);
    } catch {
      if (request !== requestSequence) return;
      renderState("公式暂不可用", "网络或服务暂时不可用，请稍后重试。");
    }
  }

  function urlFor(slug, view) {
    const params = new URLSearchParams();
    if (view !== "formula") params.set("view", view);
    return `/formula/${encodeURIComponent(slug)}${params.size ? `?${params}` : ""}`;
  }

  function navigate(slug, view, push) {
    const target = urlFor(slug, view);
    if (push) global.history.pushState({ slug, view }, "", target);
    if (currentCard?.slug === slug) renderCurrent(view);
    else load(slug, view);
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    const state = routeState();
    const view = tab.dataset.formulaView;
    if (view !== state.view) navigate(state.slug, view, true);
  }));
  content.addEventListener("click", (event) => {
    if (!event.target.closest("[data-open-derivation]")) return;
    const state = routeState();
    navigate(state.slug, "derivation", true);
  });
  global.addEventListener("popstate", () => {
    const state = routeState();
    navigate(state.slug, state.view, false);
  });
  global.addEventListener("resize", () => {
    if (content.dataset.activeView === "formula") fitFormulaCards(content);
  });

  const initial = routeState();
  if (!initial.slug || !/^[a-z0-9][a-z0-9-]{1,127}$/.test(initial.slug)) {
    setActiveView(initial.view);
    renderState("公式标识无效", "链接中的公式 slug 格式不正确。");
  } else {
    load(initial.slug, initial.view);
  }
})(window);
