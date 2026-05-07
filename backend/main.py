from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx, os, json
from dotenv import load_dotenv

load_dotenv()

ENVIRONMENT  = os.getenv("ENVIRONMENT", "dev")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"
TEMPERATURE  = 0.3

print(f"Starting Fractal backend in [{ENVIRONMENT.upper()}] mode")

DEMO_MODE = {
    "nodes": [
        {"id":"1","name":"Domain A (DEMO)","summary":"A core structural force.","color":"#4A90D9"},
        {"id":"2","name":"Domain B (DEMO)","summary":"A competing force.","color":"#50C878"},
        {"id":"3","name":"Domain C (DEMO)","summary":"A third tension.","color":"#E8A838"},
        {"id":"4","name":"Emergent Pattern (DEMO)","summary":"The hidden dynamic.","color":"#888888"},
    ],
    "edges": [
        {"source":"1","target":"2","relationship":"tension"},
        {"source":"1","target":"4","relationship":"shapes"},
        {"source":"2","target":"4","relationship":"shapes"},
        {"source":"3","target":"4","relationship":"shapes"},
    ]
}

def build_prompt(query, existing_nodes=None):
    cross_section = ""
    if existing_nodes:
        cross_section = f"""- existing_nodes already on the map: {json.dumps(existing_nodes)}
  For each new domain you generate, check if it is hyper-specifically related to any node in existing_nodes (same concept, a direct subset, or a well-known direct connection — not just thematically similar). Only flag a cross_connection when the link is very strong and specific. Add a "cross_connections" array to the JSON.
"""
    return f"""You are generating a structured research field map for Fractal.
Return ONLY valid JSON. No prose. No markdown. No backticks.
{{
  "domains": [{{"name": "...", "summary": "..."}}],
  "tensions": [{{"source": "...", "target": "...", "relationship": "..."}}],
  "emergent_pattern": {{"label": "...", "summary": "..."}},
  "cross_connections": [{{"new_node": "...", "existing_node": "...", "relationship": "..."}}]
}}
Rules:
- Generate as many domains as the topic naturally warrants — like how many distinct linked concepts appear on a Wikipedia page about this topic. A rich, well-connected topic (e.g. "Money", "Evolution") might have 10-14 domains. A narrower topic might have 4-6. Let the conceptual richness of the query determine the count organically. Minimum 3, no hard maximum.
- Each domain must be a distinct structural force, field, or dimension — not a rephrasing of another.
- Summaries must be specific, not generic.
- relationship MUST be a single lowercase word chosen from: drives, tensions, supports, constrains, enables, conflicts, shapes, limits, produces, depends
- cross_connections array is empty [] when no existing_nodes are provided or when no strong specific match exists.
{cross_section}- JSON only. No prose. No markdown. No backticks.
Query: {query}"""

def validate(data):
    try:
        d = data.get("domains", [])
        e = data.get("emergent_pattern", {})
        return (len(d) >= 3) and e.get("label") and e.get("summary")
    except:
        return False

COLORS = ["#4A90D9","#50C878","#E8A838","#E05C5C","#9B59B6","#1ABC9C","#E67E22","#3498DB","#E91E63","#8BC34A","#FF5722","#00BCD4","#FF9800","#673AB7"]

def transform(data):
    nodes, edges, n2i = [], [], {}
    for i, d in enumerate(data["domains"]):
        nid = str(i+1)
        n2i[d["name"]] = nid
        nodes.append({"id":nid,"name":d["name"],"summary":d["summary"],"color":COLORS[i%5]})
    ep = data["emergent_pattern"]
    gid = str(len(nodes)+1)
    n2i[ep["label"]] = gid
    nodes.append({"id":gid,"name":ep["label"],"summary":ep["summary"],"color":"#888888"})
    for t in data.get("tensions",[]):
        s,tg = n2i.get(t["source"]),n2i.get(t["target"])
        if s and tg: edges.append({"source":s,"target":tg,"relationship":t["relationship"]})
    for n in nodes[:-1]:
        edges.append({"source":n["id"],"target":gid,"relationship":"shapes"})
    cross_connections = []
    for cc in data.get("cross_connections", []):
        new_name = cc.get("new_node", "")
        existing_name = cc.get("existing_node", "")
        rel = cc.get("relationship", "related")
        if new_name and existing_name:
            cross_connections.append({"new_node": new_name, "existing_node": existing_name, "relationship": rel})
    return {"nodes":nodes,"edges":edges,"cross_connections":cross_connections}

