"""
Bluesky post ingestion via the atproto library.
"""

import os
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any, Iterable, Optional, Set
import logging

logger = logging.getLogger(__name__)

# Using multiple queries lets us cover different algospeak variants that
# users employ to evade simple keyword filters. Centralizing them here makes
# it easy to tune the "vocabulary" without changing the rest of the pipeline.
ALGOSPEAK_QUERIES: list[str] = [
    "unalive",
    "le dollar bean",
    "seggs",
    "cornhole",
    "spicy eggplant",
    "cope harder",
    "ratio",
    "touch grass",
    "based",
    "sus",
]

# Cache the atproto client so we only pay the authentication cost once.
# In practice this can save ~10 seconds per fetch because login requires
# multiple network round trips, while the resulting session stays valid
# for many minutes to hours.
_client = None


def get_client():
    """Return a logged-in atproto Client, cached at module level."""
    global _client
    if _client is not None:
        return _client

    from atproto import Client

    handle = os.environ.get("BLUESKY_HANDLE")
    password = os.environ.get("BLUESKY_PASSWORD")
    if not handle or not password:
        raise RuntimeError("BLUESKY_HANDLE or BLUESKY_PASSWORD not set")

    logger.info("Authenticating with Bluesky as %s", handle)
    client = Client()
    client.login(handle, password)
    _client = client
    logger.info("Bluesky authentication successful")
    return client


def preprocess_text(text: str) -> str:
    """
    Normalize text to match the training-time preprocessing.

    A very common ML bug is to train with one preprocessing pipeline and
    serve with another. Keeping train and inference transforms aligned is
    critical; otherwise, the model is effectively seeing out-of-distribution
    data at serving time even if it "looks" similar to humans.

    Args:
        text: Raw post text from Bluesky.

    Returns:
        Cleaned text string, or empty string if the post should be discarded.
    """
    if not text:
        return ""

    # Remove URLs so we don't overfit to specific domains not in training data.
    text = re.sub(r"https?://\S+", " ", text)

    # Drop non-ASCII characters (including most emojis) to mimic training preprocessing.
    text = text.encode("ascii", errors="ignore").decode("ascii")

    # Collapse repeated whitespace and trim.
    text = re.sub(r"\s+", " ", text).strip()

    # Strip hashtags before word analysis — hashtags are metadata, not content.
    text_no_hashtags = re.sub(r"#\S+", "", text).strip()

    # Filter posts with no real linguistic content (filenames, hashtag spam).
    # WHY: These posts add noise to the model and co-occurrence graph
    # without contributing meaningful signal about algospeak patterns.
    NON_WORDS = {"jpg", "png", "gif", "com", "www", "http", "https", "the", "and"}
    real_words = [
        w for w in re.findall(r"[a-zA-Z]{3,}", text_no_hashtags)
        if w.lower() not in NON_WORDS
    ]
    if len(real_words) < 3:
        return ""

    # Enforce minimum length consistent with the training filter from the paper.
    if len(text) < 10:
        return ""

    return text


def _dedupe_texts(texts: Iterable[tuple[str, str | None]]) -> list[tuple[str, str | None]]:
    """
    Deduplicate posts while preserving order.

    In real moderation systems, the same content can appear multiple times
    (reposts, quote-posts, different queries). Deduplication avoids wasting
    model budget on identical texts and keeps metrics from being biased by
    repeated copies of the same post.

    Args:
        texts: Iterable of text strings (may contain duplicates).

    Returns:
        List of unique strings in original order.
    """
    seen: Set[str] = set()
    result: list[tuple[str, str | None]] = []
    for text, ts in texts:
        if text in seen:
            continue
        seen.add(text)
        result.append((text, ts))
    return result


def fetch_posts(
    query: str,
    limit: int = 50,
    queries: Optional[list[str]] = None,
) -> list[tuple[str, str | None]]:
    """
    Search Bluesky for posts and return their text content.

    If `queries` is provided, we search for each query term independently
    and merge the results. This fan-out pattern covers different algospeak
    variants without relying on a single brittle keyword.

    Args:
        query: Primary search term (used if queries is None).
        limit: Maximum number of posts to return across all queries.
        queries: Optional list of terms to fan out across.

    Returns:
        Deduplicated list of preprocessed post texts.
        Returns empty list on any error (credentials, network, API).
    """
    all_texts: list[str] = []

    def _worker() -> None:
        """
        Perform the actual API calls in a worker thread.

        WHY a thread + timeout: if Bluesky's API hangs, the request thread
        would block indefinitely without a timeout, degrading UX and
        potentially exhausting the worker pool in a multi-user deployment.
        """
        try:
            client = get_client()
            query_list = queries if queries is not None else [query]
            logger.info("Fetching posts for %d queries (limit=%d)", len(query_list), limit)

            for q in query_list:
                # Cap per-query limit to bound total latency.
                # WHY: fan-out work must be bounded so one request cannot
                # blow up downstream services — standard production API pattern.
                per_query_limit = min(limit, 10) if queries is not None else limit
                params: dict[str, Any] = {
                    "q": q,
                    "limit": min(max(1, per_query_limit), 100),
                }
                response = client.app.bsky.feed.search_posts(params=params)

                if not response or not getattr(response, "posts", None):
                    logger.warning("No results for query: %r", q)
                    continue

                for post in response.posts:
                    record = getattr(post, "record", None)
                    if record is None:
                        continue
                    raw_text = getattr(post.record, "text", None)
                    if raw_text is None or not isinstance(raw_text, str):
                        continue
                    cleaned = preprocess_text(raw_text)
                    if not cleaned:
                        continue
                    post_ts = getattr(post.record, "created_at", None)
                    all_texts.append((cleaned, post_ts))

            logger.info("Fetched %d posts before deduplication", len(all_texts))

        except Exception as exc:
            # WHY reset client: if auth expired the next fetch should
            # re-authenticate from scratch, not retry with a stale session.
            logger.error("Fetch failed: %s — resetting client", exc, exc_info=True)
            global _client
            _client = None

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_worker)
            try:
                future.result(timeout=30)
            except TimeoutError:
                logger.warning("Bluesky fetch timed out after 30s")
                future.cancel()

        deduped = _dedupe_texts(all_texts)
        logger.info("Returning %d posts after deduplication", len(deduped))
        return deduped

    except Exception as exc:
        logger.error("Unexpected error in fetch_posts: %s", exc, exc_info=True)
        return []
