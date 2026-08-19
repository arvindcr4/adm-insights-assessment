FROM python:3.12-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
RUN useradd --system --uid 10001 --no-create-home appuser && chown -R appuser:appuser /app
USER appuser
ENV INSIGHTS_CORS_ORIGINS='["http://localhost:5173","http://localhost:8080"]'
EXPOSE 8000
# Run the venv binary directly: no package-manager cache needed at runtime.
CMD ["/app/.venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
