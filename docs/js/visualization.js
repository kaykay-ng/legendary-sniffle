let cy;
let currentLayout = 'marvel';
let zoomLabelThreshold = Infinity;
let marvelPositionsCache = null;
let marvelPositionsKey = null;

const NODE_DIAMETER = 26;
const NODE_DIAMETER_HOVER = 34;
const LAYOUTS = ['marvel', 'cose', 'grid', 'circle', 'concentric', 'breadthfirst'];
const LAYOUT_LABELS = {
    marvel: 'Marvel logo',
    cose: 'Force-directed',
    grid: 'Grid',
    circle: 'Circle',
    concentric: 'Concentric',
    breadthfirst: 'Breadth-first'
};

// Wikipedia slugs ("Wolverine_(character)") aren't great on-screen labels -
// clean them up for display; the full id is still used for data/links.
function shortLabel(id) {
    return String(id)
        .replace(/_/g, ' ')
        .replace(/\s*\((?:character|characters|comics|Marvel Comics)\)\s*$/i, '')
        .trim();
}

// Seeded PRNG so the "MARVEL" point cloud is stable across reloads/toggles
// instead of reshuffling into a different arrangement each time.
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Render the word MARVEL onto an offscreen canvas at a given resolution and
// return every filled pixel (stepped) as a candidate point.
function sampleMarvelCanvas(w, h, step) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let fontSize = Math.floor(h * 0.72);
    const setFont = (size) => { ctx.font = `900 ${size}px Impact, "Arial Black", sans-serif`; };
    setFont(fontSize);
    while (ctx.measureText('MARVEL').width > w * 0.92 && fontSize > 10) {
        fontSize -= 2;
        setFont(fontSize);
    }
    ctx.fillText('MARVEL', w / 2, h / 2 + fontSize * 0.02);

    const { data } = ctx.getImageData(0, 0, w, h);
    const candidates = [];
    for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
            if (data[(y * w + x) * 4 + 3] > 128) candidates.push({ x, y });
        }
    }
    return candidates;
}

// Render the word MARVEL, then treat its filled pixels as a point cloud: pick
// one well-spaced point per node so that laying the graph out at those
// positions spells the word out of nodes. `fit:true` rescales the whole
// result to the container afterwards, so what matters here isn't the pixel
// size of the canvas but the RATIO of point spacing to node size.
//
// A fine pixel grid over a small canvas produces plenty of candidate PIXELS
// even when there isn't remotely enough AREA to fit `count` non-overlapping
// circles at the target spacing - so growth is driven by comparing the
// letters' actual filled area against the area that many circles need at
// that spacing (packed at ~82% efficiency, since letterforms aren't a clean
// hex grid), not by the raw candidate count.
function computeMarvelPositions(nodeIds, nodeDiameter) {
    const count = nodeIds.length;
    const minDistTarget = nodeDiameter * 1.6;
    const minDistFloor = nodeDiameter * 1.05; // just enough to not visually overlap
    const step = 3;
    const packingEfficiency = 0.82;
    const neededArea = (count * Math.PI * (minDistTarget / 2) ** 2) / packingEfficiency;

    let w = 900, h = 280, candidates = [];
    for (let attempt = 0; attempt < 10; attempt++) {
        candidates = sampleMarvelCanvas(w, h, step);
        const letterArea = candidates.length * step * step;
        if (letterArea >= neededArea || w > 4200) break;
        const scale = Math.sqrt(neededArea / Math.max(letterArea, 1)) * 1.08;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }
    if (candidates.length < count) return null; // font unavailable / render failed

    const rand = mulberry32(42);
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Greedy blue-noise-ish thinning: keep points at least `dist` apart so the
    // resulting dots (and their labels) don't sit on top of each other.
    const pickWithMinDist = (dist) => {
        const out = [];
        for (const p of candidates) {
            if (out.length >= count) break;
            let ok = true;
            for (let k = 0; k < out.length; k++) {
                const dx = out[k].x - p.x, dy = out[k].y - p.y;
                if (dx * dx + dy * dy < dist * dist) { ok = false; break; }
            }
            if (ok) out.push(p);
        }
        return out;
    };

    let dist = minDistTarget;
    let picked = pickWithMinDist(dist);
    for (let guard = 0; picked.length < count && dist > minDistFloor && guard < 10; guard++) {
        dist *= 0.85;
        picked = pickWithMinDist(dist);
    }
    if (picked.length < count) {
        const have = new Set(picked);
        for (const p of candidates) {
            if (picked.length >= count) break;
            if (!have.has(p)) picked.push(p);
        }
    }

    const positions = {};
    nodeIds.forEach((id, i) => {
        const p = picked[i % picked.length];
        positions[id] = { x: p.x, y: p.y };
    });
    return positions;
}

