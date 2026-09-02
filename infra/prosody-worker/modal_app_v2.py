"""
Modal deployment for the Cognify prosody worker v2 (side-by-side with v1 —
prosody-v2 plan P1: switching/reverting is a PROSODY_WORKER_URL env flip).

DEPLOY:
    modal deploy infra/prosody-worker/modal_app_v2.py

Prints the app URL for `cognify-prosody-worker-v2`. Point the harness at it
first (extract-compare --worker-b-url); flip PROSODY_WORKER_URL only after
GW1-GW3 + GF2 + GC1 pass (plan §5 Phase 2).
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
    .add_local_file("main_v2.py", remote_path="/root/main_v2.py")
)

app = modal.App(name="cognify-prosody-worker-v2", image=image)


@app.function(
    memory=2048,
    cpu=1.0,
    min_containers=0,
    timeout=30,
    secrets=[modal.Secret.from_name("cognify-prosody-secret")],
)
@modal.asgi_app()
def fastapi_app():
    import sys

    sys.path.insert(0, "/root")
    from main_v2 import app as fastapi  # noqa: WPS433

    return fastapi
