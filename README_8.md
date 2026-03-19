---
title: AlgoScope
emoji: 🔍
colorFrom: red
colorTo: orange
sdk: streamlit
sdk_version: 1.38.0
app_file: dashboard.py
pinned: false
---

<div align="center">

# 🔍 AlgoScope

**Real-time algospeak & toxicity detection on Bluesky**

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://python.org)
[![HuggingFace](https://img.shields.io/badge/Model-HuggingFace-orange?logo=huggingface)](https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection)
[![Streamlit](https://img.shields.io/badge/Dashboard-Streamlit-red?logo=streamlit)](https://streamlit.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)

*Odeliya Charitonova · Tel Aviv University, School of CS & AI · 2026*

</div>

---

## What is AlgoScope?

Algospeak is the evolving coded language people use to evade content moderation — "unalive" instead of suicide, "seggs" instead of sex, "le dollar bean" instead of lesbian. Standard toxicity APIs score these near zero because they look benign to classifiers trained on explicit language.

AlgoScope is a live dashboard that catches them anyway. It ingests posts from the Bluesky social network in real time, classifies each one with a fine-tuned DistilBERT model trained specifically on algospeak, and visualizes toxicity patterns, co-occurrence networks, and trend spikes in an interactive dashboard.

> **Why this matters:** Algospeak evasion is an active research problem in content moderation. This project turns a published NLP paper into a live, clickable product.

---

## Live Demo

| Resource | Link |
|----------|------|
| 🖥️ Live dashboard | [huggingface.co/spaces/odeliyach/algoscope](https://huggingface.co/spaces/odeliyach/algoscope) |
| 🤗 Model | [odeliyach/AlgoShield-Algospeak-Detection](https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection) |

---

## Features

- **🚨 Spike alerts** — red banner when a tracked term exceeds 80% toxic in the last hour
- **📊 Toxicity over time** — hourly bar chart with per-bar color encoding (green/orange/red)
- **🕸️ Co-occurrence graph** — interactive word graph built with NetworkX + Pyvis; nodes colored by toxicity rate
- **⚖️ Term comparison** — side-by-side toxicity profiles for any two tracked terms
- **📥 Export** — download all analyzed posts as CSV or JSON
- **🎛️ Threshold slider** — tune precision/recall tradeoff at inference time without retraining

---

## Architecture

```
┌─────────────────┐   AT Protocol    ┌───────────────────┐
│   Bluesky API   │ ───────────────▶ │   ingestion.py    │
└─────────────────┘                  │  dedup + preproc  │
                                     └─────────┬─────────┘
                                               │
                                     ┌─────────▼─────────┐
                                     │     model.py      │
                                     │  DistilBERT       │
                                     │  singleton + batch│
                                     └─────────┬─────────┘
                                               │
                          ┌────────────────────▼──────────────────────┐
                          │              database.py                  │
                          │   SQLite · URI-keyed deduplication        │
                          └────────────────────┬──────────────────────┘
                                               │
              ┌────────────────────────────────▼────────────────────────────┐
              │                         dashboard.py                        │
              │   Streamlit · Plotly · NetworkX · Pyvis  (4 tabs)           │
              └─────────────────────────────────────────────────────────────┘
```

**Stack:** Python 3.12 · FastAPI · Streamlit · SQLite · NetworkX · Pyvis · Plotly · HuggingFace Transformers · AT Protocol (Bluesky)

---

## Model

Fine-tuned DistilBERT on the [MADOC dataset](https://arxiv.org/abs/2306.01976) (Multimodal Algospeak Detection and Offensive Content):

| Metric | Baseline DistilBERT | AlgoShield (fine-tuned) |
|--------|---------------------|------------------------|
| Precision | 70.3% | 61.2% |
| Recall | 33.2% | **73.2% (+40 pts)** |
| F1 | — | 66.7% |

The +40-point recall gain comes at the cost of ~9 points of precision — a deliberate tradeoff. In content moderation, a false negative (missing a toxic post) causes real harm; a false positive just means a human reviews something innocent. The threshold slider lets operators tune this at deployment time without retraining.

---

## Key Engineering Decisions

**Train/serve parity** — The same `preprocess_text()` function used during training (strip URLs, remove non-ASCII, discard posts under 10 chars) is applied at inference time. Without this, the model sees out-of-distribution input on every prediction — a production ML bug called train/serve skew.

**Threshold separation** — The model outputs a raw confidence score; a threshold slider converts it to a binary label. This separates the ML model from business policy — the same pattern used in Gmail spam and YouTube moderation. One model, multiple thresholds tuned per context.

**Graph construction order** — The co-occurrence graph filters to the 1-hop neighborhood of algospeak seed words *before* frequency ranking. The naive approach (top-30 globally, then filter) always returns generic English function words ("get", "like", "know") — useless for the project's purpose.

**Physics disabled** — Pyvis force-directed layout is O(n²) per animation frame. With 30+ nodes it froze the browser for 2+ minutes. A fixed `randomSeed` layout loads instantly with reproducible positions.

**SQLite with clean abstraction** — All persistence is isolated in `database.py`. No other file imports `sqlite3` directly. Replacing SQLite with PostgreSQL or Cassandra requires changing only that one file.

---

## Running Locally

**Requirements:** Python 3.12, a Bluesky account

```bash
git clone https://github.com/odeliyach/algoscope
cd algoscope
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Create `.env` in the project root:
```env
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_PASSWORD=yourpassword
```

```bash
# Terminal 1 — API backend
uvicorn app.main:app --reload

# Terminal 2 — dashboard
streamlit run dashboard.py
```

Open `http://localhost:8501`, select algospeak terms, and click **Fetch & Analyze**.

---

## Project Structure

```
algoscope/
├── app/
│   ├── main.py          # FastAPI endpoints (/predict, /ingest, /history)
│   ├── model.py         # ToxicityClassifier — singleton load, batch inference
│   ├── ingestion.py     # Bluesky AT Protocol client + preprocessing
│   ├── database.py      # SQLite persistence — isolated for easy swap
│   └── graph.py         # NetworkX co-occurrence graph + Pyvis HTML export
├── dashboard.py         # Streamlit dashboard — 4 tabs
├── requirements.txt     # Dependencies
├── .env                 # Credentials — not committed
└── README.md
```

---

## Deployment (HuggingFace Spaces)

1. Push this repo to GitHub (verify `.env` and `algoscope.db` are in `.gitignore`)
2. Go to [huggingface.co](https://huggingface.co) → New Space → Streamlit → connect this GitHub repo
3. In Space Settings → Secrets, add `BLUESKY_HANDLE` and `BLUESKY_PASSWORD`
4. The Space auto-deploys on every push to `main`

---

## Limitations & Future Work

- **Bluesky-only** — the ingestion layer is modular; adding Reddit or Mastodon requires only a new adapter in `ingestion.py`
- **Fetch-on-click** — a background ingestion loop would keep data flowing continuously without user interaction
- **Static model** — algospeak evolves; periodic retraining or drift detection would maintain coverage over time
- **SQLite single-writer** — replacing with PostgreSQL or Cassandra enables concurrent multi-worker ingestion

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">
<sub>AlgoScope · Tel Aviv University, School of CS & AI · Odeliya Charitonova · 2026</sub>
</div>
