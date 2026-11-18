from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
 
def top_k(query, items, k=6):
    """items: list of dicts with 'text'. Returns the k most relevant (local, no API call)."""
    if not items:
        return []
    try:
        texts = [i["text"] for i in items]
        vec = TfidfVectorizer(stop_words="english").fit(texts + [query])
        sims = cosine_similarity(vec.transform([query]), vec.transform(texts))[0]
        ranked = sorted(zip(sims, range(len(items))), key=lambda x: -x[0])
        return [items[i] for _, i in ranked[:k]]
    except ValueError:
        return items[:k]