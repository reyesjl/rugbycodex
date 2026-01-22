import json
from datetime import datetime
from typing import Any


def log_event(**fields: Any) -> None:
    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **fields,
    }
    print(json.dumps(payload, default=str))
