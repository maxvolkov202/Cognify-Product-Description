# Container image for the Cognify prosody worker.
# Builds for any HTTP-fronted target — fly.io, Render, self-hosted.
# (Modal uses modal_app.py and ignores this Dockerfile.)

FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8080

# uvicorn workers=1 keeps memory predictable; scale by container count
# (most platforms autoscale containers, not workers).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
