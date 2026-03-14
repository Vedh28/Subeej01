from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import pickle
import networkx as nx
import pandas as pd

from dataset_loader import clean_dataset, load_dataset


@dataclass
class GraphQueryResult:
    seeds: List[str]
    crops: List[str]
    evidence: List[str]


def build_knowledge_graph(df: pd.DataFrame) -> nx.MultiDiGraph:
    graph = nx.MultiDiGraph()

    for _, row in df.iterrows():
        seed = str(row["seed_name"]).strip()
        seed_variety = str(row["seed_variety"]).strip()
        crop = str(row["crop"]).strip()
        soil_type = str(row["soil_type"]).strip()
        season = str(row["season"]).strip()
        state = str(row["state"]).strip()
        district = str(row["district"]).strip()
        field_history = str(row["field_history"]).strip()
        rec_crop = str(row["recommended_crop"]).strip()

        graph.add_node(seed, type="Seed")
        graph.add_node(seed_variety, type="Seed Variety")
        graph.add_node(crop, type="Crop")
        graph.add_node(soil_type, type="Soil Type")
        graph.add_node(season, type="Season")
        graph.add_node(state, type="State")
        graph.add_node(district, type="District")
        graph.add_node(field_history, type="Field Condition")
        graph.add_node(rec_crop, type="Crop")

        graph.add_edge(seed, soil_type, relation="grows_in")
        graph.add_edge(seed, season, relation="suitable_for")
        graph.add_edge(seed_variety, seed, relation="belongs_to")
        graph.add_edge(crop, state, relation="cultivated_in")
        graph.add_edge(district, state, relation="located_in")
        graph.add_edge(soil_type, rec_crop, relation="affects")
        graph.add_edge(field_history, rec_crop, relation="influences")

    return graph


def query_graph_for_seeds(
    graph: nx.MultiDiGraph,
    soil_type: str,
    season: str,
    state: str
) -> GraphQueryResult:
    soil_type = soil_type.strip().lower()
    season = season.strip().lower()
    state = state.strip().lower()

    seeds: List[str] = []
    crops: List[str] = []
    evidence: List[str] = []

    for seed in graph.nodes:
        node_type = graph.nodes[seed].get("type")
        if node_type != "Seed":
            continue
        relations = list(graph.edges(seed, data=True))
        grows_in = [dst for _, dst, data in relations if data.get("relation") == "grows_in"]
        suitable_for = [dst for _, dst, data in relations if data.get("relation") == "suitable_for"]

        if any(soil_type == str(dst).strip().lower() for dst in grows_in) and any(
            season == str(dst).strip().lower() for dst in suitable_for
        ):
            seeds.append(seed)

    for crop in graph.nodes:
        if graph.nodes[crop].get("type") != "Crop":
            continue
        for _, dst, data in graph.edges(crop, data=True):
            if data.get("relation") == "cultivated_in" and state == str(dst).strip().lower():
                crops.append(crop)

    if seeds:
        evidence.append(f"Found {len(seeds)} seeds matching soil={soil_type} and season={season}.")
    if crops:
        evidence.append(f"Found {len(crops)} crops cultivated in {state}.")

    return GraphQueryResult(
        seeds=sorted(set(seeds)),
        crops=sorted(set(crops)),
        evidence=evidence
    )


def save_graph(graph: nx.MultiDiGraph, path: str) -> None:
    with open(path, "wb") as f:
        pickle.dump(graph, f, protocol=pickle.HIGHEST_PROTOCOL)


def load_graph(path: str) -> nx.MultiDiGraph:
    with open(path, "rb") as f:
        return pickle.load(f)


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    csv_path = base / "data" / "dataset.csv"
    graph_path = base / "data" / "processed" / "agri_graph.gpickle"

    df = load_dataset(str(csv_path))
    df = clean_dataset(df)
    graph = build_knowledge_graph(df)
    save_graph(graph, str(graph_path))
    print(f"Saved graph to {graph_path}")
