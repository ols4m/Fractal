from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
import json
from dotenv import load_dotenv

load_dotenv()

# ── CONFIG ───────────────────────────────────────────────
ENVIRONMENT    = os.getenv("ENVIRONMENT", "dev")
OLLAMA_URL     = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "llama3")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_URL       = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama3-8b-8192")
TEMPERATURE    = 0.3

print(f"Starting Fractal backend in [{ENVIRONMENT.upper()}] mode")

# ── FALLBACK MAP ─────────────────────────────────────────
DEMO_MODE = {
    "nodes": [
        {"id": "1", "name": "Domain A",          "summary": "A core structural force shaping this topic.", "color": "#4A90D9"},
        {"id": "2", "name": "Domain B",          "summary": "A competing or complementary force.",          "color": "#50C878"},
        {"id": "3", "name": "Domain C",          "summary": "A third angle that creates real tension.",     "color": "#E8A838"},
        {"id": "4", "name": "Emergent Pattern",  "summary": "The hidden dynamic connecting all three.",     "color": "#888888"},
    ],
    "edges": [
        {"source": "1", "target": "2", "relationship": "tension"},
        {"source": "2", "target": "3", "relationship": "dependency"},
        {"source": "1", "target": "4", "relationship": "shapes"},
        {"source": "2", "target": "4", "relationship": "shapes"},
        {"source": "3", "target": "4", "relationship": "shapes"},
    ]
}

# ── PROMPT ───────────────────────────────────────────────
def build_prompt(query: str) -> str:
    return f"""You are generating a structured research field map for Fractal, an idea synthesis tool.

Return ONLY valid JSON. No prose. No markdown. No explanation. No backticks.

Use exactly this format:
{{
  "domains": [
    {{"name": "...", "summary": "..."}}
  ],
  "tensions": [
    {{"source": "...", "target": "...", "relationship": "..."}}
  ],
  "emergent_pattern": {{
    "label": "...",
    "summary": "..."
  }}
}}

Rules:
- 3 to 5 domains only
- Each summary must be 1-2 sentences, specific, not vague
- Tensions must reference real tradeoffs or constraints between domains
- emergent_pattern is a synthesized insight that reframes the whole system
- Avoid buzzwords, generic definitions, and filler language
- Focus on structural forces, not Wikipedia-style topic descriptions
- Return JSON only. Nothing else.

Query: {query}"""

# ── VALIDATION ───────────────────────────────────────────
def validate(data: dict) -> bool:
    try:
        domains  = data.get("domains", [])
        emergent = data.get("emergent_pattern", {})
        if not (3 <= len(domains) <= 5):          return False
        if not emergent.get("label"):             return False
        if not emergent.get("summary"):           return False
        for d in domains:
            if not d.get("name") or not d.get("summary"): return False
        return True
    except Exception:
        return False

# ── TRANSFORM ────────────────────────────────────────────
COLORS = ["#4A90D9", "#50C878", "#E8A838", "#E05C5C", "#9B59B6"]

def transform(data: dict) -> dict:
    nodes = []
    edges = []
    name_to_id = {}

    # Domain nodes
    for i, d in enumerate(data["domains"]):
        node_id = str(i + 1)
        name_to_id[d["name"]] = node_id
        nodes.append({
            "id":      node_id,
            "name":    d["name"],
            "summary": d["summary"],
            "color":   COLORS[i % len(COLORS)]
        })

    # Emergent grey node
    ep = data["emergent_pattern"]
    grey_id = str(len(nodes) + 1)
    name_to_id[ep["label"]] = grey_id
    nodes.append({
        "id":      grey_id,
        "name":    ep["label"],
        "summary": ep["summary"],
        "color":   "#888888"
    })

    # Tension edges
    for t in data.get("tensions", []):
        src = name_to_id.get(t["source"])
        tgt = name_to_id.get(t["target"])
        if src and tgt:
            edges.append({
                "source":       src,
                "target":       tgt,
                "relationship": t["relationship"]
            })

    # Connect all domains to emergent node
    for node in nodes[:-1]:
        edges.append({
            "source":       node["id"],
            "target":       grey_id,
            "relationship": "shapes"
        })

    return {"nodes": nodes, "edges": edges}

# ── LLM CALLS ────────────────────────────────────────────
async def call_ollama(query: str) -> dict:
    prompt = build_prompt(query)
    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OLLAMA_URL, json={
            "model":  OLLAMA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "options": {"temperature": TEMPERATURE}
        })
    content = response.json()["message"]["content"]
    # Strip any accidental markdown fences
    content = content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    return json.loads(content)

async def call_groq(query: str) -> dict:
    prompt = build_prompt(query)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json"
            },
            json={
                "model":       GROQ_MODEL,
                "messages":    [{"role": "user", "content": prompt}],
                "temperature": TEMPERATURE,
                "response_format": {"type": "json_object"}
            }
        )
    content = response.json()["choices"][0]["message"]["content"]
    return json.loads(content)

# ── APP ──────────────────────────────────────────────────
app = FastAPI(title="Fractal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

class MapRequest(BaseModel):
    query: str

@app.get("/")
def root():
    return {"status": "Fractal API running", "mode": ENVIRONMENT}

@app.post("/generate-map")
async def generate_map(request: MapRequest):
    try:
        if ENVIRONMENT == "prod":
            if not GROQ_API_KEY:
                print("No GROQ_API_KEY set, falling back to demo")
                return DEMO_MODE
            raw = await call_groq(request.query)
        else:
            raw = await call_ollama(request.query)

        if not validate(raw):
            print("Validation failed, returning demo map")
            return DEMO_MODE

        return transform(raw)

    except Exception as e:
        print(f"Error generating map: {e}")
        return DEMO_MODE
    