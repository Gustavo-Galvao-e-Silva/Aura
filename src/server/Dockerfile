FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy application code first (setuptools needs packages to exist)
COPY . .

# Install Python dependencies from pyproject.toml
RUN pip install --no-cache-dir .

# Set PYTHONPATH so imports work correctly
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8000

# Default command (overridden by docker-compose)
CMD ["uvicorn", "my_fastapi_app.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
