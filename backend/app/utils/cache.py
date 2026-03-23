"""Simple in-memory caching with TTL for dashboard endpoints."""
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Optional
import json


class CacheEntry:
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = datetime.now(timezone.utc)
        self.ttl_seconds = ttl_seconds

    def is_expired(self) -> bool:
        elapsed = (datetime.now(timezone.utc) - self.created_at).total_seconds()
        return elapsed >= self.ttl_seconds


class SimpleCache:
    """Thread-safe cache with TTL expiration."""

    def __init__(self):
        self._cache: dict[str, CacheEntry] = {}

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if it exists and hasn't expired."""
        if key in self._cache:
            entry = self._cache[key]
            if not entry.is_expired():
                return entry.value
            else:
                # Clean up expired entry
                del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Store value in cache with TTL (default 5 minutes)."""
        self._cache[key] = CacheEntry(value, ttl_seconds)

    def clear(self, key: str = None):
        """Clear specific key or entire cache."""
        if key:
            self._cache.pop(key, None)
        else:
            self._cache.clear()

    def get_or_fetch(
        self, key: str, fetch_fn: Callable[[], Any], ttl_seconds: int = 300
    ) -> Any:
        """Get from cache or fetch and cache the result."""
        cached = self.get(key)
        if cached is not None:
            return cached

        value = fetch_fn()
        self.set(key, value, ttl_seconds)
        return value


# Global cache instance
_cache = SimpleCache()


def get_cache() -> SimpleCache:
    """Get the global cache instance."""
    return _cache
