// Exercise 2.10 — "Stub Pairing" explorable
//
// Demonstrates, visually, the mechanism behind the config-model-vs-edge-swap gap
// found in Exercise 2.8: random stub matching disproportionately produces
// self-loops and parallel edges at high-degree nodes, so cleaning them up
// disproportionately shrinks hub degree.

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PRESETS = {
    homogeneous: {
      label: "Homogeneous (no hubs)",
      nodes: [
        ["Character A", 5], ["Character B", 5], ["Character C", 5], ["Character D", 5],
        ["Character E", 5], ["Character F", 5], ["Character G", 5], ["Character H", 5],
        ["Character I", 5], ["Character J", 5], ["Character K", 5], ["Character L", 5],
        ["Character M", 5], ["Character N", 5], ["Character O", 5], ["Character P", 5],
      ],
    },
    heavy: {
      label: "Heavy-tailed (Marvel-shaped)",
      nodes: [
        ["Spider-Man", 20], ["Hulk", 12], ["Wolverine", 10], ["Black Cat", 6],
        ["Cyclops", 6], ["Rachel Summers", 4], ["Nova", 4], ["Human Torch", 3],
        ["Mayday Parker", 3], ["Morbius", 2], ["Genis-Vell", 2], ["Kristoff Vernard", 2],
        ["Red Raven", 1], ["Black Rider", 1], ["Dargo Ktor", 1], ["Captain Ultra", 1],
      ],
    },
  };

  let names = [];
  let degrees = [];
  let svg, statsBox, trialsChart, presetSelect;
  const W = 600, H = 460, CX = 300, CY = 220, R = 170;

  function positions(n) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      pts.push([CX + R * Math.cos(a), CY + R * Math.sin(a)]);
    }
    return pts;
  }

  function loadPreset(key) {
    const p = PRESETS[key];
    names = p.nodes.map((d) => d[0]);
    degrees = p.nodes.map((d) => d[1]);
    drawBase();
    updateStats(null);
    clearTrialsChart();
  }

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function drawBase() {
    svg.innerHTML = "";
    const pts = positions(names.length);
    const maxDeg = Math.max(...degrees);
    pts.forEach(([x, y], i) => {
      const r = 6 + 10 * (degrees[i] / maxDeg);
      svg.appendChild(el("circle", { cx: x, cy: y, r, class: "stub-node", fill: "#667eea", "fill-opacity": 0.85 }));
      const label = el("text", {
        x, y: y + (y > CY ? r + 14 : -r - 8),
        "text-anchor": "middle", class: "stub-label",
      });
      label.textContent = `${names[i]} (${degrees[i]})`;
      svg.appendChild(label);
    });
  }

  function buildStubs() {
    const stubs = [];
    degrees.forEach((d, i) => { for (let k = 0; k < d; k++) stubs.push(i); });
    if (stubs.length % 2 === 1) stubs.pop(); // configuration_model requires an even stub count
    for (let i = stubs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [stubs[i], stubs[j]] = [stubs[j], stubs[i]];
    }
    const pairs = [];
    for (let i = 0; i < stubs.length; i += 2) pairs.push([stubs[i], stubs[i + 1]]);
    return pairs;
  }

  function classifyPairs(pairs) {
    const seen = new Set();
    const lostByNode = new Array(names.length).fill(0);
    const classified = pairs.map(([a, b]) => {
      if (a === b) {
        lostByNode[a] += 2; // a self-loop consumes two stubs from the same node
        return { a, b, kind: "self" };
      }
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) {
        lostByNode[a] += 1; lostByNode[b] += 1;
        return { a, b, kind: "parallel" };
      }
      seen.add(key);
      return { a, b, kind: "kept" };
    });
    return { classified, lostByNode, edgesKept: seen.size };
  }

  function drawEdge(a, b, kind, pts) {
    const [x1, y1] = pts[a];
    if (kind === "self") {
      const [x, y] = pts[a];
      const dx = x - CX, dy = y - CY;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (dx / len) * 26, oy = (dy / len) * 26;
      const loop = el("circle", {
        cx: x + ox, cy: y + oy, r: 12, fill: "none",
        stroke: "#e0424f", "stroke-width": 2, "stroke-opacity": 0.85,
      });
      svg.appendChild(loop);
      return;
    }
    const [x2, y2] = pts[b];
    const mx = (x1 + x2) / 2 + (CY - (y1 + y2) / 2) * 0.08;
    const my = (y1 + y2) / 2 + ((x1 + x2) / 2 - CX) * 0.08;
    const path = el("path", {
      d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
      fill: "none",
      stroke: kind === "parallel" ? "#eb6834" : "#2a78d6",
      "stroke-width": kind === "parallel" ? 1.6 : 1.8,
      "stroke-dasharray": kind === "parallel" ? "4 3" : "none",
      "stroke-opacity": kind === "parallel" ? 0.75 : 0.55,
    });
    svg.appendChild(path);
  }

  function updateStats(result) {
    if (!result) {
      statsBox.innerHTML = `
        <h4>Stats</h4>
        <div class="stat-line"><span class="k">Nodes</span><span class="v">${names.length}</span></div>
        <div class="stat-line"><span class="k">Total stubs</span><span class="v">${degrees.reduce((a, b) => a + b, 0)}</span></div>
        <div class="stat-line"><span class="k">Click "Shuffle Stubs"</span><span class="v">&rarr;</span></div>`;
      return;
    }
    const { classified, edgesKept } = result;
    const selfLoops = classified.filter((c) => c.kind === "self").length;
    const parallels = classified.filter((c) => c.kind === "parallel").length;
    const intended = classified.length;
    statsBox.innerHTML = `
      <h4>This shuffle</h4>
      <div class="stat-line"><span class="k">Intended edges</span><span class="v">${intended}</span></div>
      <div class="stat-line"><span class="k">Kept (simple graph)</span><span class="v">${edgesKept}</span></div>
      <div class="stat-line"><span class="k">Self-loops dropped</span><span class="v">${selfLoops}</span></div>
      <div class="stat-line"><span class="k">Parallel edges dropped</span><span class="v">${parallels}</span></div>
      <div class="stat-line"><span class="k">Edges lost</span><span class="v">${100 * (selfLoops + parallels) / intended | 0}%</span></div>`;
  }

  function shuffleOnce() {
    drawBase();
    const pts = positions(names.length);
    const pairs = buildStubs();
    const full = classifyPairs(pairs);
    let i = 0;
    const step = () => {
      if (i >= full.classified.length) { updateStats(full); return; }
      const { a, b, kind } = full.classified[i];
      drawEdge(a, b, kind, pts);
      i++;
      setTimeout(step, 25);
    };
    step();
  }

  function runTrials(nTrials) {
    const lostTotals = new Array(names.length).fill(0);
    let totalIntended = 0, totalKept = 0;
    for (let t = 0; t < nTrials; t++) {
      const pairs = buildStubs();
      const { lostByNode, edgesKept, classified } = classifyPairs(pairs);
      totalIntended += classified.length;
      totalKept += edgesKept;
      lostByNode.forEach((v, idx) => { lostTotals[idx] += v; }); // degree units lost, same definition as the Ex 2.8 notebook
    }
    const avgLost = lostTotals.map((v) => v / nTrials);
    renderTrialsChart(avgLost, nTrials);
    const lostPct = 100 * (1 - totalKept / totalIntended);
    statsBox.innerHTML = `
      <h4>${nTrials} trials, averaged</h4>
      <div class="stat-line"><span class="k">Avg. edges lost / trial</span><span class="v">${(totalIntended / nTrials - totalKept / nTrials).toFixed(1)}</span></div>
      <div class="stat-line"><span class="k">Avg. % lost</span><span class="v">${lostPct.toFixed(1)}%</span></div>
      <div class="stat-line"><span class="k">Highest-degree node lost</span><span class="v">${avgLost[0].toFixed(2)}</span></div>
      <div class="stat-line"><span class="k">Lowest-degree node lost</span><span class="v">${avgLost[avgLost.length - 1].toFixed(2)}</span></div>`;
  }

  function clearTrialsChart() {
    trialsChart.innerHTML = "";
  }

  function renderTrialsChart(avgLost, nTrials) {
    const order = names.map((_, i) => i).sort((a, b) => degrees[b] - degrees[a]);
    const w = 600, h = 220, pad = 36;
    const barW = (w - 2 * pad) / order.length;
    const maxLost = Math.max(...avgLost, 0.5);
    const svgEl = el("svg", { viewBox: `0 0 ${w} ${h}` });
    svgEl.appendChild(el("text", { x: pad, y: 16, "font-size": "11", fill: "#898781" }))
      .textContent = `Average edges lost per node over ${nTrials} trials (sorted by degree, highest first)`;
    order.forEach((idx, pos) => {
      const barH = (avgLost[idx] / maxLost) * (h - pad - 30);
      const x = pad + pos * barW;
      const y = h - pad - barH;
      svgEl.appendChild(el("rect", {
        x: x + 1, y, width: Math.max(barW - 2, 1), height: barH,
        fill: "#667eea", "fill-opacity": 0.4 + 0.5 * (degrees[idx] / degrees[order[0]]),
      }));
    });
    svgEl.appendChild(el("line", { x1: pad, y1: h - pad, x2: w - 8, y2: h - pad, stroke: "#e1e0d9" }));
    trialsChart.innerHTML = "";
    trialsChart.appendChild(svgEl);
  }

  function init() {
    svg = document.getElementById("stubSvg");
    statsBox = document.getElementById("stubStats");
    trialsChart = document.getElementById("trialsChart");
    presetSelect = document.getElementById("stubPreset");

    presetSelect.addEventListener("change", () => loadPreset(presetSelect.value));
    document.getElementById("shuffleBtn").addEventListener("click", shuffleOnce);
    document.getElementById("trialsBtn").addEventListener("click", () => runTrials(100));
    document.getElementById("resetBtn").addEventListener("click", () => loadPreset(presetSelect.value));

    loadPreset(presetSelect.value);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
