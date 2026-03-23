from contextlib import contextmanager


class _NoDatabase:
    """Compatibility object for legacy dependencies while moving to Firestore-only."""


@contextmanager
def _noop_db_context():
    yield _NoDatabase()


def get_db():
    """Legacy dependency kept for backward compatibility with route signatures."""
    with _noop_db_context() as db:
        yield db


def init_db():
    """No-op: Firestore does not require SQL table initialization."""
    return None
