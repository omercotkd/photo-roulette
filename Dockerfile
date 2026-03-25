# ── Stage 1: build the React / Vite frontend ─────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: production image ─────────────────────────────────────────────────
FROM python:3.14-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app/backend

# Install dependencies first (better layer caching)
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy the rest of the backend source
COPY backend/ ./

# Copy the built frontend so FastAPI can serve it at runtime
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Persist uploaded photos outside the container via a named volume
VOLUME ["/app/backend/uploads"]

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
