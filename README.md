# Fractal

Fractal is an AI-powered idea synthesis tool. It takes any question and maps the structural forces, tensions, and hidden patterns shaping it as an interactive visual graph.

It is not a search engine. It is not a summarizer. It is a new way to think about big questions.

-----

## What It Does

You type a question — “why do empires fall”, “the future of work”, “why do startups fail” — and Fractal generates a structured map showing:

- The core domains and forces shaping the topic
- The real tensions and tradeoffs between them
- One synthesized emergent insight that reframes the whole picture

Each node is clickable and reveals a deeper summary. The goal is to make you say “I didn’t think about it like that.”

-----

## Tech Stack

- Frontend: HTML, CSS, JavaScript — built on top of the Wikipedia Map graph engine (vis.js)
- Backend: Python, FastAPI
- AI: Groq API (llama-3.3-70b-versatile) in production, Ollama in development
- Hosting: GitHub Codespaces (development), Render + Vercel (production, coming soon)

-----

## Getting Started

### Prerequisites

- Python 3.10 or higher
- A free Groq API key from https://console.groq.com

### Clone the repo

```bash
git clone https://github.com/ols4m/Fractal.git
cd Fractal
```

### Install the Wikipedia Map frontend files

The frontend is built on top of the Wikipedia Map graph engine. Pull its files into the repo:

```bash
git fetch https://github.com/controversial/wikipedia-map.git master:wikimap-master
git checkout wikimap-master -- css js index.html
git branch -d wikimap-master
```

### Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Configure environment

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and add your Groq API key:

```
ENVIRONMENT=prod
GROQ_API_KEY=your_key_here
```

### Run the backend

```bash
cd backend
uvicorn main:app --reload
```

### Run the frontend

Open a second terminal:

```bash
python3 -m http.server 3000
```

Open your browser and go to `http://localhost:3000`

-----

## Development Mode

To develop locally without a Groq API key, set the environment to dev and install Ollama:

```bash
# Install Ollama from https://ollama.com
ollama pull llama3.2
```

Update `backend/.env`:

```
ENVIRONMENT=dev
```

The backend will use Ollama locally at no cost. If no backend is running, the app falls back to DEMO MODE which shows placeholder nodes labeled with (DEMO) so you always know the connection status.

-----

## Project Structure

```
Fractal/
├── backend/
│   ├── main.py              — FastAPI backend, handles Groq and Ollama
│   ├── requirements.txt     — Python dependencies
│   └── .env.example         — Environment config template
├── css/
│   ├── fractal.css          — Fractal custom styles and dark theme
│   └── [wikipedia-map css]  — Graph engine styles
├── js/
│   ├── fractal_api.js       — Connects frontend to Fractal backend
│   └── [wikipedia-map js]   — Graph engine logic
└── index.html               — Main app entry point
```

-----

## Roadmap

The current version is a working prototype. Here is what is coming:

- One-shot map generation with a progressive node reveal mechanic
- Redesigned brutalist UI — new search input, buttons, node cards, and explore panel
- Dark and light mode toggle
- Node explore panel with AI summary, key facts, related links, and further reading
- Deployment to Render and Vercel for public access
- Venn diagram visualization mode
- Context-aware node expansion

-----

## Contributors

**Sam** — Founder, CEO, Lead Developer

**Ian** — (Came up with the idea)- Co-Founder, Lead Developer (On paper)

**Brieon** — Product Manager, Developer (On paper)

-----

## Credits

Graph engine based on [wikipedia-map](https://github.com/controversial/wikipedia-map) by Luke Deen Taylor.