function getMarvelPositions(nodeIds) {
    const key = `${nodeIds.length}:${NODE_DIAMETER}`;
    if (marvelPositionsKey !== key) {
        marvelPositionsCache = computeMarvelPositions(nodeIds, NODE_DIAMETER);
        marvelPositionsKey = key;
    }
    return marvelPositionsCache;
}

// Tuned spacing per layout - the defaults pack nodes (and therefore their
// labels) far too tightly for ~300 nodes to ever be readable.
function layoutConfig(name) {
    const base = { name, animate: true, animationDuration: 500, fit: true, padding: 30 };
    if (name === 'cose') {
        return Object.assign(base, {
            nodeRepulsion: 450000,
            idealEdgeLength: 130,
            nodeOverlap: 40,
            componentSpacing: 160,
            edgeElasticity: 100,
            gravity: 30,
            numIter: 1500
        });
    }
    return Object.assign(base, { directed: true, avoidOverlap: true, spacingFactor: 2.2 });
}

function updateLayoutLabel() {
    const el = document.getElementById('layoutName');
    if (el) el.textContent = `Layout: ${LAYOUT_LABELS[currentLayout] || currentLayout}`;
}

function runLayoutByName(name) {
    currentLayout = name; // single source of truth - never rely on the caller's copy

    if (name === 'marvel') {
        const nodeIds = cy.nodes().map((n) => n.id());
        const positions = getMarvelPositions(nodeIds);
        if (positions) {
            cy.edges().addClass('logo-hidden');
            cy.layout({
                name: 'preset',
                positions: (node) => positions[node.id()] || { x: 0, y: 0 },
                fit: true,
                padding: 40,
                animate: true,
                animationDuration: 500
            }).run();
            return;
        }
        currentLayout = 'cose'; // canvas text sampling failed - fall back quietly
    }
    cy.edges().removeClass('logo-hidden');
    cy.layout(layoutConfig(currentLayout)).run();
}

// Only label a handful of well-connected "hub" characters by default; every
// other label would just overlap at this density. Everything else reveals
// its label on hover, on click (with its neighborhood), or once zoomed in.
function markHubs() {
    const nodes = cy.nodes();
    if (nodes.length === 0) return;
    const topN = Math.max(10, Math.round(nodes.length * 0.06));
    nodes.removeClass('hub');
    nodes.sort((a, b) => b.degree() - a.degree()).slice(0, topN).addClass('hub');
}

function refreshZoomLabels() {
    if (cy.zoom() >= zoomLabelThreshold) {
        cy.nodes().addClass('zoomed-in');
    } else {
        cy.nodes().removeClass('zoomed-in');
    }
}

// Initialize Cytoscape
function initCytoscape(elements) {
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        // Wide enough that fit() is never clamped by a layout's natural zoom
        // (circle's ~0.05 is the smallest we see), but still bounds the mouse
        // wheel so it can't spin off to an absurd zoom level.
        minZoom: 0.02,
        maxZoom: 8,
        style: [
            {
                selector: 'node',
                style: {
                    'content': (ele) => shortLabel(ele.data('id')),
                    'background-color': '#2a78d6',
                    'color': '#0b0b0b',
                    'width': NODE_DIAMETER,
                    'height': NODE_DIAMETER,
                    'font-size': 9,
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 3,
                    'text-outline-width': 0,
                    'text-background-color': '#fcfcfb',
                    'text-background-opacity': 0.85,
                    'text-background-padding': 1,
                    'text-opacity': 0 // hidden by default - see .hub/.hovered/.zoomed-in/.labels-visible
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.4,
                    'line-color': '#c3c2b7',
                    'target-arrow-color': '#898781',
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 0.7,
                    'curve-style': 'bezier',
                    'opacity': 0.55
                }
            },
            {
                selector: 'node.hub, node.zoomed-in, node.labels-visible',
                style: { 'text-opacity': 1 }
            },
            {
                // Edges are data-driven (who links to whom), not tied to the
                // MARVEL point-cloud positions - drawing all 1,784 of them
                // across that intentionally-scattered layout just paints a
                // haze over the letterforms. Hidden while browsing that view.
                selector: 'edge.logo-hidden',
                style: { 'display': 'none' }
            },
            {
                // Cytoscape has no real ':hover' pseudo-selector (unlike CSS) - it
                // would silently match every element instead of just the hovered
                // one. Real hover is wired up below via mouseover/mouseout, which
                // toggle this class.
                selector: 'node.hovered',
                style: {
                    'background-color': '#eb6834',
                    'width': NODE_DIAMETER_HOVER,
                    'height': NODE_DIAMETER_HOVER,
                    'font-size': 11,
                    'text-opacity': 1,
                    'z-index': 10
                }
            },
            {
                selector: 'edge.hovered',
                style: {
                    'line-color': '#2a78d6',
                    'width': 2.5,
                    'opacity': 1
                }
            }
        ],
        layout: { name: 'grid' } // placeholder; replaced synchronously below before first paint
    });

    markHubs();
    runLayoutByName(currentLayout);
    updateLayoutLabel();

    // Update statistics
    updateStats();

    // Real hover highlighting (see the .hovered comment above)
    cy.on('mouseover', 'node, edge', function (evt) {
        evt.target.addClass('hovered');
    });
    cy.on('mouseout', 'node, edge', function (evt) {
        evt.target.removeClass('hovered');
    });

    // Reveal all labels once zoomed in enough that they'd have room to breathe
    cy.on('layoutstop', function () {
        zoomLabelThreshold = cy.zoom() * 1.8;
        refreshZoomLabels();
    });
    cy.on('zoom', refreshZoomLabels);

    // Add click event to nodes
    cy.on('tap', 'node', function (evt) {
        const node = evt.target;
        highlightNode(node);
    });

    // Reset highlight on canvas click
    cy.on('tap', function (evt) {
        if (evt.target === cy) {
            resetHighlight();
        }
    });
}

