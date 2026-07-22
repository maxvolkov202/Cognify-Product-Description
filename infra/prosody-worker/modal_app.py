"""
Modal deployment for the Cognify prosody worker.

Modal is the recommended deploy target because:
  - parselmouth + ffmpeg + numpy install cleanly via apt + pip
  - Cold start with image snapshotting is ~1-2s; subsequent invocations
    are warm-cached
  - Free tier covers reasonable Cognify usage
  - No DNS / TLS / load balancer configuration needed
  - Web endpoint URL is auto-issued

DEPLOY:
    pip install modal
    modal token new                    # one-time auth
    modal deploy infra/prosody-worker/modal_app.py

Modal will print the public web URL. Set in Cognify env:
    PROSODY_WORKER_URL=https://...modal.run
    PROSODY_WORKER_TOKEN=<random secret>          # optional
    FF_PROSODY_WORKER=true

ALTERNATIVE DEPLOYS (see README.md):
  - Replicate (ml.cog model)
  - fly.io (Dockerfile)
  - Vercel Python Functions (api/prosody.py with vercel.json runtime)
  - Self-hosted (uvicorn behind Caddy/nginx)
"""

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "fastapi==0.115.0",
        "praat-parselmouth==0.4.5",
        "numpy==1.26.4",
        "httpx==0.27.2",
        "pydantic==2.9.2",
    )
    # Mounts the local main.py into the container so `modal deploy`
    # picks up edits without forcing a rebuild.
    .add_local_file("main.py", remote_path="/root/main.py")
)

app = modal.App(name="cognify-prosody-worker", image=image)


@app.function(
    # Plenty for parselmouth + a 3-min audio file. Bump to 4096 if 180s
    # caps start hitting OOM under traffic.
    memory=2048,
    # CPU-bound; one core is fine, two helps if we batch later.
    cpu=1.0,
    # Cold starts dominate UX, but with near-zero traffic an always-warm
    # instance just bleeds Modal credits 24/7. Run scale-to-zero for now;
    # the first rep after idle cold-starts and gracefully degrades to text
    # tone if it exceeds the 5s Node fetch timeout, then warms up. Flip back
    # to 1 once steady traffic makes warm latency worth the burn.
    min_containers=0,
    timeout=30,
    # Shared-secret auth so a leaked URL can't burn worker credits. The
    # secret injects PROSODY_WORKER_TOKEN into the container env; main.py
    # enforces `Authorization: Bearer <token>` when it is present. Cognify
    # sends the matching header via PROSODY_WORKER_TOKEN in its own env.
    secrets=[modal.Secret.from_name("cognify-prosody-secret")],
)
@modal.asgi_app()
def fastapi_app():
    import sys

    sys.path.insert(0, "/root")
    from main import app as fastapi  # noqa: WPS433

    return fastapi
