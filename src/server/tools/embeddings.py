"""
Semantic embedding utilities for reasoning text.

Uses sentence-transformers to generate vector embeddings for semantic search
and contradiction detection in AI decision reasoning.
"""
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np

# Use a lightweight, fast model (384 dimensions)
# all-MiniLM-L6-v2: 80MB model, ~14k tokens/sec, good for semantic similarity
_model = None

def get_embedding_model():
    """Lazy-load the sentence transformer model."""
    global _model
    if _model is None:
        print("📦 Loading embedding model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
        print("✅ Embedding model loaded")
    return _model


def generate_reasoning_embedding(reasoning_text: str, market_context: dict = None) -> List[float]:
    """
    Generate a semantic embedding for AI reasoning text.

    Combines the reasoning with key market context to create a rich embedding
    that captures both the decision and the conditions that led to it.

    Args:
        reasoning_text: The AI's reasoning/decision text
        market_context: Optional dict with market prediction, confidence, thesis, etc.

    Returns:
        List of 384 floats representing the semantic embedding
    """
    model = get_embedding_model()

    # Build a rich text representation combining reasoning + context
    text_parts = [reasoning_text]

    if market_context:
        prediction = market_context.get("prediction", "")
        confidence = market_context.get("confidence", 0.0)
        thesis = market_context.get("thesis", "")
        risk_flags = market_context.get("risk_flags", [])

        if prediction:
            text_parts.append(f"Market outlook: {prediction}")
        if confidence:
            text_parts.append(f"Confidence: {confidence:.0%}")
        if thesis:
            text_parts.append(f"Thesis: {thesis[:200]}")  # Limit thesis length
        if risk_flags:
            text_parts.append(f"Risk factors: {', '.join(risk_flags)}")

    combined_text = " | ".join(text_parts)

    # Generate embedding
    embedding = model.encode(combined_text, convert_to_numpy=True)

    # Convert to list for database storage
    return embedding.tolist()


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.

    Returns a value between -1 (opposite) and 1 (identical).
    Values close to 0 indicate orthogonal/unrelated vectors.
    """
    a = np.array(vec1)
    b = np.array(vec2)

    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
