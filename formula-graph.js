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

  function button(action, label, icon) {
    return `<button type="button" data-graph-action="${action}" title="${label}" aria-label="${label}"><span aria-hidden="true">${icon}</span></button>`;
  }

  function mount(host, payload, options = {}) {
    if (!host || !global.cytoscape) return null;
    const graph = payload && typeof payload === "object" ? payload : {};
    const allNodes = new Map((graph.nodes || []).map((node) => [String(node.id), node]));
    const allEdges = new Map((graph.edges || []).map((edge) => [String(edge.id), edge]));
    const initialIds = new Set(
      (graph.initialNodeIds || []).filter((nodeId) => allNodes.has(String(nodeId))).map(String)
    );
    if (!initialIds.size && graph.currentNodeId && allNodes.has(String(graph.currentNodeId))) {
      initialIds.add(String(graph.currentNodeId));
    }
    const visibleIds = new Set(initialIds);
    let selectedId = String(graph.currentNodeId || "");

    host.innerHTML = `
      <div class="formula-graph-toolbar" role="toolbar" aria-label="公式推导图工具">
        ${button("zoom-in", "放大", ICONS.zoomIn)}
        ${button("zoom-out", "缩小", ICONS.zoomOut)}
        ${button("fit", "适配全部可见节点", ICONS.fit)}
        ${button("center", "居中当前公式", ICONS.center)}
        ${button("expand", "展开所选分支", ICONS.expand)}
        ${button("collapse", "收起旁支", ICONS.collapse)}
      </div>
      <div class="formula-graph-canvas" role="img" aria-label="公式推导关系网络图"></div>
      <p class="formula-graph-status" aria-live="polite"></p>`;
    const canvas = host.querySelector(".formula-graph-canvas");
    const status = host.querySelector(".formula-graph-status");

    function nodeElement(node) {
      return {
        group: "nodes",
        data: {
          id: String(node.id),
          label: `${String(node.displayName || "公式")}\n${String(node.latex || "")}`,
          slug: String(node.slug || ""),
          rank: Number(node.rank || 0),
          direction: String(node.direction || ""),
          current: node.current ? "true" : "false",
          publishStatus: String(node.publishStatus || "")
        },
        classes: [
          node.current ? "is-current" : "",
          node.direction ? `is-${node.direction}` : "",
          node.publishStatus ? `is-${node.publishStatus}` : ""
        ]
          .filter(Boolean)
          .join(" ")
      };
    }

    function edgeElement(edge) {
      return {
        group: "edges",
        data: {
          id: String(edge.id),
          source: String(edge.source),
          target: String(edge.target)
        }
      };
    }

    function elementsForVisible() {
      const nodes = [...visibleIds]
        .map((nodeId) => allNodes.get(nodeId))
        .filter(Boolean)
        .map(nodeElement);
      const edges = [...allEdges.values()]
        .filter(
          (edge) =>
            visibleIds.has(String(edge.source)) && visibleIds.has(String(edge.target))
        )
        .map(edgeElement);
      return [...nodes, ...edges];
    }

    const cy = global.cytoscape({
      container: canvas,
      elements: elementsForVisible(),
      minZoom: 0.35,
      maxZoom: 2.4,
      boxSelectionEnabled: false,
      autoungrabify: false,
      style: [
        {
          selector: "node",
          style: {
            shape: "round-rectangle",
            width: 168,
            height: 64,
            padding: 8,
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": 150,
            "font-size": 11,
            "line-height": 1.35,
            "text-valign": "center",
            "text-halign": "center",
            color: "#17202a",
            "background-color": "#f8fafc",
            "border-color": "#7b8794",
            "border-width": 1.5
          }
        },
        {
          selector: "node.is-current",
          style: {
            "background-color": "#fff4cf",
            "border-color": "#b35c00",
            "border-width": 3,
            color: "#4a2a00",
            "font-weight": 700
          }
        },
        {
          selector: "node.is-draft",
          style: {
            "border-style": "dashed",
            "border-color": "#8a5d00"
          }
        },
        {
          selector: "node.is-archived",
          style: {
            opacity: 0.58,
            "border-style": "dotted"
          }
        },
        {
          selector: "node:selected",
          style: {
            "overlay-opacity": 0,
            "border-color": "#0b6bcb",
            "border-width": 3
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
            "arrow-scale": 0.85
          }
        }
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        padding: 24,
        spacingFactor: 1.2,
        animate: false
      }
    });

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

    function updateStatus(message = "") {
      if (!status) return;
      const hidden = Math.max(0, allNodes.size - visibleIds.size);
      status.textContent =
        message ||
        `当前显示 ${visibleIds.size} 个节点${hidden ? `，另有 ${hidden} 个节点可按需展开` : ""}。`;
    }

    function relayout(fit = true) {
      cy.layout({
        name: "breadthfirst",
        directed: true,
        padding: 24,
        spacingFactor: 1.2,
        animate: false
      }).run();
      if (fit) cy.fit(cy.elements(), 28);
      updateStatus();
    }

    function rebuild(fit = true) {
      cy.elements().remove();
      cy.add(elementsForVisible());
      relayout(fit);
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
      selectedId = String(graph.currentNodeId || "");
      rebuild(true);
      updateStatus("已收起到默认聚焦范围。");
    }

    function centerCurrent() {
      const current = cy.getElementById(String(graph.currentNodeId || ""));
      if (current.length) {
        cy.animate({ center: { eles: current }, duration: 180 });
        current.select();
      }
    }

    cy.on("select tap", "node", (event) => {
      selectedId = event.target.id();
    });
    cy.on("tap", "node", (event) => {
      const nodeId = event.target.id();
      if (hiddenNeighbors(nodeId).length) {
        expand(nodeId);
        return;
      }
      const slug = String(event.target.data("slug") || "");
      if (!slug || options.navigation === false) return;
      const href = `${String(options.hrefPrefix || "./derive.html?formula=")}${encodeURIComponent(slug)}`;
      if (typeof options.onNavigate === "function") options.onNavigate(href, slug);
      else global.location.href = href;
    });

    host.addEventListener("click", (event) => {
      const control = event.target.closest("[data-graph-action]");
      if (!control) return;
      const action = control.dataset.graphAction;
      if (action === "zoom-in") cy.zoom({ level: Math.min(cy.maxZoom(), cy.zoom() * 1.2), renderedPosition: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } });
      if (action === "zoom-out") cy.zoom({ level: Math.max(cy.minZoom(), cy.zoom() / 1.2), renderedPosition: { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 } });
      if (action === "fit") cy.fit(cy.elements(), 28);
      if (action === "center") centerCurrent();
      if (action === "expand") expand();
      if (action === "collapse") collapse();
    });

    const resizeObserver =
      typeof global.ResizeObserver === "function"
        ? new global.ResizeObserver(() => {
            cy.resize();
          })
        : null;
    resizeObserver?.observe(host);
    updateStatus();

    const api = {
      cy,
      expand,
      collapse,
      centerCurrent,
      fit: () => cy.fit(cy.elements(), 28),
      visibleNodeCount: () => visibleIds.size,
      destroy() {
        resizeObserver?.disconnect();
        cy.destroy();
      }
    };
    host._formulaGraph = api;
    return api;
  }

  global.LarkixFormulaGraph = { mount };
})(window);
