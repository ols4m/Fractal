// fractal_api.js
const FRACTAL_API_URL = "https://expert-space-succotash-4jj95xvvrqj9fjj44-8000.app.github.dev/generate-map";

window.fractalNodeData = {};

async function getSubPages(query) {
  try {
    const response = await fetch(FRACTAL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: query })
    });
    if (!response.ok) return getFallbackNodes();
    const data = await response.json();
    data.nodes.forEach(node => {
      window.fractalNodeData[node.name] = {
        summary: node.summary,
        color: node.color,
        id: node.id
      };
    });
    window.fractalEdgeData = data.edges;
    return data.nodes.map(node => node.name);
  } catch (err) {
    console.error("Fractal API unreachable:", err);
    return getFallbackNodes();
  }
}

function getFractalNodeColor(nodeName) {
  const nodeData = window.fractalNodeData[nodeName];
  if (!nodeData) return "#4A90D9";
  return nodeData.color;
}

function getFractalNodeSummary(nodeName) {
  const nodeData = window.fractalNodeData[nodeName];
  if (!nodeData) return "";
  return nodeData.summary;
}

function getFallbackNodes() {
  return ["Structural Force", "Competing Pressure", "Hidden Constraint", "Emergent Pattern"];
}

// ── COMPATIBILITY FUNCTIONS ───────────────────────────
// These replace functions that were in wikipedia_parse.js
// main.js expects these to exist

async function fetchPageTitle(query) {
  // In Wikipedia Map this fetched the real page title
  // For Fractal we just return the query as-is
  return query;
}

async function getRandomArticle() {
  const randomQueries = [
    "why do empires fall",
    "the future of work",
    "why do startups fail",
    "how does democracy erode",
    "the science of creativity",
    "why is housing so expensive",
    "how does language shape thought",
    "the future of artificial intelligence"
  ];
  return randomQueries[Math.floor(Math.random() * randomQueries.length)];
}

// ── THEME TOGGLE ─────────────────────────────────────
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  let isDark = true;

  function applyTheme() {
    const bg = isDark ? '#0a0a0f' : '#ffffff';
    const fg = isDark ? '#f0f0f0' : '#1a1a1a';

    document.body.style.background = bg;
    document.getElementById('container').style.background = bg;

    // Update all UI elements
    const formbox = document.getElementById('formbox');
    const info = document.getElementById('info');
    if (formbox) formbox.style.background = isDark ? 'rgba(10,10,20,0.92)' : 'rgba(255,255,255,0.92)';
    if (info) info.style.background = isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,255,0.95)';
    if (info) info.style.color = fg;
    document.querySelectorAll('#info p, #info h1').forEach(el => el.style.color = fg);

    // Update all UI elements
    const formbox = document.getElementById('formbox');
    const info = document.getElementById('info');
    if (formbox) formbox.style.background = isDark ? 'rgba(10,10,20,0.92)' : 'rgba(255,255,255,0.92)';
    if (info) info.style.background = isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,255,0.95)';
    if (info) info.style.color = fg;
    document.querySelectorAll('#info p, #info h1').forEach(el => el.style.color = fg);

    // Update vis.js canvas background
    const canvas = document.querySelector('#container canvas');
    if (canvas) canvas.style.background = bg;

    // Update network background if it exists
    if (window.network) {
      window.network.setOptions({
        nodes: {
          font: { color: fg }
        }
      });
      window.network.redraw();
    }

    btn.querySelector('i').className = isDark
      ? 'icon ion-ios-moon'
      : 'icon ion-ios-sunny';
  }

  btn.addEventListener('click', function() {
    isDark = !isDark;
    applyTheme();
  });

  // Apply dark theme on load
  applyTheme();
}


