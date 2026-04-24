"""Entry point for `python -m life_os_ai`."""

from .app import app  # re-export so `uvicorn life_os_ai:app` also works  # noqa: F401

if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(
        "life_os_ai.app:app",
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "8000")),
        reload=bool(os.environ.get("RELOAD")),
    )