async def call_groq(query, existing_nodes=None):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(GROQ_URL,
            headers={"Authorization":f"Bearer {GROQ_API_KEY}","Content-Type":"application/json"},
            json={"model":GROQ_MODEL,"messages":[{"role":"user","content":build_prompt(query, existing_nodes)}],
                  "temperature":TEMPERATURE,"response_format":{"type":"json_object"}})
    return json.loads(r.json()["choices"][0]["message"]["content"])

app = FastAPI(title="Fractal API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class MapRequest(BaseModel):
    query: str
    existing_nodes: list = []

class DescribeRequest(BaseModel):
    query: str

class ExploreRequest(BaseModel):
    topic: str

@app.get("/health")
def health():
    return {"status":"ok","mode":ENVIRONMENT}

@app.post("/describe")
async def describe_node(request: DescribeRequest):
    try:
        if not GROQ_API_KEY:
            return {"summary": f"A central inquiry into {request.query}."}
        prompt = f"""Give a direct, specific 2-sentence description of "{request.query}" as a concept, field, or domain.
Return ONLY valid JSON: {{"summary": "..."}}
No prose. No markdown. No backticks."""
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}],
                      "temperature": 0.3, "response_format": {"type": "json_object"}})
        data = json.loads(r.json()["choices"][0]["message"]["content"])
        return {"summary": data.get("summary", f"A central inquiry into {request.query}.")}
    except Exception as e:
        print(f"Describe error: {e}")
        return {"summary": f"A central inquiry into {request.query}."}

@app.post("/explore")
async def explore_topic(request: ExploreRequest):
    topic = request.topic
    wiki_extract = None
    thumbnail = None
    wiki_url = None

    try:
        encoded = topic.replace(" ", "_")
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}",
                headers={"User-Agent": "Fractal/1.0 (educational project)"}
            )
        if r.status_code == 200:
            wiki = r.json()
            wiki_extract = wiki.get("extract", "")
            thumbnail = (wiki.get("thumbnail") or {}).get("source")
            wiki_url = ((wiki.get("content_urls") or {}).get("desktop") or {}).get("page")
    except Exception as e:
        print(f"Wikipedia error: {e}")

    facts = []
    if GROQ_API_KEY:
        try:
            if wiki_extract:
                prompt = f"""Extract 4-6 specific, interesting key facts about "{topic}" from this Wikipedia text.
Return ONLY valid JSON: {{"facts": ["...", "..."]}}
Wikipedia text: {wiki_extract[:1500]}
No prose. No markdown. No backticks."""
            else:
                prompt = f"""Generate 4-6 specific, interesting key facts about "{topic}".
Return ONLY valid JSON: {{"facts": ["...", "..."]}}
No prose. No markdown. No backticks."""
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.post(GROQ_URL,
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}],
                          "temperature": 0.3, "response_format": {"type": "json_object"}})
            facts = json.loads(r.json()["choices"][0]["message"]["content"]).get("facts", [])
        except Exception as e:
            print(f"Groq facts error: {e}")

    return {"facts": facts, "thumbnail": thumbnail, "wiki_url": wiki_url}

@app.post("/generate-map")
async def generate_map(request: MapRequest):
    try:
        print(f"Query: {request.query}")
        if GROQ_API_KEY:
            raw = await call_groq(request.query, request.existing_nodes or None)
        else:
            print("No GROQ_API_KEY set - returning demo")
            return DEMO_MODE
        if not validate(raw):
            print("Validation failed")
            return DEMO_MODE
        result = transform(raw)
        print(f"Success: {len(result['nodes'])} nodes")
        return result
    except Exception as e:
        print(f"Error: {e}")
        return DEMO_MODE

app.mount("/", StaticFiles(directory="../", html=True), name="static")
