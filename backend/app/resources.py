from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class ResourceDef:
    name: str
    table: str
    pk: str = "id"
    org_id_column: Optional[str] = None
    read_only: bool = False


RESOURCES: dict[str, ResourceDef] = {
    # Tenancy & accounts
    "organizations": ResourceDef("organizations", "organizations", pk="id"),
    "teams": ResourceDef("teams", "teams", pk="id", org_id_column="org_id"),
    "users": ResourceDef("users", "users", pk="id"),
    "memberships": ResourceDef("memberships", "memberships", pk="id", org_id_column="org_id"),

    # Vocab
    "vocab_terms": ResourceDef("vocab_terms", "vocab_terms", pk="id"),

    # Media and clips
    "media_assets": ResourceDef("media_assets", "media_assets", pk="id", org_id_column="org_id"),
    # Note: clips handled by specialized router; excluded here to avoid public overlap
    "clip_tags": ResourceDef("clip_tags", "clip_tags", pk="clip_id", org_id_column=None),  # org via join

    # Text/metadata
    "transcripts": ResourceDef("transcripts", "transcripts", pk="id"),
    "clip_metadata": ResourceDef("clip_metadata", "clip_metadata", pk="id"),

    # Coach tools
    "narrations": ResourceDef("narrations", "narrations", pk="id", org_id_column="org_id"),
    "annotations": ResourceDef("annotations", "annotations", pk="id"),

    # Embeddings
    "embeddings": ResourceDef("embeddings", "embeddings", pk="id", org_id_column="org_id"),

    # Curation
    "sequences": ResourceDef("sequences", "sequences", pk="id", org_id_column="org_id"),
    "sequence_items": ResourceDef("sequence_items", "sequence_items", pk="id"),

    # Governance
    "policies": ResourceDef("policies", "policies", pk="id", org_id_column="org_id"),
    "audit_events": ResourceDef("audit_events", "audit_events", pk="id", org_id_column="org_id", read_only=True),

    # Processing
    "jobs": ResourceDef("jobs", "jobs", pk="id", org_id_column="org_id"),
}
