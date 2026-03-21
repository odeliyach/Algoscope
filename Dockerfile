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
COPY dashboard.py .

# WHY non-root user: running as root means a container escape gives full
# host access. Two lines is the industry baseline for container security.
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# Expose Streamlit's default port
EXPOSE 8501

# WHY --server.address=0.0.0.0: Streamlit binds to localhost by default,
# which is unreachable from outside the container.
CMD ["streamlit", "run", "dashboard.py", \
     "--server.port=8501", \
     "--server.address=0.0.0.0", \
     "--server.headless=true"]
