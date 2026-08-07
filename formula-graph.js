(function formulaGraphModule(global) {
  "use strict";

  const ICONS = {
    zoomIn: "+",
    zoomOut: "\u2212",
    fit: "\u2922",
    center: "\u25ce",
    expand: "\u21f2",
    collapse: "\u21a4"
  };
  const LAYOUT = Object.freeze({
    columnGap: 104,
    rowGap: 30,
    padding: 46,
    fallbackWidth: 176,
    fallbackHeight: 76
  });
  const MIN_ZOOM = 0.22;
  const MIN_READABLE_ZOOM = 0.48;
  const MAX_ZOOM = 2.4;
  const LEGACY_FALLBACK_LAYOUT = Object.freeze({ name: "breadthfirst" });

  function button(action, label, icon) {
    return `<button type="button" data-graph-action="${action}" title="${label}" aria-label="${label}"><span aria-hidden="true">${icon}</span></button>`;
  }

  function stableNodeOrder(left, right) {
    return (
      Number(left.rank || 0) - Number(right.rank || 0) ||
      String(left.displayName || "").localeCompare(String(right.displayName || ""), "zh-CN") ||
      String(left.id).localeCompare(String(right.id))
    );
  }

  function computeDepths(nodes = [], edges = []) {
    const nodeById = new Map(
      nodes
        .filter((node) => node && node.id != null)
        .map((node) => [String(node.id), node])
    );
    const outgoing = new Map([...nodeById.keys()].map((nodeId) => [nodeId, []]));
    const indegree = new Map([...nodeById.keys()].map((nodeId) => [nodeId, 0]));
    const seenEdges = new Set();

    for (const edge of edges) {
      const source = String(edge && edge.source != null ? edge.source : "");
      const target = String(edge && edge.target != null ? edge.target : "");
      const key = `${source}\u0000${target}`;
      if (!nodeById.has(source) || !nodeById.has(target) || seenEdges.has(key)) continue;
      seenEdges.add(key);
      outgoing.get(source).push(target);
      indegree.set(target, Number(indegree.get(target) || 0) + 1);
    }
    for (const targets of outgoing.values()) targets.sort((left, right) => left.localeCompare(right));

    const depthById = Object.fromEntries([...nodeById.keys()].map((nodeId) => [nodeId, 0]));
    const queue = [...nodeById.keys()]
      .filter((nodeId) => Number(indegree.get(nodeId) || 0) === 0)
      .sort((left, right) => left.localeCompare(right));
    const visited = [];

    while (queue.length) {
      const source = queue.shift();
      visited.push(source);
      for (const target of outgoing.get(source) || []) {
        depthById[target] = Math.max(
          Number(depthById[target] || 0),
          Number(depthById[source] || 0) + 1
        );
        indegree.set(target, Number(indegree.get(target) || 0) - 1);
        if (indegree.get(target) === 0) {
          queue.push(target);
          queue.sort((left, right) => left.localeCompare(right));
        }
      }
    }

    const unresolved = [...nodeById.keys()].filter((nodeId) => !visited.includes(nodeId));
    if (unresolved.length) {
      const finiteRanks = unresolved.map((nodeId) => Number(nodeById.get(nodeId).rank)).filter(Number.isFinite);
      const minimumRank = finiteRanks.length ? Math.min(...finiteRanks) : 0;
      unresolved.forEach((nodeId) => {
        const rank = Number(nodeById.get(nodeId).rank);
        depthById[nodeId] = Number.isFinite(rank) ? rank - minimumRank : 0;
      });
    }

    return {
      depthById,
      order: [...visited, ...unresolved.sort((left, right) => left.localeCompare(right))],
      cyclic: unresolved.length > 0
    };
  }

  function sizeFor(sizes, nodeId) {
    const candidate = sizes instanceof Map ? sizes.get(nodeId) : sizes && sizes[nodeId];
    return {
      width: Math.max(1, Number(candidate && candidate.width) || LAYOUT.fallbackWidth),
      height: Math.max(1, Number(candidate && candidate.height) || LAYOUT.fallbackHeight)
    };
  }

  function computeLayout(nodes = [], edges = [], sizes = {}, options = {}) {
    const depthResult = options.depths && options.depths.depthById
      ? options.depths
      : options.depths
        ? { depthById: options.depths, cyclic: false }
        : computeDepths(nodes, edges);
    const depthById = depthResult.depthById || {};
    const columns = new Map();

    nodes.filter(Boolean).forEach((node) => {
      const nodeId = String(node.id);
      const depth = Number(depthById[nodeId] || 0);
      if (!columns.has(depth)) columns.set(depth, []);
      columns.get(depth).push(node);
    });
    const orderedDepths = [...columns.keys()].sort((left, right) => left - right);
    orderedDepths.forEach((depth) => columns.get(depth).sort(stableNodeOrder));

    const columnMetrics = new Map();
    let cursorX = LAYOUT.padding;
    for (const depth of orderedDepths) {
      const column = columns.get(depth);
      const maxWidth = Math.max(...column.map((node) => sizeFor(sizes, String(node.id)).width));
      const contentHeight = column.reduce(
        (total, node, index) =>
          total + sizeFor(sizes, String(node.id)).height + (index ? LAYOUT.rowGap : 0),
        0
      );
      columnMetrics.set(depth, {
        centerX: cursorX + maxWidth / 2,
        maxWidth,
        contentHeight
      });
      cursorX += maxWidth + LAYOUT.columnGap;
    }

    const graphHeight = Math.max(
      2 * LAYOUT.padding + LAYOUT.fallbackHeight,
      ...[...columnMetrics.values()].map((metric) => metric.contentHeight + 2 * LAYOUT.padding)
    );
    const positions = {};
    const nodeBounds = {};

    for (const depth of orderedDepths) {
      const column = columns.get(depth);
      const metric = columnMetrics.get(depth);
      let cursorY = (graphHeight - metric.contentHeight) / 2;
      for (const node of column) {
        const nodeId = String(node.id);
        const size = sizeFor(sizes, nodeId);
        const x = metric.centerX;
        const y = cursorY + size.height / 2;
        positions[nodeId] = { x, y, depth };
        nodeBounds[nodeId] = {
          left: x - size.width / 2,
          right: x + size.width / 2,
          top: y - size.height / 2,
          bottom: y + size.height / 2,
          width: size.width,
          height: size.height
        };
        cursorY += size.height + LAYOUT.rowGap;
      }
    }

    const edgeDirections = edges
      .map((edge) => {
        const source = String(edge && edge.source != null ? edge.source : "");
        const target = String(edge && edge.target != null ? edge.target : "");
        if (!positions[source] || !positions[target]) return null;
        return {
          id: String(edge.id || `${source}->${target}`),
          source,
          target,
          sourceX: positions[source].x,
          targetX: positions[target].x,
          sourceRight: nodeBounds[source].right,
          targetLeft: nodeBounds[target].left,
          leftToRight: nodeBounds[target].left > nodeBounds[source].right
        };
      })
      .filter(Boolean);

    return {
      positions,
      nodeBounds,
      edgeDirections,
      depths: Object.fromEntries(orderedDepths.map((depth) => [depth, columns.get(depth).map((node) => String(node.id))])),
      width: Math.max(2 * LAYOUT.padding + LAYOUT.fallbackWidth, cursorX - LAYOUT.columnGap + LAYOUT.padding),
      height: graphHeight,
      cyclic: Boolean(depthResult.cyclic)
    };
  }

  function mount(host, payload, options = {}) {
    if (!host || !global.cytoscape) return null;
    host._formulaGraph?.destroy?.();

    const graph = payload && typeof payload === "object" ? payload : {};
    const allNodes = new Map(
      (graph.nodes || [])
        .filter((node) => node && node.id != null)
        .map((node) => [String(node.id), node])
    );
    const allEdges = new Map(
      (graph.edges || [])
        .filter((edge) => edge && edge.id != null)
        .map((edge) => [String(edge.id), edge])
    );
    const initialIds = new Set(
      (graph.initialNodeIds || []).filter((nodeId) => allNodes.has(String(nodeId))).map(String)
    );
    if (!initialIds.size && graph.currentNodeId && allNodes.has(String(graph.currentNodeId))) {
      initialIds.add(String(graph.currentNodeId));
    }
    if (!initialIds.size) [...allNodes.keys()].slice(0, 1).forEach((nodeId) => initialIds.add(nodeId));

    const visibleIds = new Set(initialIds);
    const depthResult = computeDepths([...allNodes.values()], [...allEdges.values()]);
    let selectedId = String(graph.currentNodeId || [...initialIds][0] || "");
    let cy = null;
    let layoutSnapshot = null;
    let resizeObserver = null;
    let syncFrame = 0;
    let destroyed = false;
    const overlayById = new Map();
    const sizeById = new Map();

    host.innerHTML = `
      <div class="formula-graph-toolbar" role="toolbar" aria-label="公式推导图工具">
        ${button("zoom-in", "放大", ICONS.zoomIn)}
        ${button("zoom-out", "缩小", ICONS.zoomOut)}
        ${button("fit", "适配可见节点", ICONS.fit)}
        ${button("center", "居中当前公式", ICONS.center)}
        ${button("expand", "展开所选分支", ICONS.expand)}
        ${button("collapse", "收起旁支", ICONS.collapse)}
      </div>
      <div class="formula-graph-canvas" role="application" tabindex="0" aria-label="从左向右的公式推导关系图">
        <div class="formula-graph-cytoscape" aria-hidden="true"></div>
        <div class="formula-graph-node-layer"></div>
      </div>
      <p class="formula-graph-status" aria-live="polite"></p>`;
    const canvas = host.querySelector(".formula-graph-canvas");
    const cyContainer = host.querySelector(".formula-graph-cytoscape");
    const nodeLayer = host.querySelector(".formula-graph-node-layer");
    const status = host.querySelector(".formula-graph-status");

    const publicDescription = host
      .closest(".formula-graph-public")
      ?.querySelector(".formula-graph-heading p");
    if (publicDescription) publicDescription.textContent = "来源公式 \u2192 当前公式 \u2192 依赖公式";

    function visibleNodes() {
      return [...visibleIds].map((nodeId) => allNodes.get(nodeId)).filter(Boolean);
    }

    function visibleEdges() {
      return [...allEdges.values()].filter(
        (edge) => visibleIds.has(String(edge.source)) && visibleIds.has(String(edge.target))
      );
    }

    function hiddenNeighbors(nodeId) {
      const hidden = new Set();
      for (const edge of allEdges.values()) {
        if (String(edge.source) === nodeId && !visibleIds.has(String(edge.target))) {
          hidden.add(String(edge.target));
        }
        if (String(edge.target) === nodeId && !visibleIds.has(String(edge.source))) {
          hidden.add(String(edge.source));
        }
      }
      return [...hidden].filter((candidate) => allNodes.has(candidate));
    }

    function hrefFor(node) {
      return `${String(options.hrefPrefix || "./derive.html?formula=")}${encodeURIComponent(String(node.slug || ""))}`;
    }

    function renderMath(mathHost, node) {
      const result = global.LarkixMath?.render?.(String(node.latex || ""), { displayMode: true });
      if (result && result.valid) {
        mathHost.innerHTML = result.html;
        return;
      }
      mathHost.classList.add("is-invalid");
      mathHost.textContent = "公式暂不可显示";
    }

    function selectNode(nodeId, focus = false) {
      if (!visibleIds.has(nodeId)) return;
      selectedId = nodeId;
      for (const [candidateId, overlay] of overlayById) {
        overlay.classList.toggle("is-selected", candidateId === selectedId);
      }
      if (cy) {
        cy.nodes().unselect();
        const selected = cy.getElementById(nodeId);
        if (selected.length) selected.select();
      }
      if (focus) overlayById.get(nodeId)?.focus({ preventScroll: true });
    }

    function bindOverlayInteractions(overlay, node) {
      const nodeId = String(node.id);
      let dragState = null;
      let suppressClick = false;

      overlay.addEventListener("focus", () => selectNode(nodeId));
      overlay.addEventListener("dragstart", (event) => event.preventDefault());
      overlay.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || !cy) return;
        const cyNode = cy.getElementById(nodeId);
        if (!cyNode.length) return;
        selectNode(nodeId);
        dragState = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          position: { ...cyNode.position() },
          moved: false
        };
        overlay.setPointerCapture?.(event.pointerId);
      });
      overlay.addEventListener("pointermove", (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId || !cy) return;
        const deltaX = event.clientX - dragState.clientX;
        const deltaY = event.clientY - dragState.clientY;
        if (!dragState.moved && Math.hypot(deltaX, deltaY) < 5) return;
        dragState.moved = true;
        event.preventDefault();
        const cyNode = cy.getElementById(nodeId);
        cyNode.position({
          x: dragState.position.x + deltaX / cy.zoom(),
          y: dragState.position.y + deltaY / cy.zoom()
        });
      });
      function endDrag(event) {
        if (!dragState || dragState.pointerId !== event.pointerId) return;
        suppressClick = dragState.moved;
        overlay.releasePointerCapture?.(event.pointerId);
        if (dragState.moved) updateStatus("已调整所选节点位置。");
        dragState = null;
      }
      overlay.addEventListener("pointerup", endDrag);
      overlay.addEventListener("pointercancel", endDrag);
      overlay.addEventListener("click", (event) => {
        selectNode(nodeId);
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          return;
        }
        if (options.navigation === false || !node.slug) {
          event.preventDefault();
          return;
        }
        if (typeof options.onNavigate === "function") {
          event.preventDefault();
          options.onNavigate(hrefFor(node), String(node.slug));
        }
      });
    }

    function createOverlay(node) {
      const navigable = options.navigation !== false && Boolean(node.slug);
      const overlay = global.document.createElement(navigable ? "a" : "button");
      overlay.className = [
        "formula-graph-node",
        node.current ? "is-current" : "",
        node.direction ? `is-${node.direction}` : "",
        node.publishStatus ? `is-${node.publishStatus}` : "",
        String(node.id) === selectedId ? "is-selected" : ""
      ]
        .filter(Boolean)
        .join(" ");
      overlay.dataset.nodeId = String(node.id);
      overlay.dataset.depth = String(depthResult.depthById[String(node.id)] || 0);
      if (!navigable) overlay.type = "button";
      overlay.draggable = false;
      if (navigable) overlay.href = hrefFor(node);
      if (node.current) overlay.setAttribute("aria-current", "page");

      const title = global.document.createElement("span");
      title.className = "formula-graph-node-title";
      title.textContent = String(node.displayName || "公式");
      const math = global.document.createElement("span");
      math.className = "formula-graph-node-math";
      renderMath(math, node);
      overlay.append(title, math);
      bindOverlayInteractions(overlay, node);
      return overlay;
    }

    function measureOverlays() {
      overlayById.clear();
      sizeById.clear();
      nodeLayer.replaceChildren();
      nodeLayer.classList.add("is-measuring");
      for (const node of visibleNodes().sort(stableNodeOrder)) {
        const overlay = createOverlay(node);
        nodeLayer.append(overlay);
        const rect = overlay.getBoundingClientRect();
        const nodeId = String(node.id);
        overlayById.set(nodeId, overlay);
        sizeById.set(nodeId, {
          width: Math.ceil(Math.max(rect.width, LAYOUT.fallbackWidth)),
          height: Math.ceil(Math.max(rect.height, LAYOUT.fallbackHeight))
        });
      }
    }

    function cytoscapeElements() {
      const nodes = visibleNodes().map((node) => {
        const nodeId = String(node.id);
        const size = sizeFor(sizeById, nodeId);
        return {
          group: "nodes",
          data: {
            id: nodeId,
            width: size.width,
            height: size.height,
            current: node.current ? "true" : "false"
          },
          position: layoutSnapshot.positions[nodeId],
          classes: node.current ? "is-current" : ""
        };
      });
      const edges = visibleEdges().map((edge) => ({
        group: "edges",
        data: {
          id: String(edge.id),
          source: String(edge.source),
          target: String(edge.target)
        }
      }));
      return [...nodes, ...edges];
    }

    function scheduleOverlaySync() {
      if (syncFrame || destroyed) return;
      const requestFrame = global.requestAnimationFrame || ((callback) => global.setTimeout(callback, 0));
      syncFrame = requestFrame(() => {
        syncFrame = 0;
        if (!cy || destroyed) return;
        const zoom = cy.zoom();
        for (const [nodeId, overlay] of overlayById) {
          const cyNode = cy.getElementById(nodeId);
          if (!cyNode.length) continue;
          const position = cyNode.renderedPosition();
          overlay.style.left = `${position.x}px`;
          overlay.style.top = `${position.y}px`;
          overlay.style.transform = `translate(-50%, -50%) scale(${zoom})`;
        }
        nodeLayer.classList.remove("is-measuring");
      });
    }

    function updateStatus(message = "") {
      if (!status) return;
      const hidden = Math.max(0, allNodes.size - visibleIds.size);
      const layerCount = layoutSnapshot ? Object.keys(layoutSnapshot.depths).length : 0;
      const zoom = cy ? Math.round(cy.zoom() * 100) : 100;
      const limitNote = graph.truncated ? "，图谱已按加载上限显示" : "";
      status.textContent =
        message ||
        `当前显示 ${visibleIds.size} 个节点、${layerCount} 层，缩放 ${zoom}%${
          hidden ? `，另有 ${hidden} 个节点可展开` : ""
        }${limitNote}。`;
    }

    function fitReadable(collection = cy?.elements()) {
      if (!cy || !collection || !collection.length || canvas.clientWidth < 2 || canvas.clientHeight < 2) return;
      cy.fit(collection, 34);
      const fittedZoom = cy.zoom();
      const readableZoom = Math.min(1, Math.max(MIN_READABLE_ZOOM, fittedZoom));
      if (Math.abs(readableZoom - fittedZoom) > 0.001) {
        cy.zoom(readableZoom);
        if (fittedZoom < MIN_READABLE_ZOOM) {
          const current = cy.getElementById(String(graph.currentNodeId || ""));
          cy.center(current.length ? current : collection);
        } else {
          cy.center(collection);
        }
      }
      scheduleOverlaySync();
      updateStatus();
    }

    function rebuild(fit = true) {
      measureOverlays();
      layoutSnapshot = computeLayout(visibleNodes(), visibleEdges(), sizeById, {
        depths: depthResult
      });
      if (!cy) return;
      cy.batch(() => {
        cy.elements().remove();
        cy.add(cytoscapeElements());
      });
      cy.layout({ name: "preset", fit: false, animate: false }).run();
      selectNode(visibleIds.has(selectedId) ? selectedId : String(graph.currentNodeId || [...visibleIds][0] || ""));
      if (fit) fitReadable();
      else scheduleOverlaySync();
      updateStatus();
    }

    function expand(nodeId = selectedId) {
      const key = String(nodeId || graph.currentNodeId || "");
      const additions = hiddenNeighbors(key);
      additions.forEach((candidate) => visibleIds.add(candidate));
      if (additions.length) {
        rebuild(true);
        updateStatus(`已展开 ${additions.length} 个相邻节点。`);
      } else {
        updateStatus("所选节点没有隐藏旁支。");
      }
      return additions.length;
    }

    function collapse() {
      visibleIds.clear();
      initialIds.forEach((nodeId) => visibleIds.add(nodeId));
      selectedId = String(graph.currentNodeId || [...visibleIds][0] || "");
      rebuild(true);
      updateStatus("已收起到默认聚焦范围。");
    }

    function centerCurrent() {
      if (!cy) return;
      const currentId = String(graph.currentNodeId || "");
      const current = cy.getElementById(currentId);
      if (!current.length) return;
      const reducedMotion = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      cy.animate({ center: { eles: current }, duration: reducedMotion ? 0 : 180 });
      selectNode(currentId, true);
    }

    function zoomBy(factor, renderedPosition) {
      if (!cy) return;
      cy.zoom({
        level: Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor)),
        renderedPosition: renderedPosition || {
          x: canvas.clientWidth / 2,
          y: canvas.clientHeight / 2
        }
      });
      scheduleOverlaySync();
      updateStatus();
    }

    measureOverlays();
    layoutSnapshot = computeLayout(visibleNodes(), visibleEdges(), sizeById, {
      depths: depthResult
    });
    const elements = cytoscapeElements();
    cy = global.cytoscape({
      container: cyContainer,
      elements,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      wheelSensitivity: 0.16,
      boxSelectionEnabled: false,
      autoungrabify: true,
      style: [
        {
          selector: "node",
          style: {
            shape: "round-rectangle",
            width: "data(width)",
            height: "data(height)",
            padding: 0,
            label: "",
            "background-opacity": 0,
            "border-opacity": 0,
            "overlay-opacity": 0
          }
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#8793a1",
            "target-arrow-color": "#52606d",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.9
          }
        },
        {
          selector: "edge:selected",
          style: {
            "line-color": "#0b6bcb",
            "target-arrow-color": "#0b6bcb"
          }
        }
      ],
      layout: elements.length
        ? { name: "preset", fit: false, animate: false }
        : LEGACY_FALLBACK_LAYOUT
    });

    cy.on("render pan zoom position resize", scheduleOverlaySync);
    fitReadable();
    scheduleOverlaySync();

    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!cy) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.ctrlKey || event.metaKey) {
          const rect = canvas.getBoundingClientRect();
          zoomBy(Math.exp(-event.deltaY * 0.002), {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
          });
          return;
        }
        cy.panBy({ x: -event.deltaX, y: -event.deltaY });
        scheduleOverlaySync();
      },
      { passive: false, capture: true }
    );

    canvas.addEventListener("keydown", (event) => {
      if (!cy) return;
      const panStep = event.shiftKey ? 96 : 44;
      const pans = {
        ArrowLeft: { x: panStep, y: 0 },
        ArrowRight: { x: -panStep, y: 0 },
        ArrowUp: { x: 0, y: panStep },
        ArrowDown: { x: 0, y: -panStep }
      };
      if (pans[event.key]) {
        event.preventDefault();
        cy.panBy(pans[event.key]);
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomBy(1.2);
      }
      if (event.key === "-") {
        event.preventDefault();
        zoomBy(1 / 1.2);
      }
      if (event.key === "0") {
        event.preventDefault();
        fitReadable();
      }
      if (event.key === "Home") {
        event.preventDefault();
        centerCurrent();
      }
    });

    function onToolbarClick(event) {
      const control = event.target.closest("[data-graph-action]");
      if (!control) return;
      const action = control.dataset.graphAction;
      if (action === "zoom-in") zoomBy(1.2);
      if (action === "zoom-out") zoomBy(1 / 1.2);
      if (action === "fit") fitReadable();
      if (action === "center") centerCurrent();
      if (action === "expand") expand();
      if (action === "collapse") collapse();
    }
    host.addEventListener("click", onToolbarClick);

    resizeObserver =
      typeof global.ResizeObserver === "function"
        ? new global.ResizeObserver(() => {
            if (!cy) return;
            cy.resize();
            scheduleOverlaySync();
          })
        : null;
    resizeObserver?.observe(canvas);

    global.document.fonts?.ready?.then(() => {
      if (destroyed) return;
      const pan = cy.pan();
      const zoom = cy.zoom();
      rebuild(false);
      cy.zoom(zoom);
      cy.pan(pan);
      scheduleOverlaySync();
    });
    updateStatus();

    const api = {
      cy,
      expand,
      collapse,
      centerCurrent,
      fit: () => fitReadable(),
      zoomBy,
      visibleNodeCount: () => visibleIds.size,
      getLayoutSnapshot: () => layoutSnapshot,
      destroy() {
        destroyed = true;
        resizeObserver?.disconnect();
        if (syncFrame && global.cancelAnimationFrame) global.cancelAnimationFrame(syncFrame);
        host.removeEventListener("click", onToolbarClick);
        cy?.destroy();
        if (host._formulaGraph === api) host._formulaGraph = null;
      }
    };
    host._formulaGraph = api;
    return api;
  }

  global.LarkixFormulaGraph = Object.freeze({
    mount,
    computeDepths,
    computeLayout
  });
})(typeof window !== "undefined" ? window : globalThis);
