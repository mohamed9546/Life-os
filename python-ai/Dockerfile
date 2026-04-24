# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

# Install build deps first so the requirements layer is cacheable.
COPY pyproject.toml ./
RUN pip install --upgrade pip \
    && pip install "fastapi>=0.115" "uvicorn[standard]>=0.32" "pydantic>=2.8" "httpx>=0.27" "python-dotenv>=1.0"

# Copy app code
COPY life_os_ai ./life_os_ai

# Cloud Run sends SIGTERM and expects the container to drain gracefully.
# uvicorn --timeout-graceful-shutdown honours that.
# Single worker is correct for Cloud Run -- each request gets its own
# instance and CPU is billed per request.
CMD ["uvicorn", "life_os_ai.app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--timeout-graceful-shutdown", "20"]
