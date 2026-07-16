import os
import logging

# Disable ChromaDB telemetry before importing the package
os.environ["ANONYMIZED_TELEMETRY"] = "False"

import chromadb
from chromadb.config import Settings
from app.core.config import get_settings
from functools import lru_cache

# Suppress noisy ChromaDB telemetry logs
logging.getLogger("chromadb.telemetry.product.posthog").setLevel(logging.CRITICAL)


@lru_cache()
def get_chroma_client():
    settings = get_settings()
    try:
        client = chromadb.HttpClient(
            host=settings.chroma_host,
            port=settings.chroma_port,
            settings=Settings(allow_reset=True, anonymized_telemetry=False),
        )
        # Verify we are actually talking to a ChromaDB server and not some other service
        # (e.g. the FastAPI backend). A wrong endpoint will fail here and trigger the fallback.
        client.heartbeat()
        return client
    except Exception:
        # Fallback to ephemeral client if no reachable ChromaDB server is available
        return chromadb.EphemeralClient(settings=Settings(anonymized_telemetry=False))


def get_collection():
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=get_settings().chroma_collection,
        metadata={"hnsw:space": "cosine"},
    )
