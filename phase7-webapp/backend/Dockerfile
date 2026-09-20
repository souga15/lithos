FROM python:3.10-slim

# Install system dependencies for spatial libraries
RUN apt-get update && apt-get install -y \
    g++ \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Required for HuggingFace Spaces
RUN useradd -m -u 1000 user

# Grant user write permissions to /app so it can create files (like terrain_cache.json and /data folder)
RUN chown -R user:user /app

USER user
ENV PATH="/home/user/.local/bin:$PATH"

COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

COPY --chown=user:user . .

# Use dynamic port from Render (falls back to 8000 locally)
EXPOSE 8000

# Shell form so $PORT env variable is expanded at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
