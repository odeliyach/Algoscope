# WHY single stage: the React frontend is already compiled by GitHub Actions
# and pushed as frontend/dist/ to HuggingFace. No need for a Node build stage.
# This keeps the image small and the build fast.
FROM python:3.12-slim

RUN echo "=== Step 1: base image OK ==="

WORKDIR /app

RUN echo "=== Step 2: workdir set ==="

# WHY copy requirements first: Docker layer caching.
# If requirements.txt hasn't changed, this layer is cached
# and pip install is skipped on every subsequent build.
COPY requirements.txt .

RUN echo "=== Step 3: requirements.txt copied, starting pip install ===" && \
    pip install --no-cache-dir -r requirements.txt && \
    echo "=== Step 4: pip install complete ==="

# Copy application code after dependencies (changes more often)
COPY app/ ./app/

RUN echo "=== Step 5: app/ copied ==="

# Copy the pre-built React output pushed by the GitHub Actions workflow.
# WHY not build here: hf-deploy.yml already runs pnpm build and strips src/,
# so src/main.tsx doesn't exist in this context. Building twice is wasteful anyway.
COPY frontend/dist/ ./frontend/dist/

RUN echo "=== Step 6: frontend/dist/ copied ==="

# WHY non-root user: running as root means a container escape gives full
# host access. Two lines is the industry baseline for container security.
RUN useradd --create-home --shell /bin/bash appuser

RUN echo "=== Step 7: appuser created ==="

RUN chown -R appuser:appuser /app

USER appuser

# WHY 7860: HuggingFace Docker Spaces expect port 7860 by default.
EXPOSE 7860

# WHY uvicorn instead of streamlit: FastAPI now serves both API and static files
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
