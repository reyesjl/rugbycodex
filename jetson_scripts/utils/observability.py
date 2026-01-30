"""
Observability module with Axiom integration for structured logging.
"""
import os
import sys
import json
from datetime import datetime
from typing import Any

# Axiom integration
AXIOM_ENABLED = False
axiom_client = None
axiom_dataset = None

try:
    from axiom_py import Client as AxiomClient
    axiom_token = os.getenv("AXIOM_API_TOKEN")
    axiom_dataset = os.getenv("AXIOM_DATASET", "rugbycodex-logs")
    axiom_env = os.getenv("AXIOM_ENVIRONMENT", "production")
    
    if axiom_token:
        axiom_client = AxiomClient(token=axiom_token)
        AXIOM_ENABLED = True
        print(f"✅ Axiom logging enabled: dataset={axiom_dataset}, env={axiom_env}", flush=True)
    else:
        print("⚠️  Axiom token not found, logging to stdout only", flush=True)
except ImportError:
    print("⚠️  axiom-py not installed, logging to stdout only (pip3 install axiom-py)", flush=True)


def log_event(**fields: Any) -> None:
    """
    Log structured event to stdout and optionally to Axiom.
    
    Args:
        **fields: Event fields to log
    """
    payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "environment": os.getenv("AXIOM_ENVIRONMENT", "production"),
        **fields,
    }
    
    # Always print to stdout
    print(json.dumps(payload, default=str), flush=True)
    
    # Send to Axiom if enabled
    if AXIOM_ENABLED and axiom_client and axiom_dataset:
        try:
            axiom_client.ingest_events(axiom_dataset, [payload])
        except Exception as e:
            print(f"Axiom ingest failed: {e}", file=sys.stderr, flush=True)
