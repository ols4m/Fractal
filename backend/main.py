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

def build_prompt(query):
    return f"""You are generating a structured research field map for Fractal.
Return ONLY valid JSON. No prose. No markdown. No backticks.
{{
  "domains": [{{"name": "...", "summary": "..."}}],
  "tensions": [{{"source": "...", "target": "...", "relationship": "..."}}],
  "emergent_pattern": {{"label": "...", "summary": "..."}}
}}
Rules:
- Generate as many domains as the topic naturally warrants — like how many distinct linked concepts appear on a Wikipedia page about this topic. A rich, well-connected topic (e.g. "Money", "Evolution") might have 10-14 domains. A narrower topic might have 4-6. Let the conceptual richness of the query determine the count organically. Minimum 3, no hard maximum.
- Each domain must be a distinct structural force, field, or dimension — not a rephrasing of another.
- Summaries must be specific, not generic.
- relationship MUST be a single lowercase word chosen from: drives, tensions, supports, constrains, enables, conflicts, shapes, limits, produces, depends
- JSON only. No prose. No markdown. No backticks.
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
    return {"nodes":nodes,"edges":edges}

async def call_groq(query):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(GROQ_URL,
            headers={"Authorization":f"Bearer {GROQ_API_KEY}","Content-Type":"application/json"},
            json={"model":GROQ_MODEL,"messages":[{"role":"user","content":build_prompt(query)}],
                  "temperature":TEMPERATURE,"response_format":{"type":"json_object"}})
    return json.loads(r.json()["choices"][0]["message"]["content"])

app = FastAPI(title="Fractal API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class MapRequest(BaseModel):
    query: str

@app.get("/health")
def health():
    return {"status":"ok","mode":ENVIRONMENT}

@app.post("/generate-map")
async def generate_map(request: MapRequest):
    try:
        print(f"Query: {request.query}")
        if GROQ_API_KEY:
            raw = await call_groq(request.query)
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
