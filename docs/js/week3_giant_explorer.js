// Week 3 explorable: pick a character's local neighborhood, then click any node to remove it.
// Node SIZE is degree (how connected, within whatever's currently on screen); node COLOR is a
// sequential ramp on betweenness centrality (how load-bearing) — a from-scratch Brandes'
// algorithm running in your browser (same idea as the hand-rolled BFS earlier), cached once per
// click rather than recalculated continuously. Faded nodes have been stranded outside the
// current giant component. Removed nodes just vanish; everyone else stays put so the view
// doesn't reshuffle on every click — only size/color/opacity animate.

(function () {
  const container = document.getElementById('giantCy');
  if (!container) return;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function lerpColor(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  }

  function buildAdjacency(nodeIds, edges) {
    const adj = new Map();
    nodeIds.forEach(id => adj.set(id, []));
    edges.forEach(e => { adj.get(e.source).push(e.target); adj.get(e.target).push(e.source); });
    return adj;
  }

  function inducedAdjacency(fullAdj, activeSet) {
    const adj = new Map();
    activeSet.forEach(id => adj.set(id, fullAdj.get(id).filter(n => activeSet.has(n))));
    return adj;
  }

  // Plain BFS, bounded by radius — a character's local neighborhood out to N hops.
  // Returns a Map(id -> hop distance from center), so callers can both list the
  // neighborhood and place nodes by how many hops out they are.
  function egoNetworkDist(center, radius, adj) {
    const dist = new Map([[center, 0]]);
    const queue = [center];
    let qi = 0;
    while (qi < queue.length) {
      const u = queue[qi++];
      if (dist.get(u) >= radius) continue;
      for (const v of adj.get(u)) {
        if (!dist.has(v)) { dist.set(v, dist.get(u) + 1); queue.push(v); }
      }
    }
    return dist;
  }

  function bfsComponents(activeSet, adj) {
    const seen = new Set();
    const comps = [];
    for (const start of activeSet) {
      if (seen.has(start)) continue;
      const comp = [start];
      seen.add(start);
      const queue = [start];
      let qi = 0;
      while (qi < queue.length) {
        const u = queue[qi++];
        for (const v of adj.get(u)) {
          if (!seen.has(v)) { seen.add(v); comp.push(v); queue.push(v); }
        }
      }
      comps.push(comp);
    }
    return comps;
  }

  // Brandes' algorithm: unweighted, undirected node betweenness centrality.
  function betweenness(activeList, adj) {
    const bc = {}; activeList.forEach(v => bc[v] = 0);
    for (const s of activeList) {
      const S = [];
      const P = {}; activeList.forEach(v => P[v] = []);
      const sigma = {}; activeList.forEach(v => sigma[v] = 0); sigma[s] = 1;
      const d = {}; activeList.forEach(v => d[v] = -1); d[s] = 0;
      const Q = [s]; let qi = 0;
      while (qi < Q.length) {
        const v = Q[qi++];
        S.push(v);
        for (const w of adj.get(v)) {
          if (d[w] < 0) { Q.push(w); d[w] = d[v] + 1; }
          if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
        }
      }
      const delta = {}; activeList.forEach(v => delta[v] = 0);
      while (S.length) {
        const w = S.pop();
        for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) bc[w] += delta[w];
      }
    }
    // Match networkx's default normalization for the *current* active graph size k,
    // recomputed fresh per view/removal (not the original 277).
    const k = activeList.length;
    const norm = k > 2 ? (k - 1) * (k - 2) / 2 : 1;
    activeList.forEach(v => bc[v] = bc[v] / 2 / norm);
    return bc;
  }

  const PRESETS = [
    { key: 'hercules_usagent', label: "Hercules + U.S. Agent together (47 nodes)", centers: [{ id: 'Hercules_(Marvel_Comics)', radius: 1 }, { id: 'U.S._Agent', radius: 1 }] },
    { key: 'hercules_blackwidow', label: "Hercules + Black Widow together (48 nodes)", centers: [{ id: 'Hercules_(Marvel_Comics)', radius: 1 }, { id: 'Black_Widow_(Natasha_Romanova)', radius: 1 }] },
    { key: 'blackwidow_usagent', label: "Black Widow + U.S. Agent together (43 nodes)", centers: [{ id: 'Black_Widow_(Natasha_Romanova)', radius: 1 }, { id: 'U.S._Agent', radius: 1 }] },
    { key: 'all_three', label: "All three bridges together (65 nodes)", centers: [{ id: 'Hercules_(Marvel_Comics)', radius: 1 }, { id: 'Black_Widow_(Natasha_Romanova)', radius: 1 }, { id: 'U.S._Agent', radius: 1 }] },
  ];

  fetch('data/week3_giant_component.json')
    .then(r => r.json())
    .then(init)
    .catch(err => {
      container.innerHTML = '<p style="padding:20px;color:var(--muted)">Could not load the network data.</p>';
      console.error(err);
    });

  function init(DATA) {
    const nameById = {};
    DATA.nodes.forEach(n => nameById[n.id] = n.name);

    const fullAdj = buildAdjacency(DATA.nodes.map(n => n.id), DATA.edges);

    let activeSet = new Set();
    let currentBC = {};
    let currentDeg = {};
    let currentGiantSet = new Set();
    let maxBC = 0.0001;

    function nodeSize(ele) { return 14 + 5.5 * Math.sqrt(Math.max(ele.data('degVal'), 0)); }

    const cy = cytoscape({
      container: container,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': ele => lerpColor(cssVar('--bc-low'), cssVar('--bc-high'), ele.data('bcVal') / maxBC),
            'opacity': ele => ele.data('inGiant') ? 1 : 0.32,
            'width': nodeSize,
            'height': nodeSize,
            'label': ele => ele.data('name'),
            'font-size': 6,
            'text-wrap': 'wrap',
            'text-max-width': ele => nodeSize(ele) - 4 + 'px',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': cssVar('--ink'),
            'text-outline-color': cssVar('--surface-raised'),
            'text-outline-width': 1.5,
            'text-outline-opacity': 1,
            'min-zoomed-font-size': 6,
            'border-width': 1,
            'border-color': cssVar('--surface'),
            'transition-property': 'background-color, width, height, opacity',
            'transition-duration': 0.4,
            'transition-timing-function': 'ease-out',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 0.75,
            'line-color': cssVar('--border'),
            'curve-style': 'haystack',
            'haystack-radius': 0.15,
            'opacity': 0.5,
          }
        }
      ],
      wheelSensitivity: 0.25,
      minZoom: 0.15,
      maxZoom: 3,
    });

    function runLayout() {
      cy.layout({
        name: 'cose',
        animate: false,
        randomize: true,
        fit: true,
        nodeRepulsion: 9000,
        idealEdgeLength: 40,
        gravity: 40,
      }).run();
    }

    function recomputeState() {
      const activeList = Array.from(activeSet);
      const adj = inducedAdjacency(fullAdj, activeSet);
      currentBC = betweenness(activeList, adj);
      currentDeg = {}; activeList.forEach(v => currentDeg[v] = adj.get(v).length);
      maxBC = Math.max(0.0001, ...Object.values(currentBC));
      const comps = bfsComponents(activeSet, adj);
      comps.sort((a, b) => b.length - a.length);
      currentGiantSet = new Set(comps[0] || []);
      return comps.length;
    }

    function refreshStyles() {
      cy.nodes().forEach(ele => {
        const id = ele.id();
        ele.data('bcVal', currentBC[id] ?? 0);
        ele.data('degVal', currentDeg[id] ?? 0);
        ele.data('inGiant', currentGiantSet.has(id));
      });
      cy.style().update();
    }

    function renderStats(nComponents) {
      document.getElementById('giantStatRemoved').textContent = baselineSize() - activeSet.size;
      document.getElementById('giantStatGiant').textContent = currentGiantSet.size;
      document.getElementById('giantStatFragments').textContent = nComponents;
      let topNode = '—', topVal = -1;
      for (const id of activeSet) { if (currentBC[id] > topVal) { topVal = currentBC[id]; topNode = nameById[id]; } }
      document.getElementById('giantStatTop').textContent = activeSet.size ? topNode : '—';
    }

    let baselineIds = [];
    function baselineSize() { return baselineIds.length; }

    function loadView(presetKey) {
      const preset = PRESETS.find(p => p.key === presetKey) || PRESETS[0];
      const idSetUnion = new Set();
      preset.centers.forEach(c => egoNetworkDist(c.id, c.radius, fullAdj).forEach((d, id) => idSetUnion.add(id)));
      baselineIds = Array.from(idSetUnion);
      activeSet = new Set(baselineIds);

      const inducedEdges = DATA.edges.filter(e => idSetUnion.has(e.source) && idSetUnion.has(e.target));

      cy.elements().remove();
      cy.add({
        nodes: baselineIds.map(id => ({ data: { id, name: nameById[id], bcVal: 0, degVal: 0, inGiant: true } })),
        edges: inducedEdges.map((e, i) => ({ data: { id: 'ge' + i, source: e.source, target: e.target } })),
      });

      recomputeState();
      refreshStyles();
      runLayout();
      renderStats(1);
      document.getElementById('giantStatTotal').textContent = baselineIds.length;
    }

    function removeNode(id) {
      if (!activeSet.has(id)) return;
      activeSet.delete(id);
      const ele = cy.getElementById(id);
      if (ele.length) cy.remove(ele);
      const nComponents = recomputeState();
      refreshStyles();
      renderStats(nComponents);
    }

    cy.on('tap', 'node', evt => removeNode(evt.target.id()));

    const tooltip = document.getElementById('giantTooltip');
    cy.on('mouseover', 'node', evt => {
      const n = evt.target;
      tooltip.innerHTML = `<div class="name">${n.data('name')}</div>degree ${n.data('degVal')} &middot; current betweenness ${n.data('bcVal').toFixed(4)}`;
      tooltip.style.display = 'block';
    });
    cy.on('mousemove', 'node', evt => {
      tooltip.style.left = (evt.originalEvent.clientX + 14) + 'px';
      tooltip.style.top = (evt.originalEvent.clientY + 14) + 'px';
    });
    cy.on('mouseout', 'node', () => { tooltip.style.display = 'none'; });

    document.getElementById('giantResetBtn').addEventListener('click', () => {
      loadView(document.getElementById('giantPresetSelect').value);
    });
    document.getElementById('giantPresetSelect').addEventListener('change', evt => {
      loadView(evt.target.value);
    });

    loadView(document.getElementById('giantPresetSelect').value || PRESETS[0].key);
  }
})();
