
<div align="center">

# 🔍 AlgoScope

**Real-time algospeak & toxicity detection on Bluesky**

<p align="center">
  <a href="https://huggingface.co/spaces/odeliyach/algoscope"><img src="https://img.shields.io/badge/Live%20Demo-Spaces-FFFFBA?logo=huggingface&logoColor=333333" alt="Demo"></a>
  <a href="https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection"><img src="https://img.shields.io/badge/Model-AlgoShield-FF968A?logo=huggingface&logoColor=white" alt="Model"></a>
  <img src="https://img.shields.io/badge/Dashboard-Streamlit-B2B2FD?logo=streamlit&logoColor=white" alt="Dashboard">
  <img src="https://img.shields.io/github/actions/workflow/status/odeliyach/Algoscope/ci.yml?branch=main&label=Build&color=BAFFC9&logo=github-actions&logoColor=white" alt="Build">
  <img src="https://img.shields.io/badge/Linting-Ruff-D4A5FF?logo=python&logoColor=white" alt="Linting">
  <img src="https://img.shields.io/badge/Coverage-30%25-FFB3BA?logo=codecov&logoColor=white" alt="Coverage">
  <img src="https://img.shields.io/badge/Python-3.12-FFD1A4?logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/License-MIT-E2E2E2" alt="License">
</p>

*Odeliya Charitonova · 2026*

</div>

---

## What is AlgoScope?

Algospeak is the evolving coded language people use to evade content moderation — "unalive" instead of suicide, "seggs" instead of sex, "le dollar bean" instead of lesbian. Standard toxicity APIs score these near zero because they look benign to classifiers trained on explicit language.

AlgoScope is a live dashboard that catches them anyway. It ingests posts from the Bluesky social network in real time, classifies each one with a fine-tuned DistilBERT model trained specifically on algospeak, and visualizes toxicity patterns, co-occurrence networks, and trend spikes in an interactive dashboard.

> **Why this matters:** Algospeak evasion is an active research problem in content moderation. This project turns published NLP research into a live, clickable product.

---

## Live Demo

| Resource | Link |
|----------|------|
| 🖥️ Live dashboard | [huggingface.co/spaces/odeliyach/algoscope](https://huggingface.co/spaces/odeliyach/Algoscope) |
| 🤗 Fine-tuned model | [odeliyach/AlgoShield-Algospeak-Detection](https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection) |
| 💻 GitHub | [github.com/odeliyach/Algoscope](https://github.com/odeliyach/Algoscope) |

---

## Screenshots

![AlgoScope Overview](assets/overview.png)

![Co-occurrence Graph](assets/graph.png)

![Term Comparison](assets/term_comparison.png)

---

## Features

- **🚨 Spike alerts** — red banner when a tracked term exceeds 80% toxic in the last hour
- **📊 Toxicity over time** — hourly line chart with color-coded data points (green/orange/red by toxicity level)
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

## Model — AlgoShield

The classifier powering AlgoScope is **AlgoShield**, a DistilBERT model fine-tuned on the [MADOC dataset](https://arxiv.org/abs/2306.01976) (Multimodal Algospeak Detection and Offensive Content). It was trained and evaluated separately — full training code, dataset preprocessing, and evaluation notebooks are in the [AlgoShield repository](https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection).

| Metric | Baseline DistilBERT | AlgoShield (fine-tuned) |
|--------|---------------------|------------------------|
| Precision | 70.3% | 61.2% |
| Recall | 33.2% | **73.2% (+40 pts)** |
| F1 | 49.0% | **66.7% (+17.7 pts)** |

The +40-point recall improvement comes at the cost of ~9 points of precision — a deliberate tradeoff. In content moderation, a false negative (missing a toxic post) causes real harm; a false positive just means a human reviews something innocent. The threshold slider in AlgoScope lets operators tune this tradeoff at deployment time without retraining.

> Want to understand how AlgoShield was built? See the [model card and training details →](https://huggingface.co/odeliyach/AlgoShield-Algospeak-Detection)

---

## Key Engineering Decisions

**Train/serve parity** — The same `preprocess_text()` function used during AlgoShield's training is applied at inference time in AlgoScope. Without this, the model sees out-of-distribution input on every prediction — a production ML bug called train/serve skew.

**Threshold separation** — The model outputs a raw confidence score; a threshold slider converts it to a binary label. This separates the ML model from business policy — the same pattern used in Gmail spam and YouTube moderation. One model, multiple thresholds tuned per context.

**Graph construction order** — The co-occurrence graph filters to the 1-hop neighborhood of algospeak seed words *before* frequency ranking. The naive approach (top-30 globally, then filter) always returns generic English function words ("get", "like", "know") — useless for the project's purpose.

**Physics disabled** — Pyvis force-directed layout is O(n²) per animation frame. With 30+ nodes it froze the browser for 2+ minutes. A fixed `randomSeed` layout loads instantly with reproducible positions.

**SQLite with clean abstraction** — All persistence is isolated in `database.py`. No other file imports `sqlite3` directly. Replacing SQLite with PostgreSQL or Cassandra requires changing only that one file.

---

## Running Locally

**Requirements:** Python 3.12, a Bluesky account

```bash
git clone https://github.com/odeliyach/Algoscope
cd Algoscope
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
```

Or with Make:
```bash
make install
make run-dashboard   # in one terminal
make run-api         # in another
```

Create `.env` in the project root:
```env
BLUESKY_HANDLE=yourhandle.bsky.social
BLUESKY_PASSWORD=yourpassword
```

---

## Project Structure

```
Algoscope/
├── app/
│   ├── main.py          # FastAPI endpoints (/health, /predict)
│   ├── model.py         # ToxicityClassifier — singleton load, batch inference
│   ├── ingestion.py     # Bluesky AT Protocol client + preprocessing
│   ├── database.py      # SQLite persistence — isolated for easy swap
│   └── graph.py         # NetworkX co-occurrence graph + Pyvis HTML export
├── assets/
│   ├── overview.png         # Dashboard overview screenshot
│   ├── graph.png            # Co-occurrence graph screenshot
│   └── term_comparison.png  # Term comparison screenshot
├── tests/
│   └── test_core.py     # Preprocessing parity, DB round-trip, stopwords
├── dashboard.py         # Streamlit dashboard — 4 tabs
├── Makefile             # install / run / test / lint shortcuts
├── requirements.txt     # Runtime dependencies
├── pyproject.toml       # Project metadata + tooling config
├── Dockerfile           # python:3.12-slim, non-root user
├── .github/workflows/
│   └── ci.yml           # Import checks + syntax + pytest on every push
└── .env                 # Credentials — not committed
```
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