// Highlight a node and its connections, and show their labels
function highlightNode(node) {
    cy.elements().removeClass('labels-visible');
    cy.elements().style('opacity', 0.15);

    const neighborhood = node.closedNeighborhood(); // node + connected edges + neighbors
    neighborhood.style('opacity', 1);
    neighborhood.addClass('labels-visible');
}

// Reset highlighting
function resetHighlight() {
    cy.elements().style('opacity', 1);
    cy.elements().removeClass('labels-visible');
}

// Update network statistics
function updateStats() {
    const nodes = cy.nodes();
    const edges = cy.edges();

    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const maxEdges = nodeCount * (nodeCount - 1);
    const density = maxEdges > 0 ? (edgeCount / maxEdges).toFixed(3) : 0;

    document.getElementById('nodeCount').textContent = nodeCount;
    document.getElementById('edgeCount').textContent = edgeCount;
    document.getElementById('density').textContent = density;
}

// Change layout
function changeLayout() {
    const nextLayout = LAYOUTS[(LAYOUTS.indexOf(currentLayout) + 1) % LAYOUTS.length];
    runLayoutByName(nextLayout);
    updateLayoutLabel();
}

// Parse TSV format
function parseTSV(text) {
    const lines = text.trim().split('\n');
    const nodes = new Set();
    const edges = [];

    lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 2) {
            const source = parts[0].trim();
            const target = parts[1].trim();

            nodes.add(source);
            nodes.add(target);
            edges.push({
                data: { id: `${source}-${target}`, source, target }
            });
        }
    });

    const nodeElements = Array.from(nodes).map(id => ({
        data: { id }
    }));

    return nodeElements.concat(edges);
}

// Handle file upload
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const content = event.target.result;
        let elements;

        if (file.name.endsWith('.json')) {
            const data = JSON.parse(content);
            elements = [];

            if (data.nodes) {
                data.nodes.forEach(node => {
                    elements.push({ data: { id: node.id || node } });
                });
            }

            if (data.edges) {
                data.edges.forEach(edge => {
                    elements.push({
                        data: {
                            id: `${edge.source}-${edge.target}`,
                            source: edge.source,
                            target: edge.target
                        }
                    });
                });
            }
        } else if (file.name.endsWith('.tsv')) {
            elements = parseTSV(content);
        } else {
            alert('Please upload a JSON or TSV file');
            return;
        }

        if (cy) {
            cy.destroy();
        }
        marvelPositionsCache = null;
        marvelPositionsKey = null;
        currentLayout = 'marvel';
        initCytoscape(elements);
    };

    reader.readAsText(file);
});

// Button event listeners
document.getElementById('resetView').addEventListener('click', function() {
    if (cy) {
        cy.fit();
        resetHighlight();
    }
});

document.getElementById('toggleLayout').addEventListener('click', function() {
    changeLayout();
});

document.getElementById('toggleStats').addEventListener('click', function() {
    const stats = document.getElementById('stats');
    stats.classList.toggle('visible');
});

// Load default network data
window.addEventListener('load', function() {
    fetch('data/network.json')
        .then(response => response.json())
        .then(data => {
            const elements = [];

            if (data.nodes) {
                data.nodes.forEach(node => {
                    elements.push({ data: { id: node.id || node } });
                });
            }

            if (data.edges) {
                data.edges.forEach(edge => {
                    elements.push({
                        data: {
                            id: `${edge.source}-${edge.target}`,
                            source: edge.source,
                            target: edge.target
                        }
                    });
                });
            }

            if (elements.length > 0) {
                initCytoscape(elements);
            } else {
                console.log('No data found. Please upload a TSV or JSON file.');
            }
        })
        .catch(err => {
            console.log('Could not load default network data:', err);
            console.log('Please upload a TSV or JSON file using the file input.');
        });
});
