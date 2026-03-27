FROM python:3.12-slim

RUN echo "=== Step 1: base image OK ==="

WORKDIR /app

RUN echo "=== Step 2: workdir set ==="

COPY requirements.txt .

RUN echo "=== Step 3: requirements.txt copied, starting pip install ===" && \
    pip install --no-cache-dir -r requirements.txt && \
    echo "=== Step 4: pip install complete ==="

COPY app/ ./app/

RUN echo "=== Step 5: app/ copied ==="

COPY frontend/dist/ ./frontend/dist/

RUN echo "=== Step 6: frontend/dist/ copied ==="

RUN useradd --create-home --shell /bin/bash appuser

RUN echo "=== Step 7: appuser created ==="

USER appuser

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
