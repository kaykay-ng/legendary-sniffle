// Week 3 — "Random Walk Is PageRank" explorable
//
// PageRank's own definition (Section 5) is the stationary distribution of a
// "random surfer": at each step, with probability alpha follow a uniformly
// random outgoing link, and with probability (1-alpha) teleport to a
// uniformly random node anywhere in the network (dangling nodes with no
// outgoing links always teleport). This walks that surfer on the *real*
// directed Marvel network, tallies how often it visits each character, and
// compares the empirical visit-share against real PageRank (precomputed with
// networkx.pagerank in the week-3 notebook, alpha in {0.5, 0.85, 0.95},
// loaded from data/random_walk.json) -- the empirical ranking should
// converge onto the true one as steps accumulate. Besides letting the
// system choose (Step Once / Run N Steps, following the real alpha/teleport
// odds), you can also click any of the current character's outgoing links
// directly to steer the walk yourself -- that click still counts as a step,
// folded into the same visit tally and correlation.

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";

  let data = null;           // parsed random_walk.json
  let byId = new Map();      // id -> node record
  let allIds = [];           // fixed order, for uniform teleport / correlation
  let alpha = 0.85;
  let currentId = null;
  let visits = new Map();    // id -> count
  let totalSteps = 0;
  let logLines = [];
  let busy = false;          // guards overlapping steps during the brief animation window

  let svg, statsBox, logBox, alphaSelect, empTable, trueTable, scatterHost, walkControls;

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function randomId() {
    return allIds[Math.floor(Math.random() * allIds.length)];
  }

  function visitCount(id) {
    return visits.get(id) || 0;
  }

  function setControlsBusy(isBusy) {
    busy = isBusy;
    walkControls.querySelectorAll("button, select").forEach((elm) => { elm.disabled = isBusy; });
  }

  // --- one random-surfer step, from `fromId` (system-chosen) ---
  function decideNext(fromId) {
    const node = byId.get(fromId);
    const dangling = node.out.length === 0;
    if (dangling || Math.random() >= alpha) {
      return { nextId: randomId(), kind: dangling ? "dangling" : "teleport" };
    }
    const nextId = node.out[Math.floor(Math.random() * node.out.length)];
    return { nextId, kind: "link" };
  }

  function commitStep(decision) {
    visits.set(decision.nextId, visitCount(decision.nextId) + 1);
    totalSteps++;
    currentId = decision.nextId;
  }

  function pushLog(line) {
    logLines.unshift(line);
    logLines = logLines.slice(0, 6);
  }

  // --- ego view: current node + its outgoing links, radial layout ---
  // `interactive` (idle, no in-flight decision) makes each neighbor clickable.
  function drawEgo(highlightId, kind, interactive) {
    svg.innerHTML = "";
    const node = byId.get(currentId);
    const CX = 310, CY = 150, R = 115;

    const center = el("circle", { cx: CX, cy: CY, r: 26, fill: "#667eea" });
    svg.appendChild(center);
    const centerLabel = el("text", { x: CX, y: CY + 4, "text-anchor": "middle", class: "walk-center-label" });
    centerLabel.textContent = node.name;
    svg.appendChild(centerLabel);

    if (node.out.length === 0) {
      const msg = el("text", { x: CX, y: CY + 60, "text-anchor": "middle", class: "walk-dangling-label" });
      msg.textContent = "No outgoing links -- next step always teleports";
      svg.appendChild(msg);
      return;
    }

    const nOut = node.out.length;
    node.out.forEach((outId, i) => {
      const a = (2 * Math.PI * i) / nOut - Math.PI / 2;
      const x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      const isChosen = highlightId === outId && kind === "link";

      const group = el("g", { class: interactive ? "walk-neighbor" : "" });
      group.appendChild(el("line", {
        x1: CX, y1: CY, x2: x, y2: y,
        stroke: isChosen ? "#e0424f" : "#c9c8c2",
        "stroke-width": isChosen ? 2.5 : 1,
      }));
      group.appendChild(el("circle", {
        cx: x, cy: y, r: isChosen ? 12 : 9,
        fill: isChosen ? "#e0424f" : "#a9b3e8",
      }));
      const label = el("text", {
        x, y: y + (y > CY ? 18 : -12), "text-anchor": "middle", class: "walk-neighbor-label",
      });
      label.textContent = byId.get(outId).name;
      group.appendChild(label);

      if (interactive) {
        group.addEventListener("click", () => stepToNeighbor(outId));
        const titleEl = el("title", {});
        titleEl.textContent = `Click to walk to ${byId.get(outId).name}`;
        group.appendChild(titleEl);
      }
      svg.appendChild(group);
    });

    if (kind === "teleport" || kind === "dangling") {
      const burst = el("text", { x: CX, y: CY - 44, "text-anchor": "middle", class: "walk-teleport-label" });
      burst.textContent = "✦ teleported";
      svg.appendChild(burst);
    }
  }

  // --- Pearson correlation between empirical visit-share and true PageRank ---
  function correlation() {
    const xs = allIds.map((id) => visitCount(id) / Math.max(totalSteps, 1));
    const ys = allIds.map((id) => byId.get(id).pr[alpha]);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    const denom = Math.sqrt(sxx * syy);
    return denom > 0 ? sxy / denom : NaN;
  }

  function renderStats() {
    const r = correlation();
    const node = byId.get(currentId);
    const trueRank = [...allIds].sort((a, b) => byId.get(b).pr[alpha] - byId.get(a).pr[alpha]).indexOf(currentId) + 1;
    statsBox.innerHTML = `
      <h4>This walk</h4>
      <div class="stat-line"><span class="k">Steps taken</span><span class="v">${totalSteps.toLocaleString()}</span></div>
      <div class="stat-line"><span class="k">Currently at</span><span class="v">${node.name}</span></div>
      <div class="stat-line"><span class="k">Its true PageRank rank</span><span class="v">#${trueRank} of ${allIds.length}</span></div>
      <div class="stat-line"><span class="k">Correlation with true PageRank</span><span class="v">${Number.isNaN(r) ? "—" : r.toFixed(3)}</span></div>`;
  }

  function renderLog() {
    logBox.innerHTML = logLines.map((l) => `<div>${l}</div>`).join("");
  }

  function renderLeaderboards() {
    const byVisits = [...allIds].sort((a, b) => visitCount(b) - visitCount(a)).slice(0, 10);
    const byTruePr = [...allIds].sort((a, b) => byId.get(b).pr[alpha] - byId.get(a).pr[alpha]).slice(0, 10);

    empTable.innerHTML = `<caption>Top 10 by empirical visits (&alpha;=${alpha})</caption>
      <thead><tr><th>Character</th><th>Visits</th><th>Share</th></tr></thead>
      <tbody>${byVisits.map((id) => `<tr><td>${byId.get(id).name}</td><td class="num">${visitCount(id)}</td>` +
        `<td class="num">${totalSteps ? (100 * visitCount(id) / totalSteps).toFixed(1) : "0.0"}%</td></tr>`).join("")}</tbody>`;

    trueTable.innerHTML = `<caption>Top 10 by true PageRank (&alpha;=${alpha})</caption>
      <thead><tr><th>Character</th><th>PageRank</th></tr></thead>
      <tbody>${byTruePr.map((id) => `<tr><td>${byId.get(id).name}</td>` +
        `<td class="num">${(100 * byId.get(id).pr[alpha]).toFixed(2)}%</td></tr>`).join("")}</tbody>`;
  }

  function renderScatter() {
    const W = 480, H = 340, PAD = 42;
    const maxPr = Math.max(...allIds.map((id) => byId.get(id).pr[alpha]));
    const maxShare = Math.max(maxPr, ...allIds.map((id) => visitCount(id) / Math.max(totalSteps, 1)));
    const scale = (v) => PAD + (v / maxShare) * (Math.min(W, H) - 2 * PAD);

    const s = el("svg", { viewBox: `0 0 ${W} ${H}` });
    // y = x reference (perfect agreement)
    s.appendChild(el("line", {
      x1: scale(0), y1: H - scale(0), x2: scale(maxShare), y2: H - scale(maxShare),
      stroke: "#c9c8c2", "stroke-dasharray": "4 3",
    }));
    allIds.forEach((id) => {
      const x = visitCount(id) / Math.max(totalSteps, 1);
      const y = byId.get(id).pr[alpha];
      s.appendChild(el("circle", {
        cx: scale(x), cy: H - scale(y), r: 3.2, fill: "#667eea", "fill-opacity": 0.55,
      }));
    });
    s.appendChild(el("text", { x: PAD, y: 16, class: "walk-axis-label" })).textContent =
      "Empirical visit share (x) vs. true PageRank (y) -- points move onto the dashed diagonal as steps grow";
    scatterHost.innerHTML = "";
    scatterHost.appendChild(s);
  }

  function renderAll() {
    renderStats();
    renderLog();
    renderLeaderboards();
    renderScatter();
  }

  // Shared by both the system-chosen step (stepOnce) and a user's click on a
  // specific neighbor (stepToNeighbor): show the choice highlighted briefly,
  // then commit it into the same visit tally / correlation as any other step.
  function animateStep(fromId, decision, delay) {
    setControlsBusy(true);
    drawEgo(decision.nextId, decision.kind, false);
    const fromName = byId.get(fromId).name, toName = byId.get(decision.nextId).name;
    const verb = decision.kind === "link" ? "followed a link to" :
      decision.kind === "teleport" ? "teleported to" : "teleported (no out-links) to";
    const who = decision.userChosen ? `Step ${totalSteps + 1} (your choice)` : `Step ${totalSteps + 1}`;
    pushLog(`${who}: ${fromName} &rarr; ${verb} <strong>${toName}</strong>`);
    setTimeout(() => {
      commitStep(decision);
      drawEgo(null, null, true);
      renderAll();
      setControlsBusy(false);
    }, delay);
  }

  function stepOnce() {
    if (busy) return;
    animateStep(currentId, decideNext(currentId), 550);
  }

  function stepToNeighbor(chosenId) {
    if (busy) return;
    animateStep(currentId, { nextId: chosenId, kind: "link", userChosen: true }, 300);
  }

  function runBulk(steps) {
    if (busy) return;
    for (let i = 0; i < steps; i++) {
      commitStep(decideNext(currentId));
    }
    pushLog(`Ran ${steps.toLocaleString()} steps (total now ${totalSteps.toLocaleString()})`);
    drawEgo(null, null, true);
    renderAll();
  }

  function reset() {
    if (busy) return;
    visits = new Map();
    totalSteps = 0;
    logLines = [];
    currentId = randomId();
    pushLog(`Reset. Starting at <strong>${byId.get(currentId).name}</strong> (&alpha;=${alpha}).`);
    drawEgo(null, null, true);
    renderAll();
  }

  function init() {
    svg = document.getElementById("walkSvg");
    statsBox = document.getElementById("walkStats");
    logBox = document.getElementById("walkLog");
    alphaSelect = document.getElementById("walkAlpha");
    empTable = document.getElementById("walkEmpiricalTable");
    trueTable = document.getElementById("walkTrueTable");
    scatterHost = document.getElementById("walkScatterChart");
    walkControls = document.getElementById("walkControls");

    fetch("data/random_walk.json")
      .then((r) => r.json())
      .then((json) => {
        data = json;
        for (const nd of data.nodes) {
          byId.set(nd.id, nd);
          allIds.push(nd.id);
        }
        alpha = parseFloat(alphaSelect.value);
        reset();

        document.getElementById("walkStepBtn").addEventListener("click", stepOnce);
        document.getElementById("walkRun100Btn").addEventListener("click", () => runBulk(100));
        document.getElementById("walkRun1kBtn").addEventListener("click", () => runBulk(1000));
        document.getElementById("walkRun10kBtn").addEventListener("click", () => runBulk(10000));
        document.getElementById("walkResetBtn").addEventListener("click", reset);
        alphaSelect.addEventListener("change", () => {
          alpha = parseFloat(alphaSelect.value);
          reset();
        });
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
