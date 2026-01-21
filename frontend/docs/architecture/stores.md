# Rugbycodex Store Architecture

This document defines the architectural role, contracts, and invariants of all Pinia stores in Rugbycodex.

Stores act as domain services that mediate between UI components and backend-facing services, encapsulating the business rules and lifecycle concerns for identity, organization context, media context, and UI chrome.

UI reads from stores as the canonical source of domain state and invokes store actions to trigger domain workflows; stores translate those actions into API calls, cache/derive domain meaning, and broadcast stable, business-level state for the UI to render.

---

## Global Overview

In Rugbycodex, stores act as domain services that mediate between UI components and backend-facing services, encapsulating the business rules and lifecycle concerns for identity, organization context, media context, and UI chrome.

UI reads from stores as the canonical source of domain state and invokes store actions to trigger domain workflows; stores translate those actions into API calls, cache/derive domain meaning, and broadcast stable, business-level state for the UI to render.

---

## Store: useSidebarStore.ts

### Domain Role
Represents the user’s navigation chrome state: whether the app’s sidebar is open or closed for the current viewport.  
Exists as a bounded context because sidebar behavior must be consistent across routes, persisted across sessions, and responsive to viewport changes.

### Responsibilities
- Owns the persisted open/closed state of the sidebar.
- Applies viewport-aware defaults (open on desktop, closed on mobile).
- Auto-closes the sidebar on mobile navigation.

### Non-Responsibilities
- Does NOT own layout composition or navigation items.
- Does NOT own auth/org state or content visibility decisions.

### State Model
- isOpen: whether the sidebar is currently open (public-facing).
- isMobile: derived from viewport (public-facing).
- Internal persistence via localStorage keyed by a fixed storage key (internal).

### Public Interface

**Getters / Readonly Surfaces**
- isOpen  
- isMobile  

**Actions**
- setOpen(next): explicitly sets open/closed state (user intent or programmatic).  
- toggle(): flips state for quick UI toggles.  
- open(), close(): explicit UI intents.  
- reset(): restores viewport-aware default (e.g., after layout reset).

### Side Effects
- localStorage persistence on every open/close change.  
- Watches router path to auto-close on mobile when navigation occurs.  
- Uses viewport composable to respond to mobile/desktop.

### Cross-Store Relationships
- No Pinia dependencies; uses useViewport composable and router.  
- Downstream-only: it provides UI chrome state for components.

### UI Contract
- UI reads isOpen and isMobile to render layout appropriately.  
- UI must call actions to change state; direct ref mutation outside actions should be avoided.  
- UI must not bypass the store by writing to localStorage directly.

### Lifecycle Behavior
- Initializes immediately with persisted or viewport default.  
- Reacts to route changes on mobile to close.

### Invariants & Guarantees
- isOpen is always a boolean and persisted.  
- On mobile navigation, the sidebar will be closed.

---

## Store: useAuthStore.ts

### Domain Role
Represents the authenticated identity and session state of the current user, including role-based access and session lifecycle.  
Exists as its own bounded context because authentication drives access, personalization, and downstream data lifecycles.

### Responsibilities
- Owns the current user identity and session token state.  
- Normalizes authentication errors for user-friendly display.  
- Handles session expiry detection and cleanup.  
- Manages auth lifecycle initialization and subscription to auth changes.

### Non-Responsibilities
- Does NOT own profile data beyond the auth user record.  
- Does NOT own organization membership or selection, except for triggering cleanup.

### State Model
- user: current authenticated user (public-facing).  
- session: active session data (public-facing).  
- initializing: whether auth initialization is in progress (public-facing).  
- hydrated: whether initial auth state has been loaded (public-facing).  
- lastError: last auth-related error message (public-facing).  
- isAdmin: derived from JWT claims (public-facing).  
- Internal: initPromise, subscription to prevent duplicate initialization.

### Public Interface

**Getters / Readonly Surfaces**
- isAuthenticated  
- userReadonly  
- sessionReadonly  
- isAdminReadonly  
- initializingReadonly  
- hydratedReadonly  
- lastErrorReadonly  

**Actions**
- initialize(): establish auth state and subscribe to auth changes.  
- signIn(email, password, captchaToken): authenticate user via credentials.  
- signUp(...): create a new user identity.  
- resendConfirmationEmail(email, redirectTo, captchaToken): restart sign-up confirmation flow.  
- signOut(): terminate session and clear identity.  
- resetPassword(email, redirectTo, captchaToken): start password reset flow.  
- updatePassword(password): change account password.  
- updateDisplayName(name): update user profile display name in auth metadata.

### Side Effects
- Calls Supabase auth APIs for session management.  
- Subscribes to Supabase auth state changes.  
- On sign-out, clears useMyOrganizationsStore.  
- Logs JWT claims in dev.

