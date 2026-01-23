# RugbyCodex Architecture Guide

> **Comprehensive guide to understanding the codebase structure, patterns, and conventions**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Directory Structure](#directory-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Module Organization Pattern](#module-organization-pattern)
7. [Data Flow](#data-flow)
8. [Authentication & Authorization](#authentication--authorization)
9. [Organization Context System](#organization-context-system)
10. [Error Handling](#error-handling)
11. [Naming Conventions](#naming-conventions)
12. [Key Technologies](#key-technologies)
13. [Design Patterns](#design-patterns)

---

## Project Overview

**RugbyCodex** is a multi-tenant rugby intelligence platform that manages events, matches, and training sessions. It organizes video and metadata into searchable libraries, enabling coaches and unions to track development, tag plays, and build AI-driven insights for player and team performance.

**Key Features:**
- Multi-tenant organization system
- Video upload and streaming (HLS)
- AI-powered analysis and narrations
- Media asset management
- Role-based access control
- Search and embeddings

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Vue 3 SPA   │  │  Pinia Store │  │   Router     │      │
│  │  Components  │──│    State     │──│   Guards     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                 │                  │             │
│           └─────────────────┴──────────────────┘             │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  API Layer     │
                    │  (api.ts)      │
                    └───────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼──────┐  ┌────────▼────────┐
│ Supabase       │  │  Supabase   │  │  Wasabi S3      │
│ Edge Functions │  │  Database   │  │  Storage        │
│ (Deno)         │  │  (Postgres) │  │  (Video/Media)  │
└────────────────┘  └─────────────┘  └─────────────────┘
        │                   │
        └───────────────────┤
                    ┌───────▼────────┐
                    │  OpenAI API    │
                    │  (Whisper,     │
                    │   GPT-4o)      │
                    └────────────────┘
```

---

## Directory Structure

```
rugbycodex/
├── frontend/                    # Vue 3 SPA
│   ├── src/
│   │   ├── assets/             # Static assets (images, fonts)
│   │   ├── components/         # Global shared components
│   │   ├── composables/        # Global Vue composables
│   │   ├── layouts/            # Layout components
│   │   ├── lib/                # Core utilities & infrastructure
│   │   ├── modules/            # Feature modules (main app logic)
│   │   ├── router/             # Route definitions
│   │   ├── stores/             # Global Pinia stores
│   │   ├── types/              # Global TypeScript types
│   │   ├── views/              # Top-level view components
│   │   ├── App.vue             # Root component
│   │   └── main.ts             # App entry point
│   │
│   └── supabase/               # Supabase Edge Functions (Deno)
│       └── functions/
│           ├── _shared/        # Shared edge function utilities
│           ├── ai-orchestrator/
│           ├── create-organization/
│           ├── get-wasabi-upload-session/
│           └── ... (32 total functions)
│
├── supabase/                   # Supabase project configuration
│   └── functions/              # Symlink or copy of edge functions
│
├── jetson_scripts/             # Scripts for Jetson hardware
├── docs/                       # Documentation
└── README.md
```

---

## Frontend Architecture

### Technology Stack

- **Framework:** Vue 3 (Composition API)
- **State Management:** Pinia
- **Routing:** Vue Router
- **Styling:** TailwindCSS 4
- **Build Tool:** Vite
- **Type System:** TypeScript
- **API Client:** Supabase JS SDK
- **Video Streaming:** HLS.js, Shaka Player
- **File Uploads:** tus-js-client (resumable uploads)

### Core Libraries (`/src/lib/`)

Central infrastructure layer for cross-cutting concerns:

| File | Purpose | Key Features |
|------|---------|--------------|
| **api.ts** | Edge function invocation | • Org-scoped requests<br>• Request ID generation<br>• Logging & error handling<br>• Auto-injects org context |
| **supabaseClient.ts** | Supabase SDK instance | • Singleton client<br>• Configured with env vars |
| **handleEdgeFunctionError.ts** | Error normalization | • Uses official Supabase error types<br>• Extracts error messages<br>• Retry detection<br>• Status code helpers |
| **toast.ts** | Notification system | • Event-driven toast API<br>• Deduplication logic |
| **jwt.ts** | JWT token handling | • Decode Supabase tokens<br>• Extract user claims |
| **pinia.ts** | Pinia instance | • Shared store instance |

**Key Pattern: `invokeEdge()` Function**

```typescript
// Located in: src/lib/api.ts
await invokeEdge('function-name', {
  body: payload,
  orgScoped: true,  // Auto-injects x-org-id header
});
```

---

## Backend Architecture

### Supabase Edge Functions (Deno)

**Location:** `frontend/supabase/functions/`

**Total Functions:** 32 edge functions organized by feature domain

#### Shared Utilities (`_shared/`)

All edge functions share common infrastructure:

| File | Purpose | Usage |
|------|---------|-------|
| **errors.ts** | Error handling | `errorResponse(code, message, status)` |
| **auth.ts** | JWT validation | `requireAuth(req)` |
| **cors.ts** | CORS handling | `handleCors(req)` |
| **orgs.ts** | Org validation | `requireOrgId(req)` |
| **roles.ts** | Permission checks | `requireOrgRole(userId, orgId, minRole)` |
| **media.ts** | Media asset ops | `insertMediaAsset(...)` |
| **observability.ts** | Logging | `logEvent(...)` |

#### Function Categories

**Organization Management:**
- `create-organization`
- `approve-organization-request`
- `join-organization-with-code`
- `leave-organization`
- `transfer-ownership`
- `change-member-role`
- `set-primary-org`

**Media & Upload:**
- `get-wasabi-upload-session` (S3 STS credentials)
- `upload-eligibility-check` (quota validation)
- `get-wasabi-playback-playlist` (HLS playlist rewriting)
- `get-playback-playlist` (CDN-based HLS)

**AI Features:**
- `ai-orchestrator` (GPT-4o analysis & narration)
- `transcribe-wav-file` (Whisper API)
- `transcribe-webm-file` (Whisper API)
- `summarize-media-asset` (GPT-4o summaries)
- `generate-query-embedding` (OpenAI embeddings)
- `generate-narration-embedding` (OpenAI embeddings)

**Admin:**
- `list-organizations-admin`
- `get-organizations-near-limit`
- `get-inactive-organizations`
- `get-recently-created-organizations`
- `get-organization-health`
- `get-organization-stats`

#### Standard Edge Function Pattern

```typescript
// Example: frontend/supabase/functions/create-organization/index.ts
import { handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  // 1. Handle CORS
  const corsHeaders = handleCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Authenticate user
    const auth = await requireAuth(req);
    
    // 3. Parse & validate input
    const payload = await req.json();
    
    // 4. Business logic (database, external APIs)
    const result = await doWork(payload, auth.userId);
    
    // 5. Return success
    return jsonResponse(result, 200);
    
  } catch (error) {
    // 6. Error handling
    return errorResponse(
      "CREATE_ORG_FAILED", 
      error.message, 
      500
    );
  }
});
```

---

## Module Organization Pattern

All feature modules follow a **consistent structure** for predictability and maintainability.

### Standard Module Structure

```
modules/<feature>/
├── components/       # Feature-specific Vue components
├── composables/      # Feature-specific Vue composables
├── services/         # API & business logic layer
├── stores/           # Pinia stores for state management
├── types/            # TypeScript type definitions
└── views/            # Route-level page components
```

### Example: `modules/orgs/`

```
orgs/
├── components/
│   ├── OrgMemberList.vue
│   ├── OrgStorageBar.vue
│   └── CreateOrgDialog.vue
│
├── composables/
│   └── useOrgCapabilities.ts      # Permission helpers
│
├── services/
│   └── orgServiceV2.ts             # 23 org-related API calls
│
├── stores/
│   ├── activeOrgContext.ts         # Global org context ref
│   ├── useActiveOrganizationStore.ts  # Current org state
│   └── useMyOrganizationsStore.ts  # User's org list
│
├── types/
│   ├── index.ts                    # Re-exports all types
│   ├── Organization.ts
│   ├── OrgMember.ts
│   ├── OrgRole.ts
│   ├── OrgStats.ts
│   └── ... (20+ type files)
│
└── views/
    ├── OrgOverview.vue
    ├── OrgMediaV2.vue
    ├── OrgMembers.vue
    └── OrgsListView.vue
```

### Module Examples

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **auth** | Authentication | Sign in/up, session management, JWT handling |
| **orgs** | Organizations | Multi-tenancy, memberships, roles, settings |
| **media** | Media assets | Video upload, streaming, transcoding status |
| **narrations** | Narrations | Audio recording, transcription, embeddings |
| **analysis** | AI analysis | Match summaries, play tagging, insights |
| **profiles** | User profiles | Display name, preferences |
| **admin** | Admin panel | Org management, usage stats |
| **feed** | Activity feed | Timeline, notifications |
| **groups** | User groups | Team organization |
| **assignments** | Task system | Coaching assignments |

---

## Data Flow

### Typical Request Flow

```
┌──────────────┐
│ Vue Component│
└──────┬───────┘
       │ 1. User action (click, form submit)
       │
┌──────▼───────┐
│ Store/       │
│ Service      │  2. Call service method
└──────┬───────┘
       │
┌──────▼───────┐
│ api.ts       │  3. invokeEdge(functionName, options)
│ invokeEdge() │     • Auto-inject org-id header
└──────┬───────┘     • Add request-id
       │             • Log request
       │
┌──────▼────────────┐
│ Edge Function     │  4. Execute on Deno runtime
│ (Supabase/Deno)   │     • Validate auth (requireAuth)
└──────┬────────────┘     • Check permissions
       │                  • Query database
       │                  • Call external APIs
┌──────▼────────────┐
│ Supabase DB       │  5. Database operations
│ (PostgreSQL)      │     • RLS policies enforce security
└──────┬────────────┘
       │
┌──────▼────────────┐
│ External Services │  6. Optional: external APIs
│ • Wasabi S3       │     • S3 for media storage
│ • OpenAI API      │     • OpenAI for AI features
└──────┬────────────┘
       │
       │ 7. Response chain back up
       │
┌──────▼───────┐
│ Component    │  8. Update UI
│ (Vue)        │     • Display data or error
└──────────────┘
```

### Example: Uploading Media

```typescript
// 1. Component triggers upload
// File: modules/orgs/views/OrgMediaV2.vue
async function handleUploadSubmit(files: File[]) {
  try {
    // 2. Service creates upload session
    const job = await buildUploadJob(files[0]);
    
    // 3. Upload to S3 with tus
    await executeUpload(job);
    
  } catch (err) {
    // 4. Error handling with new standardized handler
    const normalized = await handleEdgeFunctionError(err);
    toast({ variant: 'error', message: normalized.message });
  }
}

// Service: modules/media/stores/useUploadStore.ts
async function buildUploadJob(file: File) {
  // Calls edge function to get S3 credentials
  const { data, error } = await invokeEdge('get-wasabi-upload-session', {
    body: { fileName, mimeType, fileSize },
    orgScoped: true,  // Auto-injects org-id
  });
  
  if (error) throw await handleEdgeFunctionError(error);
  
  return {
    uploadUrl: data.uploadUrl,
    credentials: data.credentials,
    mediaAssetId: data.mediaAssetId,
  };
}

// Edge function: supabase/functions/get-wasabi-upload-session/index.ts
Deno.serve(async (req: Request) => {
  const auth = await requireAuth(req);
  const orgId = requireOrgId(req);
  
  // 1. Check upload eligibility (quota)
  await checkUploadEligibility(orgId, fileSize);
  
  // 2. Create media asset record in DB
  const asset = await insertMediaAsset({ orgId, uploaderId, ... });
  
  // 3. Generate S3 STS credentials
  const credentials = await getWasabiSTSCredentials(orgId, assetId);
  
  return jsonResponse({ uploadUrl, credentials, mediaAssetId });
});
```

---

## Authentication & Authorization

### Authentication Flow

**Implementation:** `modules/auth/stores/useAuthStore.ts`

```typescript
// 1. App bootstrap (main.ts)
const authStore = useAuthStore(pinia);
await authStore.initialize();  // Hydrate session from Supabase

// 2. Auth state management
const authStore = useAuthStore();
authStore.user         // Current user object
authStore.session      // Session with JWT
authStore.isAdmin      // Extracted from JWT claims
authStore.hydrated     // Session loaded?

// 3. Sign in
await authStore.signIn(email, password);

// 4. Sign out
await authStore.signOut();
```

### JWT Claims

Supabase JWTs contain custom claims:

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "user_role": "admin",  // or "authenticated"
  "aud": "authenticated",
  "exp": 1234567890
}
```

**Extraction:** `lib/jwt.ts`

```typescript
const claims = decodeSupabaseAccessToken(session.access_token);
const isAdmin = claims?.user_role === 'admin';
```

### Authorization Layers

**1. Route Guards (Frontend)**

```typescript
// router/index.ts
router.beforeEach(async (to) => {
  // Require auth for protected routes
  if (to.meta.requiresAuth && !authStore.user) {
    return { name: 'SignIn' };
  }
  
  // Require admin role
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return { name: 'Home' };
  }
  
  // Org-scoped routes
  if (to.meta.orgScoped) {
    const orgSlug = to.params.slug;
    await activeOrganizationStore.setActiveBySlug(orgSlug);
    
    // Check minimum role
    const minRole = to.meta.minOrgRole;
    if (minRole && !hasOrgAccess(currentRole, minRole)) {
      return { name: 'OrgOverview' };
    }
  }
});
```

**2. Edge Function Auth (Backend)**

```typescript
// _shared/auth.ts
export async function requireAuth(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Unauthorized');
  }
  
  return { userId: user.id, email: user.email };
}

// _shared/roles.ts
export async function requireOrgRole(
  userId: string,
  orgId: string,
  minRole: 'staff' | 'manager' | 'owner'
) {
  const membership = await getMembership(userId, orgId);
  
  if (!hasOrgAccess(membership.role, minRole)) {
    throw new Error('Insufficient permissions');
  }
}
```

**3. Database RLS (Row-Level Security)**

Postgres policies enforce data access at the database level:

```sql
-- Example: Users can only see media in orgs they're members of
CREATE POLICY "Members can view org media"
ON media_assets FOR SELECT
USING (
  org_id IN (
    SELECT org_id FROM org_memberships
    WHERE user_id = auth.uid()
  )
);
```

### Role Hierarchy

```
owner > manager > staff > viewer > guest
```

**Implementation:** `modules/orgs/composables/useOrgCapabilities.ts`

```typescript
export function hasOrgAccess(
  currentRole: MembershipRole | null,
  requiredRole: MembershipRole
): boolean {
  const hierarchy = ['owner', 'manager', 'staff', 'viewer', 'guest'];
  const currentIndex = hierarchy.indexOf(currentRole ?? 'guest');
  const requiredIndex = hierarchy.indexOf(requiredRole);
  return currentIndex <= requiredIndex;
}
```

---

## Organization Context System

RugbyCodex is a **multi-tenant application**. Most features are scoped to an organization.

### Global Org Context

**Implementation:** `modules/orgs/stores/activeOrgContext.ts`

```typescript
// Global reactive ref for active org
export const activeOrgIdRef = ref<string | null>(null);

export function setActiveOrgId(orgId: string | null) {
  activeOrgIdRef.value = orgId;
}
```

### Active Organization Store

**Implementation:** `modules/orgs/stores/useActiveOrganizationStore.ts`

```typescript
const activeOrgStore = useActiveOrganizationStore();

// Load org by slug (from URL param)
await activeOrgStore.setActiveBySlug('my-rugby-club');

// Current org context
activeOrgStore.orgContext = {
  organization: { id, name, slug, ... },
  membership: { role: 'manager', ... },
  capabilities: { canUpload: true, canManageMembers: false },
  storageUsage: { used: 5GB, limit: 10GB },
};
```

### Org-Scoped API Calls

**Pattern:** Use `orgScoped: true` in `invokeEdge()`

```typescript
// Automatically injects x-org-id header from activeOrgIdRef
const { data } = await invokeEdge('upload-eligibility-check', {
  orgScoped: true,  // Uses activeOrgIdRef.value
});

// Equivalent to:
const { data } = await invokeEdge('upload-eligibility-check', {
  headers: {
    'x-org-id': activeOrgIdRef.value,
  },
});
```

### Org Context in Edge Functions

```typescript
// _shared/orgs.ts
export function requireOrgId(req: Request): string {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) throw new Error('Organization context required');
  return orgId;
}

// Usage in edge function
const orgId = requireOrgId(req);
const auth = await requireAuth(req);
await requireOrgRole(auth.userId, orgId, 'staff');
```

---

## Error Handling

### **Standardized Error Handling (New - 2026-01-23)**

After comprehensive migration, all error handling follows Supabase best practices.

#### Backend Pattern

**File:** `frontend/supabase/functions/_shared/errors.ts`

```typescript
export type ErrorCode =
  | "AUTH_MISSING_TOKEN"
  | "AUTH_INVALID_TOKEN"
  | "MISSING_REQUIRED_FIELDS"
  | "WASABI_CREDENTIALS_MISSING"
  | "MEDIA_ASSET_CREATE_FAILED"
  | "STORAGE_QUOTA_EXCEEDED"
  | ... // 33 total error codes

export function errorResponse(
  code: ErrorCode,
  message: string,
  status = 500,
  logError = true
): Response {
  // Auto-log errors
  if (logError) {
    console.error(JSON.stringify({ code, message, status }));
  }
  
  // Return standardized format
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...handleCors(),
      },
    }
  );
}
```

**Usage in edge functions:**

```typescript
// Before (old pattern - deprecated)
throw new Error('Something failed');
return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 });

// After (new pattern - all 32 functions migrated)
return errorResponse('MEDIA_ASSET_CREATE_FAILED', 'Failed to create asset', 500);
```

#### Frontend Pattern

**File:** `src/lib/handleEdgeFunctionError.ts`

Uses official Supabase error types:

```typescript
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from '@supabase/supabase-js';

export async function handleEdgeFunctionError(
  error: unknown,
  fallbackMessage = 'Unexpected error'
): Promise<NormalizedError> {
  
  // FunctionsHttpError: Function returned 4xx/5xx
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json();
    return new Error(body?.error?.message || fallbackMessage);
  }
  
  // FunctionsRelayError: Network issue
  if (error instanceof FunctionsRelayError) {
    return new Error('Network error. Please check your connection.');
  }
  
  // FunctionsFetchError: Function couldn't be reached
  if (error instanceof FunctionsFetchError) {
    return new Error('Service unavailable. Please try again.');
  }
  
  return new Error(fallbackMessage);
}
```

**Usage in services (all 5 services migrated):**

```typescript
// orgServiceV2.ts, mediaService.ts, narrationService.ts, 
// transcriptionService.ts, analysisService.ts

try {
  const { data, error } = await invokeEdge('function-name', options);
  if (error) {
    throw await handleEdgeFunctionError(error, 'Operation failed');
  }
  return data;
} catch (err) {
  throw await handleEdgeFunctionError(err, 'Unexpected error');
}
```

#### User-Friendly Error Messages

**Example:** Storage quota errors in `OrgMediaV2.vue`

```typescript
// Raw error from backend:
// "Failed to insert media asset: Storage quota exceeded for org 
//  95d7b8b6... (limit 10240 MB, used 13530 MB, attempted +0 MB)"

// Transformed for users:
if (errMsg.includes('Storage quota exceeded')) {
  const match = errMsg.match(/limit (\d+) MB, used (\d+) MB/);
  if (match) {
    const limitGB = (parseInt(match[1]) / 1024).toFixed(2);
    const usedGB = (parseInt(match[2]) / 1024).toFixed(2);
    
    errorMessage = 
      `Storage quota exceeded. Your organization is using ${usedGB} GB ` +
      `of ${limitGB} GB. Please delete some media or contact support.`;
  }
}

toast({ 
  variant: 'error', 
  message: errorMessage,
  durationMs: 5000  // Longer for important errors
});
```

### Migration Status

✅ **Backend:** 32/32 edge functions migrated (100%)
✅ **Frontend:** 5/5 services migrated (100%)
- orgServiceV2.ts (23 instances)
- mediaService.ts (4 instances)
- narrationService.ts (3 instances)
- transcriptionService.ts (2 instances)
- analysisService.ts (2 instances)

🗑️ **Deprecated:** `handleSupabaseEdgeError.ts` (kept for reference)

---

## Naming Conventions

### Files

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase.vue | `OrgMemberList.vue` |
| Views | PascalCase.vue | `OrgMediaV2.vue` |
| Services | camelCase.ts | `orgServiceV2.ts` |
| Stores | useCamelCase.ts | `useAuthStore.ts` |
| Composables | useCamelCase.ts | `useOrgCapabilities.ts` |
| Types | PascalCase.ts | `Organization.ts` |
| Utils | camelCase.ts | `format.ts` |
| Edge Functions | kebab-case | `get-wasabi-upload-session` |

### Code

```typescript
// Variables & Functions: camelCase
const userId = 'abc';
function getUserProfile() {}

// Types & Interfaces: PascalCase
type Organization = { id: string };
interface OrgMember { role: string }

// Constants: SCREAMING_SNAKE_CASE
const MAX_UPLOAD_SIZE = 1024 * 1024 * 100;
const SESSION_EXPIRED_MESSAGE = 'Session expired';

// Enums: PascalCase keys
enum MembershipRole {
  Owner = 'owner',
  Manager = 'manager',
  Staff = 'staff',
}
```

### Pinia Stores

**Pattern:** `use<Feature>Store.ts`

```typescript
// Definition
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  // ...
});

// Usage
const authStore = useAuthStore();
```

### Edge Functions

**Pattern:** `<action>-<resource>` or `<verb>-<noun>`

Examples:
- `get-wasabi-upload-session`
- `create-organization`
- `list-organizations-admin`
- `approve-organization-request`

---

## Key Technologies

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Vue 3** | UI framework | 3.5.22 |
| **Pinia** | State management | 3.0.3 |
| **Vue Router** | Routing | 4.5.1 |
| **TypeScript** | Type system | Latest |
| **Vite** | Build tool | Latest |
| **TailwindCSS** | Styling | 4.1.14 |
| **Supabase JS** | Backend SDK | 2.58.0 |
| **HLS.js** | Video streaming | 1.5.17 |
| **Shaka Player** | Video player | 4.16.13 |
| **tus-js-client** | Resumable uploads | 4.3.1 |
| **AWS SDK S3** | S3 operations | 3.956.0 |

### Backend

| Technology | Purpose |
|------------|---------|
| **Deno** | Edge function runtime |
| **Supabase** | Backend-as-a-Service |
| **PostgreSQL** | Relational database |
| **Wasabi S3** | Video/media storage |
| **OpenAI API** | AI features (GPT-4o, Whisper, Embeddings) |

### Infrastructure

| Service | Purpose |
|---------|---------|
| **Supabase Auth** | Authentication & JWT |
| **Supabase Storage** | File storage |
| **Supabase Realtime** | WebSocket subscriptions |
| **Supabase Edge Functions** | Serverless API |
| **Wasabi Cloud Storage** | S3-compatible video storage |
| **Cloudflare** | CDN (optional) |

---

## Design Patterns

### 1. **Service Layer Pattern**

Services encapsulate all API logic and business rules.

```typescript
// Service file: modules/orgs/services/orgServiceV2.ts
export const orgService = {
  async createOrganization(payload) {
    const { data, error } = await invokeEdge('create-organization', {
      body: payload,
      orgScoped: false,
    });
    if (error) throw await handleEdgeFunctionError(error);
    return data;
  },
  
  async getOrganizationStats(orgId) {
    const { data, error } = await invokeEdge('get-organization-stats', {
      body: { orgId },
      orgScoped: true,
    });
    if (error) throw await handleEdgeFunctionError(error);
    return data;
  },
};

// Component usage:
import { orgService } from '@/modules/orgs/services/orgServiceV2';

const stats = await orgService.getOrganizationStats(orgId);
```

### 2. **Store Pattern (Pinia)**

Stores manage reactive state and orchestrate service calls.

```typescript
// Store: modules/orgs/stores/useActiveOrganizationStore.ts
export const useActiveOrganizationStore = defineStore('activeOrg', () => {
  const orgContext = ref<OrgContext | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  async function setActiveBySlug(slug: string) {
    loading.value = true;
    try {
      // Call service
      const data = await orgService.resolveOrgBySlug(slug);
      
      // Update state
      orgContext.value = data;
      setActiveOrgId(data.organization.id);
      
    } catch (err) {
      error.value = err.message;
      orgContext.value = null;
    } finally {
      loading.value = false;
    }
  }
  
  return { orgContext, loading, error, setActiveBySlug };
});
```

### 3. **Composable Pattern**

Reusable composition functions for cross-component logic.

```typescript
// Composable: modules/orgs/composables/useOrgCapabilities.ts
export function useOrgCapabilities() {
  const activeOrgStore = useActiveOrganizationStore();
  
  const canUpload = computed(() => 
    activeOrgStore.orgContext?.capabilities.canUpload ?? false
  );
  
  const canManageMembers = computed(() =>
    hasOrgAccess(
      activeOrgStore.orgContext?.membership.role,
      'manager'
    )
  );
  
  return { canUpload, canManageMembers };
}

// Usage in component:
const { canUpload, canManageMembers } = useOrgCapabilities();
```

### 4. **Edge Function Standard Pattern**

All edge functions follow a consistent structure:

```typescript
import { handleCors } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/auth.ts";
import { errorResponse, jsonResponse } from "../_shared/errors.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = handleCors(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Auth
    const auth = await requireAuth(req);
    
    // 2. Org context (if needed)
    const orgId = requireOrgId(req);
    
    // 3. Permissions (if needed)
    await requireOrgRole(auth.userId, orgId, 'staff');
    
    // 4. Parse input
    const payload = await req.json();
    
    // 5. Validate
    if (!payload.requiredField) {
      return errorResponse('MISSING_REQUIRED_FIELDS', 'Missing field', 400);
    }
    
    // 6. Business logic
    const result = await doWork(payload);
    
    // 7. Success response
    return jsonResponse(result, 200);
    
  } catch (error) {
    // 8. Error response
    return errorResponse('OPERATION_FAILED', error.message, 500);
  }
});
```

### 5. **Type Export Pattern**

Module types are centralized in `types/index.ts`:

```typescript
// modules/orgs/types/index.ts
export type { Organization } from './Organization';
export type { OrgMember } from './OrgMember';
export type { OrgRole } from './OrgRole';
// ... all types

// Usage anywhere:
import type { Organization, OrgMember } from '@/modules/orgs/types';
```

### 6. **Router Organization Pattern**

Routes are organized by feature domain:

```typescript
// router/orgRoutes.ts
export const orgRoutes = {
  path: '/:slug',
  component: OrgLayout,
  meta: { orgScoped: true },  // Trigger org context loading
  children: [
    {
      path: '',
      name: 'OrgOverview',
      component: () => import('@/modules/orgs/views/OrgOverview.vue'),
    },
    {
      path: 'media',
      name: 'OrgMedia',
      component: () => import('@/modules/orgs/views/OrgMediaV2.vue'),
      meta: { minOrgRole: 'viewer' },  // Require viewer+ role
    },
    {
      path: 'members',
      name: 'OrgMembers',
      component: () => import('@/modules/orgs/views/OrgMembers.vue'),
      meta: { minOrgRole: 'manager' },  // Require manager+ role
    },
  ],
};
```

### 7. **Toast Notification Pattern**

Simple event-driven toast system:

```typescript
// Anywhere in the app:
import { toast } from '@/lib/toast';

toast({
  variant: 'success',  // 'success' | 'error' | 'info'
  message: 'Organization created!',
  durationMs: 3000,
});

// Toast host component automatically receives and displays
// Location: components/ToastHost.vue
```

---

## Summary

**Key Architectural Principles:**

1. **Feature Modularity:** Each feature is a self-contained module
2. **Service Layer:** All API logic goes through services
3. **State Management:** Pinia stores for reactive state
4. **Org Context:** Multi-tenancy via global org context
5. **Standardized Errors:** Consistent error handling across frontend & backend
6. **Type Safety:** TypeScript everywhere
7. **Authentication:** JWT-based with RLS enforcement
8. **Serverless:** Deno edge functions for backend logic

**Development Workflow:**

1. **Add a new feature:**
   - Create module folder: `modules/<feature>/`
   - Add types, services, stores, components, views
   - Register routes in `router/<feature>Routes.ts`
   - Create edge functions in `supabase/functions/<function-name>/`

2. **Make API calls:**
   - Use `invokeEdge()` from services
   - Set `orgScoped: true` for org-scoped operations
   - Handle errors with `handleEdgeFunctionError()`

3. **Manage state:**
   - Create Pinia store: `use<Feature>Store.ts`
   - Use composables for reusable logic
   - Access stores in components

4. **Add edge function:**
   - Copy `_shared/` utilities
   - Follow standard pattern (CORS, auth, validation, response)
   - Use `errorResponse()` and `jsonResponse()`
   - Add error codes to `_shared/errors.ts`

---

**For more details, see:**
- Session checkpoints for implementation history
- Individual module READMEs (if available)
- Supabase documentation: https://supabase.com/docs
- Vue 3 docs: https://vuejs.org/guide/introduction.html

