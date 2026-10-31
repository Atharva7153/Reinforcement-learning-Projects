# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

# Install dependencies first (better layer caching)
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --prefer-offline

# Copy source and build
COPY frontend/ ./
RUN npm run build
# Output lands in /build/frontend/dist


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Python backend + bundled frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Non-root user for security
RUN addgroup --system app && adduser --system --ingroup app app

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy the built frontend into backend/static/ so FastAPI can serve it
COPY --from=frontend-builder /build/frontend/dist ./static

# Ensure correct ownership
RUN chown -R app:app /app
USER app

# Render (and most platforms) inject PORT; default to 8000 for local Docker runs
ENV PORT=8000

EXPOSE ${PORT}

# Use shell form so $PORT is expanded at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
