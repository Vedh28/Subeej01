import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import faiss
import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

from dataset_loader import clean_dataset, load_dataset


@dataclass
class VectorStoreArtifacts:
    index_path: Path
    metadata_path: Path
    model_name: str


def build_documents(df: pd.DataFrame) -> List[Dict[str, str]]:
    documents: List[Dict[str, str]] = []

    for _, row in df.iterrows():
        text = (
            f"Seed {row['seed_name']} ({row['seed_variety']}, {row['seed_type']}, {row['seed_quality']}). "
            f"Crop {row['crop']} in season {row['season']}. "
            f"Soil {row['soil_type']} with composition {row['field_composition']}. "
            f"Location {row['district']}, {row['state']}. "
            f"Recommended {row['recommended_crop']} using {row['recommended_seed']}."
        )
        documents.append({
            "text": text,
            "seed_name": row["seed_name"],
            "seed_variety": row["seed_variety"],
            "seed_type": row["seed_type"],
            "seed_quality": row["seed_quality"],
            "crop": row["crop"],
            "season": row["season"],
            "soil_type": row["soil_type"],
            "field_composition": row["field_composition"],
            "state": row["state"],
            "district": row["district"],
            "recommended_crop": row["recommended_crop"],
            "recommended_seed": row["recommended_seed"],
            "yield": row["yield"],
            "production": row["production"],
            "area": row["area"],
        })

    return documents


def build_vector_store(
    csv_path: str,
    index_path: str,
    metadata_path: str,
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
) -> VectorStoreArtifacts:
    df = clean_dataset(load_dataset(csv_path))
    documents = build_documents(df)

    embedder = SentenceTransformer(model_name)
    embeddings = embedder.encode([doc["text"] for doc in documents], show_progress_bar=True)
    embeddings = np.asarray(embeddings, dtype="float32")

    index = faiss.IndexFlatL2(embeddings.shape[1])
    index.add(embeddings)

    faiss.write_index(index, index_path)
    Path(metadata_path).write_text(json.dumps({
        "model_name": model_name,
        "documents": documents
    }, ensure_ascii=False, indent=2))

    return VectorStoreArtifacts(Path(index_path), Path(metadata_path), model_name)


def load_vector_store(index_path: str, metadata_path: str):
    index = faiss.read_index(index_path)
    metadata = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    return index, metadata


def search_vector_store(index, metadata, query: str, top_k: int = 5):
    embedder = SentenceTransformer(metadata["model_name"])
    embedding = embedder.encode([query])
    embedding = np.asarray(embedding, dtype="float32")
    distances, indices = index.search(embedding, top_k)

    docs = []
    for idx in indices[0]:
        if idx < 0:
            continue
        docs.append(metadata["documents"][idx])

    return docs


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    csv_path = base / "data" / "dataset.csv"
    index_path = base / "data" / "processed" / "agri_faiss.index"
    metadata_path = base / "data" / "processed" / "agri_faiss.json"
    build_vector_store(str(csv_path), str(index_path), str(metadata_path))
    print(f"Saved vector store to {index_path} and {metadata_path}")
