from app.services.rag.chroma_client import get_collection
from app.models.schemas import UserProfile


def retrieve_guidelines(profile: UserProfile | None, query: str, n_results: int = 3) -> list[str]:
    if profile is None:
        return []

    # Build a query from profile and explicit query
    conditions = " ".join(profile.medical.conditions) if profile else ""
    full_query = f"{query} {conditions}".strip()
    if not full_query:
        return []

    try:
        collection = get_collection()
        results = collection.query(query_texts=[full_query], n_results=n_results)
        documents = results.get("documents", [[]])[0]
        return [doc for doc in documents if doc]
    except Exception:
        return []
