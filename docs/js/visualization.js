let cy;
let currentLayout = 'cose';

// Initialize Cytoscape
function initCytoscape(elements) {
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,
        style: [
            {
                selector: 'node',
                style: {
                    'content': 'data(id)',
                    'background-color': '#667eea',
                    'color': '#fff',
                    'width': 40,
                    'height': 40,
                    'font-size': 12,
                    'text-valign': 'center',
                    'text-halign': 'center'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': '#ccc',
                    'target-arrow-color': '#999',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            },
            {
                selector: 'node:hover',
                style: {
                    'background-color': '#764ba2',
                    'width': 50,
                    'height': 50
                }
            },
            {
                selector: 'edge:hover',
                style: {
                    'line-color': '#667eea',
                    'width': 3
                }
            }
        ],
        layout: {
            name: currentLayout,
            directed: true,
            animate: true,
            animationDuration: 500,
            avoidOverlap: true,
            spacingFactor: 1.2
        }
    });

    // Update statistics
    updateStats();

    // Add click event to nodes
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        console.log('Clicked node:', node.id());
        highlightNode(node);
    });

    // Reset highlight on canvas click
    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            resetHighlight();
        }
    });
}

// Highlight a node and its connections
function highlightNode(node) {
    cy.elements().style('opacity', 0.3);

    node.style('opacity', 1);
    node.connectedEdges().style('opacity', 1);
    node.neighborhood().style('opacity', 1);
}

// Reset highlighting
function resetHighlight() {
    cy.elements().style('opacity', 1);
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
    const layouts = ['cose', 'grid', 'circle', 'concentric', 'breadthfirst'];
    const currentIndex = layouts.indexOf(currentLayout);
    currentLayout = layouts[(currentIndex + 1) % layouts.length];

    const layout = cy.layout({
        name: currentLayout,
        directed: true,
        animate: true,
        animationDuration: 500,
        avoidOverlap: true,
        spacingFactor: 1.2
    });

    layout.run();
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
