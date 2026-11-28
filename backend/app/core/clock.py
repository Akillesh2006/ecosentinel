from datetime import datetime, timezone


def utc_now() -> datetime:
    """Returns the current UTC datetime. Isolated here so tests can inject a deterministic clock."""
    return datetime.now(timezone.utc)