### Cross-Store Relationships
- Depends on useMyOrganizationsStore to clear org memberships on sign-out.  
- Upstream for many domains: auth state gates profile/org/media stores.

### UI Contract
- UI reads isAuthenticated, userReadonly, isAdminReadonly to gate access.  
- UI triggers auth workflows via actions only.  
- UI must not mutate user, session, or isAdmin directly.  
- UI must not assume hydrated immediately true or that user is available on first render.

### Lifecycle Behavior
- Initialized on app boot via initialize().  
- Subscribes to auth state changes once.  
- Clears identity on session expiry detection.

### Invariants & Guarantees
- user and session are always coherent (session.user aligns with user).  
- isAdmin reflects JWT claims when session exists.  
- hydrated indicates that a session lookup has been attempted.

---

## Store: useProfileStore.ts

### Domain Role
Represents the user’s domain profile (not just auth identity), including role and readiness state.  
Exists as a bounded context because profile data is fetched independently of auth and can be cached, invalidated, and reloaded.

### Responsibilities
- Owns the current user profile and its loading/error lifecycle.  
- Automatically reacts to auth changes to load or clear profile.

### Non-Responsibilities
- Does NOT own authentication or session state.  
- Does NOT own organization selection.

### State Model
- profile: user profile record (public-facing).  
- loaded: whether profile data has been loaded (public-facing).  
- loading: whether a load is in progress (public-facing).  
- error: last profile load error (public-facing).  
- Derived: isAdmin based on profile role, isReady for UI gating.  
- Internal: loadToken to guard stale async responses.

### Public Interface

**Getters / Readonly Surfaces**
- isAdmin  
- isReady  
- profileReadonly  
- loadedReadonly  
- loadingReadonly  
- errorReadonly  

**Actions**
- load({ force }): fetches the user’s profile from the profile service.  
- clear(): resets profile state, typically on logout.

### Side Effects
- Calls profile service to fetch the user’s profile.  
- Watches auth user to auto-load or clear.

### Cross-Store Relationships
- Depends on useAuthStore for auth lifecycle trigger.  
- Downstream: provides profile info for UI, role-based gating.

### UI Contract
- UI reads profile/isReady to render profile-dependent views.  
- UI must call load() to refresh when needed; avoid reassigning profile directly.  
- UI must not assume profile is present just because auth is present.

### Lifecycle Behavior
- Auto-loads when auth user exists; clears when auth user is absent.  
- Supports forced reload for explicit refresh flows.

### Invariants & Guarantees
- When isReady is true, loaded is true and loading is false.  
- profile is null when not loaded or on error.

---

## Store: useMyOrganizationsStore.ts

### Domain Role
Represents the authenticated user’s organization memberships and summaries.  
Exists as its own bounded context because org membership is a core domain entity and is reused across app flows.

### Responsibilities
- Owns the list of organizations the user belongs to.  
- Manages loading and error lifecycle for memberships.  
- Provides convenience derivations (fallback org, membership count).

### Non-Responsibilities
- Does NOT own active organization selection.  
- Does NOT own organization details beyond the summarized membership response.

### State Model
- items: list of UserOrganizationSummary (public-facing).  
- loaded: whether memberships were loaded (public-facing).  
- loading: load-in-progress flag (public-facing).  
- error: last load error (public-facing).  
- Derived: fallbackOrg, hasOrganizations, membershipCount, isReady.  
- Internal: loadToken to avoid stale updates.

### Public Interface

**Getters / Readonly Surfaces**
- fallbackOrg  
- hasOrganizations  
- membershipCount  
- isReady  
- itemsReadonly  
- loadedReadonly  
- loadingReadonly  
- errorReadonly  

**Actions**
- load({ force }): fetches memberships.  
- refresh(): forced reload.  
- clear(): resets memberships (e.g., on logout).

### Side Effects
- Calls organization service to load memberships.  
- Logs when memberships are loaded.

### Cross-Store Relationships
- No direct store dependencies.  
- Downstream of auth (auth store calls clear() on sign-out).  
- Upstream for active org selection (UI may use items to pick).

### UI Contract
- UI reads items and isReady for membership-driven navigation.  
- UI must use load()/refresh() rather than mutating items.  
- UI must not assume items is non-empty.

### Lifecycle Behavior
- Typically loaded after authentication succeeds.  
- Cleared on sign-out.

### Invariants & Guarantees
- When isReady is true, loaded is true and loading is false.  
- items reflects the most recent successful load.

---

## Store: useActiveOrganizationStore.ts

### Domain Role
Represents the user’s current organization context, including membership-aware organization summary and member count.  
Exists as a bounded context because the active org drives routing, permissions, and data scoping.

