RugbyCodex API Layout

Overview
- Base paths: `/api/v1` (public, auth required) and `/api/admin` (admin-only).
- Auth: Bearer JWT with claims `sub` (user_id), `org_id`, `role` (admin|analyst|coach|player), optional `team_id`.
- Tenancy: All org-scoped resources enforce `record.org_id == jwt.org_id`.
- Policies: Additional rules read from `policies.rules` JSON (e.g., player curated access).

OpenAPI Overview
- OpenAPI base: `/api/v1` paths; authorization via Bearer JWT (securitySchemes: bearerAuth).
- Tags: group endpoints in generated docs (see below).

OpenAPI - Tags
```yaml
tags:
  - name: clips
    description: Operations for media clips (list, retrieve, search, curate)
  - name: accounts
    description: Organization and user management (organizations, teams, users)
  - name: media
    description: Media assets, clip tags and related operations
  - name: vocab
    description: Controlled vocabulary terms used across the system
  - name: admin
    description: Admin-only generic CRUD endpoints
  - name: health
    description: Health and diagnostics endpoints
  - name: jobs
    description: Background processing and job management
```

OpenAPI - Minimal example components/schemas
```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
    Clip:
      type: object
      required: [id, org_id, title, visibility]
      properties:
        id:
          type: string
          format: uuid
          example: "3fa85f64-5717-4562-b3fc-2c963f66afa6"
        org_id:
          type: string
          format: uuid
          example: "2b8d5e12-4321-4b2d-8f3a-9c1a7d8e2b3c"
        title:
          type: string
          example: "Match highlights vs Rivals"
        description:
          type: string
        duration_seconds:
          type: integer
          example: 95
        visibility:
          type: string
          enum: [public, org, curated]
          example: "org"
        s3_key:
          type: string
          example: "clips/org/2025/09/clip-12345.mp4"
    Account:
      type: object
      required: [id, name]
      properties:
        id:
          type: string
          format: uuid
          example: "a1b2c3d4-5678-90ab-cdef-111213141516"
        name:
          type: string
          example: "Westside RFC"
        role:
          type: string
          enum: [admin, analyst, coach, player]
          example: "coach"
    Error:
      type: object
      properties:
        code:
          type: integer
          example: 401
        message:
          type: string
          example: "Unauthorized"
```

Routing Model
- Specialized routers for complex domains
  - `clips` at `/api/v1/clips` with player restrictions and curated exceptions.
- Generated routers for standard CRUD
  - Each resource mounted at `/api/v1/{resource}` via a CRUD factory with org isolation.
- Admin-only generic CRUD
  - Full surface mounted at `/api/admin/{resource}`; requires `admin` role.

Common Endpoints
- Health: `GET /api/health` → `{ "status": "ok" }`
- Root: `GET /` → brief message with links to `/docs`.

Resources at `/api/v1/{resource}`
- Accounts: `organizations`, `teams`, `users`, `memberships`
- Vocabulary: `vocab_terms`
- Media: `media_assets`, `clip_tags`
- Text/Metadata: `transcripts`, `clip_metadata`
- Coach Tools: `narrations`, `annotations`
- Search: `embeddings`
- Curation: `sequences`, `sequence_items`
- Governance: `policies` (write restricted), `audit_events` (read-only)
- Processing: `jobs`

Clips Access Rules
- Base: org isolation.
- Players: can only read clips they are tagged in (by metadata) or clips allowed by org policy (e.g., curated library after N days).
- Writes: players cannot create/update/delete; admins can delete.

JWT Example (payload)
{
  "sub": "<user-uuid>",
  "org_id": "<org-uuid>",
  "role": "coach",
  "iss": "rugbycodex",
  "exp": 1712345678
}

Sample Requests
- List clips (auth required)
  curl -H "Authorization: Bearer <JWT>" \
       http://localhost:8000/api/v1/clips?limit=20

- Create a vocab term (non-player)
  curl -X POST -H "Authorization: Bearer <JWT>" \
       -H "Content-Type: application/json" \
       -d '{"category":"Attack Events","term":"Line Break"}' \
       http://localhost:8000/api/v1/vocab_terms

- Admin-only: list jobs via generic surface
  curl -H "Authorization: Bearer <ADMIN_JWT>" \
       http://localhost:8000/api/admin/jobs

Notes
- No S3 integration in this API layer; `s3_key` is a string field.
- Vector indexes should be created via SQL helpers after embeddings are inserted.

