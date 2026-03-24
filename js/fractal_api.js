// fractal_api.js
// Choose local backend for dev, but allow a deployed backend for demo/production.
const LOCAL_API_URL = "/generate-map";
const PROD_API_URL = "/generate-map";

function getApiUrlCandidates() {
  const host = (window.location && window.location.hostname) ? window.location.hostname : "";
  // When served from localhost/127.0.0.1, prefer local first.
  if (host === "localhost" || host === "127.0.0.1") return [LOCAL_API_URL, PROD_API_URL];
  return [PROD_API_URL, LOCAL_API_URL];
}

window.fractalNodeData = {};
window.fractalEdgeData = [];

function applyDemoFallback() {
  const demoNodes = getFallbackNodes();
  window.fractalNodeData = {};
  window.fractalEdgeData = [];

  demoNodes.forEach((name, i) => {
    const isEmergent = name.toLowerCase().includes("emergent");
    // renderGraph() treats color==='grey' as emergent.
    window.fractalNodeData[name] = {
      summary: "",
      color: isEmergent ? "grey" : "blue",
      id: "demo-" + i
    };
  });

  // Minimal edges so the graph layout has something to show.
  if (demoNodes.length >= 3) {
    window.fractalEdgeData = [
      { source: demoNodes[0], target: demoNodes[1], relationship: "tension" },
      { source: demoNodes[1], target: demoNodes[2], relationship: "supports" }
    ];
  }

  return demoNodes;
}

async function getSubPages(query) {
  try {
    // Prevent stale data from previous calls.
    window.fractalNodeData = {};
    window.fractalEdgeData = [];

    const candidates = getApiUrlCandidates();
    let lastErr = null;

    for (const apiUrl of candidates) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query })
        });

        if (!response.ok) {
          lastErr = new Error("API returned " + response.status + " " + response.statusText);
          continue;
        }

        const data = await response.json();
        if (!data || !Array.isArray(data.nodes)) {
          lastErr = new Error("Bad API response: missing data.nodes");
          continue;
        }

        data.nodes.forEach(node => {
          window.fractalNodeData[node.name] = { name: node.name, summary: node.summary, color: node.color, id: node.id };
        });
        window.fractalEdgeData = Array.isArray(data.edges) ? data.edges : [];

        const names = data.nodes.map(node => node.name);
        checkDemoMode(names);
        return names;
      } catch (err) {
        lastErr = err;
      }
    }

    // If every candidate URL fails, show demo nodes and a banner.
    console.error("Fractal API unreachable:", lastErr);
    const demoNodes = applyDemoFallback();
    checkDemoMode(demoNodes);
    return demoNodes;
  } catch (err) {
    console.error("Fractal API unreachable:", err);
    const demoNodes = applyDemoFallback();
    checkDemoMode(demoNodes);
    return demoNodes;
  }
}

function getFractalNodeColor(nodeName) {
  const nodeData = window.fractalNodeData[nodeName];
  return nodeData ? nodeData.color : "#4A90D9";
}

function getFractalNodeSummary(nodeName) {
  const nodeData = window.fractalNodeData[nodeName];
  return nodeData ? nodeData.summary : "";
}

function getFallbackNodes() {
  return ["Structural Force (DEMO)", "Competing Pressure (DEMO)", "Hidden Constraint (DEMO)", "Emergent Pattern (DEMO)"];
}

async function fetchPageTitle(query) { return query; }

async function getRandomArticle() {
  const randomQueries = [
    "why do empires fall", "the future of work", "why do startups fail",
    "how does democracy erode", "the science of creativity",
    "why is housing so expensive", "how does language shape thought",
    "the future of artificial intelligence"
  ];
  return randomQueries[Math.floor(Math.random() * randomQueries.length)];
}

function checkDemoMode(nodes) {
  const isDemo = nodes.some(n => n.includes('(DEMO)'));
  let banner = document.getElementById('demo-banner');
  if (isDemo) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'demo-banner';
      banner.innerHTML = '<span class="demo-dot"></span>DEMO MODE — AI not connected';
      document.body.appendChild(banner);
    }
  } else {
    if (banner) banner.remove();
  }
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  let isDark = true;

  function applyTheme() {
    const bg = isDark ? '#0a0a0f' : '#f8f8fc';
    const fg = isDark ? '#e8e8f0' : '#1a1a2e';

    document.body.style.background = bg;
    document.body.style.backgroundColor = bg;
    document.documentElement.style.backgroundColor = bg;

    const container = document.getElementById('container');
    if (container) {
      container.style.background = bg;
      container.style.backgroundImage = isDark
        ? 'radial-gradient(circle, rgba(74,144,217,0.12) 1px, transparent 1px)'
        : 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)';
      container.style.backgroundSize = '28px 28px';
    }

    const canvas = document.querySelector('#container canvas');
    if (canvas) canvas.style.backgroundColor = bg;
    try { if (window.network) window.network.canvas.frame.canvas.style.backgroundColor = bg; } catch(e) {}

    const formbox = document.getElementById('formbox');
    const info = document.getElementById('info');
    if (formbox) formbox.style.background = isDark ? 'rgba(10,10,20,0.92)' : 'rgba(248,248,252,0.92)';
    // Don't override intro card background
    document.querySelectorAll('#info p').forEach(el => el.style.color = fg);

    const buttons = document.getElementById('buttons');
    if (buttons) buttons.style.background = isDark ? 'rgba(10,10,20,0.92)' : 'rgba(248,248,252,0.92)';

    const input = document.getElementById('input');
    if (input) {
      input.style.color = isDark ? '#ffffff' : '#1a1a2e';
      input.style.webkitTextFillColor = isDark ? '#ffffff' : '#1a1a2e';
    }
    document.querySelectorAll('.commafield input').forEach(el => {
      el.style.color = isDark ? '#ffffff' : '#1a1a2e';
    });

    if (window.network) {
      window.network.setOptions({ nodes: { font: { color: fg } } });
      window.network.redraw();
    }

    btn.querySelector('i').className = isDark ? 'icon ion-ios-moon' : 'icon ion-ios-sunny';
  }

  btn.addEventListener('click', function() {
    isDark = !isDark;
    applyTheme();
  });

  applyTheme();
}

// Brutalist search input tag behavior
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('fractal-typing');
  const field = document.getElementById('input');
  if (!input || !field) return;

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
      e.preventDefault();
      createSearchTag(this.value.trim());
      this.value = '';
    }
    if (e.key === 'Backspace' && this.value === '') {
      const tags = field.querySelectorAll('.search-tag');
      if (tags.length > 0) tags[tags.length - 1].remove();
    }
  });

  function createSearchTag(text) {
    const tag = document.createElement('div');
    tag.className = 'search-tag item';
    tag.innerHTML = '<span>' + text + '</span><span class="delete-x">✕</span>';
    tag.addEventListener('click', function() { this.remove(); input.focus(); });
    field.insertBefore(tag, input);
  }
});