### Responsibilities
- Owns the currently selected organization context.  
- Resolves org details by slug, including membership-aware data.  
- Tracks member count for the active org.  
- Clears stale org context on auth identity changes.

### Non-Responsibilities
- Does NOT own the list of organizations.  
- Does NOT own media or content under the org.

### State Model
- orgContext: currently active org summary (public-facing).  
- memberCount: count of org members (public-facing, derived from signal).  
- resolving: whether org resolution is in progress (public-facing).  
- error: last resolution error (public-facing).  
- Derived: hasActiveOrg, isReady, orgContextReadonly.  
- Internal: resolveToken for concurrency safety.

### Public Interface

**Getters / Readonly Surfaces**
- hasActiveOrg  
- isReady  
- orgContextReadonly  

**Actions**
- setActiveBySlug(slug): resolves active org based on route slug and user membership.  
- clear(): clears active context, typically on auth change or route context loss.

### Side Effects
- Calls org service to resolve org by slug and member count.  
- Watches auth user ID to clear stale org context.

### Cross-Store Relationships
- Depends on useAuthStore to avoid stale org state across users.  
- Upstream for org-scoped stores such as useOrgMediaStore.

### UI Contract
- UI reads orgContext/isReady for org-scoped rendering.  
- UI must call setActiveBySlug() rather than writing orgContext.  
- UI must not assume org context is valid across auth changes.

### Lifecycle Behavior
- Typically invoked during org route resolution (slug-based).  
- Clears when auth identity changes to prevent cross-user leakage.

### Invariants & Guarantees
- When isReady is true, org context exists and resolution is not in progress.  
- orgContext always corresponds to the current user’s membership.

---

## Store: useOrgMediaStore.ts

### Domain Role
Represents an organization’s media library and its narrative context coverage.  
Exists as a bounded context because media and narration coverage are org-scoped and require coordinated fetching.

### Responsibilities
- Loads and caches org media assets.  
- Tracks narration counts per asset to describe context completeness.  
- Resets data when active org changes.

### Non-Responsibilities
- Does NOT own media upload or mutation flows.  
- Does NOT own active org selection.

### State Model
- assets: org media assets list (public-facing).  
- narrationCounts: map of asset ID to narration count (public-facing).  
- loadedOrgId: org ID that current data belongs to (public-facing).  
- status: load status and error (public-facing).  
- Derived: isLoading, isReady, isIdle.  
- Internal: loadToken for concurrency safety.

### Public Interface

**Getters / Readonly Surfaces**
- isLoading  
- isReady  
- isIdle  
- assets  
- narrationCounts  

**Actions**
- loadForActiveOrg(): fetches assets and narration counts for current org.  
- reset(): clears media data when org context changes.

**Domain Utilities**
- narrationCountByAssetId(id): returns narration count for an asset.  
- hasNarrations(id): true if asset has any narrations.  
- getContextState(id): semantic coverage state for an asset.

### Side Effects
- Calls media service APIs for assets and narration counts.  
- Watches active org ID and resets when it changes.

### Cross-Store Relationships
- Depends on useActiveOrganizationStore for org context.  
- Downstream: provides media and context coverage to UI.

### UI Contract
- UI reads assets, narrationCounts, and readiness flags to render media lists.  
- UI must call loadForActiveOrg() to initiate loading.  
- UI must not mutate assets or narrationCounts directly.  
- UI must not assume data is valid if loadedOrgId differs from active org.

### Lifecycle Behavior
- Resets automatically when active org changes.  
- Loads on demand when UI triggers loadForActiveOrg().

### Invariants & Guarantees
- When isReady is true, assets and narrationCounts represent the same org.  
- getContextState() derives coverage state from narration counts.

---

## System-Level Summary

### Architectural Shape
- Foundational stores: useAuthStore, useMyOrganizationsStore, useActiveOrganizationStore.  
- Leaf-domain stores: useProfileStore, useOrgMediaStore, useSidebarStore.  
- Auth is the root; org selection and profile are downstream; media is downstream of active org; sidebar is UI-chrome only.

### Data Flow Narrative
1. User logs in → useAuthStore sets session/user and isAdmin.  
2. UI triggers useMyOrganizationsStore.load().  
3. useProfileStore auto-loads via auth watch.  
4. UI calls useActiveOrganizationStore.setActiveBySlug().  
5. useOrgMediaStore.loadForActiveOrg() loads assets + narration counts.  
6. UI renders media + context coverage.  

Narration update flow:
- Media or narration modules update backend.  
- UI triggers useOrgMediaStore.loadForActiveOrg() to refresh counts.

### Mental Model
Think of the store layer as an orchestration bus:

- Auth establishes identity.  
- Org selection sets the scope.  
- Profile and media fill in domain specifics.  
- Sidebar provides global UI chrome state.  

Each store owns a bounded domain contract that the UI consumes rather than implements.

