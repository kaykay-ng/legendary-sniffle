// Week 3 — "Betweenness Bridge" explorable
//
// Isolates the Rockman_(character) effect on a small synthetic graph: a dense
// hub clique, a bridge node with degree exactly 2, and a variable number of
// leaves hanging off the bridge. Degree of the bridge never changes as leaves
// are added — but its betweenness centrality (computed live, Brandes'
// algorithm) climbs, because more nodes depend on it as their only route to
// the rest of the network. Tick "give leaves a back door" and the bridge's
// betweenness collapses even though its own degree is untouched — importance
// to someone else's betweenness is about whether they have an alternative
// path, not about the bridge's own popularity.

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HUB_SIZE = 5;
  const BRIDGE = HUB_SIZE; // node index of the bridge

  let svg, statsBox, leavesSlider, leavesLabel, shortcutBox;

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function buildGraph(numLeaves, shortcut) {
    const n = HUB_SIZE + 1 + numLeaves;
    const adj = Array.from({ length: n }, () => []);
    const link = (a, b) => { adj[a].push(b); adj[b].push(a); };
    for (let i = 0; i < HUB_SIZE; i++) {
      for (let j = i + 1; j < HUB_SIZE; j++) link(i, j);
    }
    link(0, BRIDGE); // bridge attaches to the hub clique through node 0
    for (let l = 0; l < numLeaves; l++) {
      const leaf = BRIDGE + 1 + l;
      link(BRIDGE, leaf);
      if (shortcut) link(0, leaf);
    }
    return { adj, n };
  }

  // Brandes' algorithm — betweenness centrality, unweighted undirected graph
  function betweenness(adj) {
    const n = adj.length;
    const C = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
      const S = [];
      const P = Array.from({ length: n }, () => []);
      const sigma = new Array(n).fill(0); sigma[s] = 1;
      const d = new Array(n).fill(-1); d[s] = 0;
      const Q = [s]; let head = 0;
      while (head < Q.length) {
        const v = Q[head++]; S.push(v);
        for (const w of adj[v]) {
          if (d[w] < 0) { d[w] = d[v] + 1; Q.push(w); }
          if (d[w] === d[v] + 1) { sigma[w] += sigma[v]; P[w].push(v); }
        }
      }
      const delta = new Array(n).fill(0);
      while (S.length) {
        const w = S.pop();
        for (const v of P[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        if (w !== s) C[w] += delta[w];
      }
    }
    const norm = (n - 1) * (n - 2) > 0 ? 1 / ((n - 1) * (n - 2)) : 0;
    return C.map((x) => x * norm);
  }

  function layout(numLeaves) {
    const hubPts = [];
    for (let i = 0; i < HUB_SIZE; i++) {
      const a = (2 * Math.PI * i) / HUB_SIZE - Math.PI / 2;
      hubPts.push([150 + 60 * Math.cos(a), 170 + 60 * Math.sin(a)]);
    }
    const bridgePt = [330, 170];
    const leafPts = [];
    for (let l = 0; l < numLeaves; l++) {
      const angle = numLeaves > 1 ? -0.95 + l * (1.9 / (numLeaves - 1)) : 0;
      leafPts.push([500 + 120 * Math.cos(angle), 170 + 120 * Math.sin(angle)]);
    }
    return hubPts.concat([bridgePt], leafPts);
  }

  function draw() {
    const numLeaves = parseInt(leavesSlider.value, 10);
    const shortcut = shortcutBox.checked;
    leavesLabel.textContent = numLeaves;

    const { adj, n } = buildGraph(numLeaves, shortcut);
    const bet = betweenness(adj);
    const deg = adj.map((a) => a.length);
    const pts = layout(numLeaves);

    svg.innerHTML = "";
    for (let i = 0; i < n; i++) {
      for (const j of adj[i]) {
        if (j > i) {
          svg.appendChild(el("line", {
            x1: pts[i][0], y1: pts[i][1], x2: pts[j][0], y2: pts[j][1],
            stroke: "#c8c6bd", "stroke-width": 1.4,
          }));
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const isBridge = i === BRIDGE;
      svg.appendChild(el("circle", {
        cx: pts[i][0], cy: pts[i][1], r: isBridge ? 11 : 7,
        fill: isBridge ? "#eb6834" : "#2a78d6",
      }));
    }
    const label = el("text", {
      x: pts[BRIDGE][0] - 14, y: pts[BRIDGE][1] - 20,
      "font-size": "12", "font-weight": "700", fill: "#eb6834",
    });
    label.textContent = "bridge";
    svg.appendChild(label);

    statsBox.innerHTML = `
      <h4>Bridge node, live</h4>
      <div class="stat-line"><span class="k">Degree</span><span class="v">${deg[BRIDGE]}</span></div>
      <div class="stat-line"><span class="k">Betweenness</span><span class="v">${bet[BRIDGE].toFixed(5)}</span></div>
      <div class="stat-line"><span class="k">Leaves depending on it</span><span class="v">${numLeaves}</span></div>
      <div class="stat-line"><span class="k">Back door open?</span><span class="v">${shortcut ? "yes" : "no"}</span></div>`;
  }

  function init() {
    svg = document.getElementById("bridgeSvg");
    statsBox = document.getElementById("bridgeStats");
    leavesSlider = document.getElementById("bridgeLeaves");
    leavesLabel = document.getElementById("bridgeLeavesVal");
    shortcutBox = document.getElementById("bridgeShortcut");
    if (!svg) return; // section not present on this page

    leavesSlider.addEventListener("input", draw);
    shortcutBox.addEventListener("change", draw);
    draw();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
