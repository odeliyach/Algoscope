# ── Stage 1: Build React frontend ─────────────────────────────────────────────
# WHY multi-stage: Node.js is only needed to compile React.
# The final image doesn't include Node — just the compiled JS/CSS.
# Multi-stage keeps the production image ~150MB vs ~800MB with Node included.
FROM node:20-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json frontend/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY frontend/ .
RUN pnpm build

# ── Stage 2: Python runtime ────────────────────────────────────────────────────
# WHY python:3.12-slim: full image is 1GB+, slim is ~150MB.
# We only need the runtime, not build tools.
FROM python:3.12-slim
WORKDIR /app

# WHY copy requirements first: Docker layer caching.
# If requirements.txt hasn't changed, this layer is cached
# and pip install is skipped on every subsequent build.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code after dependencies (changes more often)
COPY app/ ./app/

# Copy only the compiled React output from Stage 1 — not Node or source files
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# WHY non-root user: running as root means a container escape gives full
# host access. Two lines is the industry baseline for container security.
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# WHY 7860: HuggingFace Docker Spaces expect port 7860 by default.
EXPOSE 7860

# WHY uvicorn instead of streamlit: FastAPI now serves both API and static files
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
