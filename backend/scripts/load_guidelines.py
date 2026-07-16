import sys
import os
import re
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.rag.chroma_client import get_chroma_client, get_collection
from app.core.config import get_settings


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Parse simple YAML frontmatter from markdown content.

    Returns a metadata dict and the remaining markdown content.
    """
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if not match:
        return {}, content

    fm_text = match.group(1)
    fm: dict[str, str] = {}
    for line in fm_text.split("\n"):
        if ":" in line:
            key, value = line.split(":", 1)
            fm[key.strip()] = value.strip().strip('"').strip("'")

    return fm, content[match.end():]


def load_guidelines():
    guidelines_dir = Path(__file__).parent.parent / "data" / "guidelines"

    # Delete and recreate the collection to guarantee a clean slate
    try:
        client = get_chroma_client()
        client.delete_collection(name=get_settings().chroma_collection)
        print(f"Deleted existing collection '{get_settings().chroma_collection}'.")
    except Exception as e:
        print(f"Could not delete existing collection (may not exist yet): {e}")

    collection = get_collection()

    docs = []
    ids = []
    metadatas = []
    for file in sorted(guidelines_dir.glob("*.md")):
        raw_content = file.read_text()
        frontmatter, content = parse_frontmatter(raw_content)

        source = frontmatter.get("source", file.stem)
        authority = frontmatter.get("authority", "")
        url = frontmatter.get("url", "")

        chunks = [chunk.strip() for chunk in content.split("\n\n") if chunk.strip()]
        for idx, chunk in enumerate(chunks):
            docs.append(chunk)
            ids.append(f"{file.stem}-{idx}")
            metadatas.append({
                "source": source,
                "authority": authority,
                "url": url,
                "file": file.name,
                "chunk": idx,
            })

    if docs:
        collection.add(documents=docs, ids=ids, metadatas=metadatas)
        print(f"Loaded {len(docs)} guideline chunks from {len(list(guidelines_dir.glob('*.md')))} files into ChromaDB.")
        for file in sorted(guidelines_dir.glob("*.md")):
            frontmatter, _ = parse_frontmatter(file.read_text())
            print(f"  - {file.name}: {frontmatter.get('source', 'unknown')} | {frontmatter.get('authority', '')}")
    else:
        print("No guidelines found.")


if __name__ == "__main__":
    load_guidelines()
