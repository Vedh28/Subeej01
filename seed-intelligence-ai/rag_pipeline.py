from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from knowledge_graph import load_graph, query_graph_for_seeds
from vector_store import load_vector_store, search_vector_store


@dataclass
class RagContext:
    vector_hits: List[Dict[str, str]]
    graph_seeds: List[str]
    graph_crops: List[str]
    graph_evidence: List[str]


def build_context_text(context: RagContext) -> str:
    lines: List[str] = []

    if context.vector_hits:
        lines.append("Vector Search Results:")
        for hit in context.vector_hits:
            lines.append(
                f"- {hit['text']} | Recommended: {hit['recommended_crop']} / {hit['recommended_seed']} | Yield {hit['yield']}"
            )

    if context.graph_seeds or context.graph_crops:
        lines.append("Knowledge Graph Signals:")
        if context.graph_seeds:
            lines.append(f"- Seeds aligned to soil/season: {', '.join(context.graph_seeds)}")
        if context.graph_crops:
            lines.append(f"- Crops cultivated in region: {', '.join(context.graph_crops)}")
        for note in context.graph_evidence:
            lines.append(f"- {note}")

    return "\n".join(lines)


def retrieve_context(question: str, soil_type: str, season: str, state: str) -> RagContext:
    base = Path(__file__).resolve().parent
    index_path = base / "data" / "processed" / "agri_faiss.index"
    metadata_path = base / "data" / "processed" / "agri_faiss.json"
    graph_path = base / "data" / "processed" / "agri_graph.gpickle"

    index, metadata = load_vector_store(str(index_path), str(metadata_path))
    graph = load_graph(str(graph_path))

    vector_hits = search_vector_store(index, metadata, question, top_k=5)
    graph_result = query_graph_for_seeds(graph, soil_type, season, state)

    return RagContext(
        vector_hits=vector_hits,
        graph_seeds=graph_result.seeds,
        graph_crops=graph_result.crops,
        graph_evidence=graph_result.evidence
    )


if __name__ == "__main__":
    ctx = retrieve_context(
        question="Which seeds grow best in black soil during Kharif in Maharashtra?",
        soil_type="Black soil",
        season="Kharif",
        state="Maharashtra"
    )
    print(build_context_text(ctx))
