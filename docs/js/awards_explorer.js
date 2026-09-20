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

  const AWARD_TEXT = {
    one_good_friend: `
      <div class="award-eyebrow">🥇 Award 1 of 6 &middot; Best Return on a Single Connection</div>
      <h3>One Good Friend</h3>
      <p class="award-tagline">It's not what you know, it's who you know &mdash; literally.</p>
      <p class="award-blurb">
        <strong>Enigma_(Marvel_Comics)</strong>, <strong>Ethan_Edwards</strong>,
        <strong>Helix_(Marvel_Comics)</strong>, <strong>NFL_SuperPro</strong>, and
        <strong>Thunderclap_(comics)</strong> each have exactly one edge in the whole giant
        component &mdash; and every one of them spent it on the same node: Spider-Man. That
        single connection is enough to pull their closeness centrality to <strong>0.3735</strong>,
        barely below the network's <em>median</em> of 0.3812 &mdash; ahead of dozens of characters
        with four, five, even six times as many connections. <strong>Scorpio_(Marvel_Comics)</strong>
        does one better: two edges, to Spider-Man and Wolverine, and a closeness of
        <strong>0.3904</strong> &mdash; <em>above</em> the median outright.
      </p>
      <div class="callout">
        Closeness centrality measures average distance to everyone else in the network &mdash; it
        has no idea whether your one connection is a nobody or the single most-linked character in
        the entire component. Spend your one edge wisely.
      </div>`,

    popular_but_replaceable: `
      <div class="award-eyebrow">🏅 Award 2 of 6 &middot; Most Overrated by Degree</div>
      <h3>Popular But Replaceable</h3>
      <p class="award-tagline">Lots of friends, zero of them need you specifically.</p>
      <p class="award-blurb">
        <strong>Satana_(Marvel_Comics)</strong>: degree 10, clustering <strong>0.578</strong>
        &mdash; nearly the highest of any double-digit-degree node in the component &mdash; and
        betweenness centrality that ranks <strong>104th of 277</strong>, below the median. Her ten
        connections (Blade, Doctor Strange, Ghost Rider twice over, Man-Thing, Deadpool) mostly
        already know each other; there's almost always another route around her.
        <strong>Spider-Woman</strong> tells the same story at higher degree: 17 connections, most
        of them into a tight self-referential "spider family" cluster (Spider-Girl, Silk, both
        other Spider-Womans, Anya Corazon), yet her betweenness ranks only
        <strong>178th of 277</strong>.
      </p>
      <div class="callout">
        High clustering is exactly what makes a node replaceable: if your neighbors already know
        each other, removing you barely changes anyone's shortest path. Popularity and
        load-bearing pull in opposite directions here, not the same one.
      </div>`,

    big_fish_small_pond: `
      <div class="award-eyebrow">🐟 Award 3 of 6 &middot; Most Locally Important, Globally Overlooked</div>
      <h3>Big Fish, Small Pond</h3>
      <p class="award-tagline">Popular in your friend group. A stranger to everyone else.</p>
      <p class="award-blurb">
        <strong>Human_Torch_(android)</strong> has degree 17 &mdash; a genuinely well-connected
        character, top-50 in the component &mdash; and he holds together a real cluster: Bucky,
        both Union Jacks, Jeffrey Mace, Spitfire, Toro, Whizzer, Scarlet Scarab, Blue Diamond,
        Citizen V, Doctor Nemesis, a pocket of Golden Age Invaders-adjacent characters. But his
        closeness centrality is <strong>0.3876</strong>, ranking <strong>148th of 277</strong>
        &mdash; below the network median &mdash; because that whole pocket sits far from the
        modern core (Spider-Man, Wolverine, Hulk). He's the biggest fish in his pond; the pond
        itself is just off to the side of the lake.
      </p>
      <div class="callout">
        Degree only tells you about your immediate neighborhood. Closeness tells you about your
        position in the <em>whole</em> network &mdash; and a character can score well on one and
        badly on the other simply by which neighborhood they belong to.
      </div>`,

    best_of_both_worlds: `
      <div class="award-eyebrow">🎭 Award 4 of 6 &middot; Rarest Combo: Clique Member <em>and</em> Bridge</div>
      <h3>Best of Both Worlds</h3>
      <p class="award-tagline">High clustering and high betweenness aren't supposed to travel together.</p>
      <p class="award-blurb">
        <strong>Nightmask</strong>: degree just 5, clustering <strong>0.400</strong> (77th
        percentile) <em>and</em> betweenness <strong>0.00766</strong> (81st percentile &mdash;
        numerically higher than Rockman's 0.00725). His five neighbors are mostly a small "New
        Universe" cosmic-power clique (Star_Brand, Justice, Captain_Universe) that mutually
        reference each other &mdash; the source of his high clustering &mdash; but he's also the
        only route in for Mark_Hazzard:_Merc, a degree-1 dead end. Usually a node with this much
        clustering has redundant routes everywhere and low betweenness (see Award 2); Nightmask
        keeps both.
      </p>
      <div class="table-grid">
        <table class="leaderboard">
          <caption>Same trick, more connections (runners-up)</caption>
          <thead><tr><th>character</th><th>degree</th><th>clustering</th><th>betweenness</th></tr></thead>
          <tbody>
            <tr><td>Werewolf_by_Night</td><td class="num">15</td><td class="num">0.371</td><td class="num">0.00867</td></tr>
            <tr><td>Noh-Varr</td><td class="num">18</td><td class="num">0.314</td><td class="num">0.00887</td></tr>
            <tr><td>Hellion_(character)</td><td class="num">12</td><td class="num">0.303</td><td class="num">0.00933</td></tr>
          </tbody>
        </table>
      </div>
      <div class="callout">
        The runners-up pull off the same combination with more connections to work with, which
        makes it less surprising. Nightmask does it with degree 5 &mdash; the rarer and more
        interesting version.
      </div>`,

    name_dropper: `
      <div class="award-eyebrow">📇 Award 5 of 6 &middot; Least Reciprocated Citations (tie)</div>
      <h3>Name-Dropper</h3>
      <p class="award-tagline">The directed graph remembers who namechecked whom.</p>
      <p class="award-blurb">
        A tie: <strong>Solo_(Marvel_Comics)</strong> and <strong>Brian_Braddock</strong> both sit
        at in-degree <strong>1</strong> despite citing a dozen other characters apiece. Solo's
        article links out to twelve other characters, and the only one that links back is
        <strong>Paladin_(comics)</strong>. Brian_Braddock links out to eleven, and the only inbound
        link is from his own twin sister, <strong>Betsy_Braddock</strong>.
      </p>
      <p class="award-blurb">
        Reading the actual Wikipedia pages splits this tie into two different stories.
        <strong>Brian_Braddock</strong>'s article is not obscure at all &mdash; it's the full
        <em>Captain Britain</em> character page: 45+ years of publication history, an origin from
        Merlyn and Roma, a whole multiversal "Captain Britain Corps" named after him. He's central
        to Marvel's British corner of the universe; he just isn't central to
        <em>this specific 303-page crawl</em>, because the other characters whose pages would
        plausibly cite him (other Captain Britain Corps members, Excalibur teammates) aren't in
        this dataset at all. <strong>Solo</strong> is the opposite case: a genuinely mid-tier
        character &mdash; Six Pack, Force Works, Mercs for Money &mdash; whose article itself is
        flagged as needing expansion. He's mentioned in passing across several bigger characters'
        continuity, but almost none of them consider him notable enough to link back.
      </p>
      <div class="callout orange">
        Every centrality measure so far has treated the graph as undirected, which quietly assumes
        a link is a two-way acknowledgment. It usually isn't &mdash; Week 3's Ajak/Thena pair
        already showed some links go one way and stay that way. But "low in-degree" doesn't mean
        one thing: Solo is genuinely peripheral, while Brian_Braddock is a citation-graph artifact
        &mdash; a real gap between what this network measures and what actually matters in the
        fiction.
      </div>`,

    loneliest_portal: `
      <div class="award-eyebrow">🚪 Award 6 of 6 &middot; Best Supporting Cut Vertex, Isolated Division</div>
      <h3>The Loneliest Portal</h3>
      <p class="award-tagline">A whole miniature Rockman story, cut off from the rest of the universe.</p>
      <p class="award-blurb">
        Nine characters &mdash; all from Marvel's <em>Strikeforce: Morituri</em> &mdash; form
        their own connected component, completely disconnected from the 277-node giant component.
        Inside that island, <strong>Radian_(Morituri)</strong> is the only cut vertex: degree 6 of
        a possible 8, betweenness <strong>0.667</strong> within the island. Remove him and it
        splits clean in two &mdash; Snapdragon, Blackthorn, Vyking, Backhand, and Shear on one
        side; Scaredycat, Toxyn, and Scatterbrain on the other. The island's average clustering
        (0.504) is far above the giant component's (0.320): both halves are near-complete
        triangles on their own, and Radian's own clustering is a low 0.200 &mdash; the same "hub,
        not a clique member" signature as Spider-Man or Hulk have in the main network, just at
        1/30th the scale.
      </p>
      <p class="award-blurb">
        The real twist is in the Wikipedia text, not the link structure: Radian was "killed by
        Shear for supposedly turning traitor." Shear sits in the 5-node half of the split &mdash;
        meaning the edge that connects Radian to one side of his own bridge is a link to his own
        killer.
      </p>
      <div class="callout">
        Every structural property that made Rockman surprising &mdash; low personal clustering, a
        dead end depending entirely on him, a betweenness value his degree alone would never
        predict &mdash; shows up again here, inside a pocket of the network that never even
        reaches Rockman, or anyone else in the giant component, at all.
      </div>`,
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
      document.getElementById('awardTextPanel').innerHTML = AWARD_TEXT[award.key] || '';
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

    const select = document.getElementById('awardsPresetSelect');
    select.addEventListener('change', evt => {
      loadAward(evt.target.value);
    });

    document.querySelectorAll('.nav-banner a[data-award]').forEach(link => {
      link.addEventListener('click', () => {
        select.value = link.dataset.award;
        loadAward(link.dataset.award);
      });
    });

    loadAward(select.value || DATA.awards[0].key);
  }
})();
