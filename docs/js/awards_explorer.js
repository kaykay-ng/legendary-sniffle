// Centrality Awards: one shared Cytoscape widget, switched between six small
// hand-picked subgraphs (a headline character or two, plus their real GC
// neighbors) via a preset dropdown. No click-to-remove here — this page is
// about reading contradictions between centrality measures, not fragility,
// so the graph is just look-and-hover.

(function () {
  const container = document.getElementById('awardsCy');
  if (!container) return;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const ROLE_COLOR = {
    headliner: () => cssVar('--gold'),
    context: () => cssVar('--muted'),
    group_a: () => cssVar('--blue'),
    group_b: () => cssVar('--aqua'),
  };

  const ROLE_LABEL = {
    headliner: 'Award winner',
    context: 'Neighboring character',
    group_a: 'Cut off on one side',
    group_b: 'Cut off on the other side',
  };

  const AWARD_NOTE = {
    one_good_friend: 'Highlighted metric: closeness centrality — the network median is 0.381.',
    popular_but_replaceable: 'Highlighted metric: clustering coefficient vs. betweenness rank.',
    big_fish_small_pond: 'Highlighted metric: closeness centrality vs. degree.',
    best_of_both_worlds: 'Highlighted metric: clustering coefficient and betweenness, both at once.',
    name_dropper: 'Directed graph: gray edges are the winners citing someone else; orange edges are the rare case of someone citing a winner back.',
    loneliest_portal: 'This island has no path to the other 277 characters — it is its own separate component.',
  };

  fetch('data/awards_network.json')
    .then(r => r.json())
    .then(init)
    .catch(err => {
      container.innerHTML = '<p style="padding:20px;color:var(--muted)">Could not load the award network data.</p>';
      console.error(err);
    });

  function init(DATA) {
    const byKey = {};
    DATA.awards.forEach(a => { byKey[a.key] = a; });

    function nodeSize(ele) {
      const base = ele.data('role') === 'headliner' ? 20 : 14;
      return base + 4.5 * Math.sqrt(Math.max(ele.data('deg') || 0, 0));
    }

    const cy = cytoscape({
      container: container,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': ele => (ROLE_COLOR[ele.data('role')] || ROLE_COLOR.context)(),
            'width': nodeSize,
            'height': nodeSize,
            'label': ele => ele.data('name'),
            'font-size': 6.5,
            'font-weight': ele => ele.data('role') === 'headliner' ? 700 : 400,
            'text-wrap': 'wrap',
            'text-max-width': ele => nodeSize(ele) - 4 + 'px',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': cssVar('--ink'),
            'text-outline-color': cssVar('--surface-raised'),
            'text-outline-width': 1.5,
            'text-outline-opacity': 1,
            'min-zoomed-font-size': 6,
            'border-width': ele => ele.data('role') === 'headliner' ? 2 : 1,
            'border-color': ele => ele.data('role') === 'headliner' ? cssVar('--ink') : cssVar('--surface'),
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 0.9,
            'line-color': cssVar('--border'),
            'curve-style': 'haystack',
            'haystack-radius': 0.15,
            'opacity': 0.55,
          }
        },
        {
          selector: 'edge.directed',
          style: {
            'width': 0.9,
            'line-color': cssVar('--muted'),
            'target-arrow-color': cssVar('--muted'),
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.7,
            'curve-style': 'bezier',
            'opacity': 0.45,
          }
        },
        {
          selector: 'edge.directed.reciprocal',
          style: {
            'source-arrow-color': cssVar('--muted'),
            'source-arrow-shape': 'triangle',
          }
        },
        {
          selector: 'edge.directed.into-headliner',
          style: {
            'width': 2.2,
            'line-color': cssVar('--orange'),
            'target-arrow-color': cssVar('--orange'),
            'source-arrow-color': cssVar('--orange'),
            'arrow-scale': 1,
            'opacity': 1,
            'z-index': 10,
          }
        }
      ],
      wheelSensitivity: 0.25,
      minZoom: 0.2,
      maxZoom: 3,
    });

    function runLayout() {
      cy.layout({
        name: 'cose',
        animate: false,
        randomize: true,
        fit: true,
        nodeRepulsion: 7000,
        idealEdgeLength: 36,
        gravity: 45,
      }).run();
    }

    function updateLegend(award) {
      const roles = Array.from(new Set(award.nodes.map(n => n.role)));
      const legend = document.getElementById('awardsLegend');
      legend.innerHTML = roles.map(r =>
        `<span><span class="swatch dot" style="background:${(ROLE_COLOR[r] || ROLE_COLOR.context)()}"></span>${ROLE_LABEL[r] || r}</span>`
      ).join('');
      document.getElementById('awardsNote').textContent = AWARD_NOTE[award.key] || '';
    }

    function loadAward(key) {
      const award = byKey[key] || DATA.awards[0];
      cy.elements().remove();
      cy.add({
        nodes: award.nodes.map(n => ({ data: { id: n.id, name: n.name, role: n.role, deg: n.deg, clo: n.clo, bet: n.bet, clu: n.clu, indeg: n.indeg, outdeg: n.outdeg } })),
        edges: award.edges.map((e, i) => {
          let classes = '';
          if (award.directed) {
            classes = 'directed';
            if (e.reciprocal) classes += ' reciprocal';
            if (e.intoHeadliner) classes += ' into-headliner';
          }
          return { data: { id: 'ae' + i, source: e.source, target: e.target }, classes };
        }),
      });
      runLayout();
      updateLegend(award);
    }

    const tooltip = document.getElementById('awardsTooltip');
    cy.on('mouseover', 'node', evt => {
      const n = evt.target;
      const key = document.getElementById('awardsPresetSelect').value;
      let lines = [`<div class="name">${n.data('name')}</div>`];
      lines.push(`degree ${n.data('deg')}`);
      if (n.data('clo') !== null && n.data('clo') !== undefined) lines.push(`closeness ${n.data('clo').toFixed(4)}`);
      lines.push(`betweenness ${n.data('bet').toFixed(5)}`);
      lines.push(`clustering ${n.data('clu').toFixed(3)}`);
      if (key === 'name_dropper') lines.push(`in-links ${n.data('indeg')} &middot; out-links ${n.data('outdeg')}`);
      if (key === 'loneliest_portal' && n.data('role') === 'headliner') lines.push(`<em>cut vertex &mdash; removing this splits the island in two</em>`);
      tooltip.innerHTML = lines.join('<br>');
      tooltip.style.display = 'block';
    });
    cy.on('mousemove', 'node', evt => {
      tooltip.style.left = (evt.originalEvent.clientX + 14) + 'px';
      tooltip.style.top = (evt.originalEvent.clientY + 14) + 'px';
    });
    cy.on('mouseout', 'node', () => { tooltip.style.display = 'none'; });

    document.getElementById('awardsPresetSelect').addEventListener('change', evt => {
      loadAward(evt.target.value);
    });

    loadAward(document.getElementById('awardsPresetSelect').value || DATA.awards[0].key);
  }
})();
