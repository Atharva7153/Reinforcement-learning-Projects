# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build modern React + Vite + Tailwind frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Install dependencies first (better layer caching)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline

# Copy source code and compile production assets
COPY frontend/ ./
RUN npm run build
# Output lands in /build/frontend/dist


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Python 3.12 runtime with FastAPI & bundled frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Security best practice: create non-root user
RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

# Install backend Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI backend code
COPY backend/ ./

# Copy built frontend assets into backend static folder so FastAPI serves the SPA
COPY --from=frontend-builder /build/frontend/dist ./static

# Ensure file ownership for non-root user
RUN chown -R app:app /app
USER app

# Render injects $PORT dynamically; default to 8000 for local docker runs
ENV PORT=8000

EXPOSE ${PORT}

# Run FastAPI with uvicorn listening on $PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
