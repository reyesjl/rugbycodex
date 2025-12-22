import { supabase } from "@/lib/supabaseClient";
import { requireUserId } from "@/modules/auth/identity";
import type {
  ActiveOrgContext,
  ApproveAndCreateOrgResult,
  CreateOrgPayload,
  OrgEditableFields,
  OrgHealth,
  OrgJoinRequest,
  OrgJobSummary,
  OrgMediaAssetSummary,
  OrgMember,
  OrgMembership,
  OrgNearLimit,
  OrgOverview,
  OrgRequest,
  OrgRequestAdminFilters,
  OrgRequestAdminView,
  OrgRole,
  OrgStats,
  OrgStorageLimit,
  OrgStorageRemaining,
  OrgStorageUsage,
  Organization,
  OrganizationAdminFilters,
  OrganizationAdminListItem,
  ResolvedOrgContext,
  SubmitOrgRequestPayload,
  UploadEligibility,
  UserOrganizationSummary,
} from "@/modules/orgs/types";

/**
 * orgServiceV2
 * -----------
 * Orchestration for all organization-related workflows.
 */

export const orgService = {
  // ===========================================================================
  // Context & Resolution
  // ===========================================================================

  /**
   * Resolves an organization identifier (UUID or slug) into canonical organization context.
   *
   * Problem it solves:
   * - Provides a single entry point for route/URL-driven org selection.
   * - Normalizes ambiguous identifiers into a canonical `Organization` + optional membership.
   *
   * Conceptual tables:
   * - `organizations`
   * - `org_members` (optional, to attach current user's role)
   *
   * Allowed caller:
   * - Authenticated user; visibility and membership constraints are enforced server-side (RLS).
   *
   * Implementation:
   * - Direct Supabase call (read-only, org-scoped via RLS).
   *
   * @param identifier - Organization UUID or slug.
   * @returns Resolved org context including matched strategy.
   */
  async resolveOrg(identifier: string): Promise<ResolvedOrgContext> {
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .or(`id.eq.${identifier},slug.eq.${identifier}`)
      .single();

    if (orgError) {
      throw orgError;
    }

    const userId = requireUserId();
    const { data: membershipData, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id, user_id, role, joined_at")
      .eq("org_id", orgData.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    return {
      organization: orgData,
      membership: membershipData ?? null,
      matched_by: orgData.id === identifier ? "id" : "slug",
    };
  },

  /**
   * Returns the app's current "active organization" context for the signed-in user.
   *
   * Problem it solves:
   * - Centralizes how the UI derives the active org (e.g., profile `primary_org`, persisted client state).
   *
   * Conceptual tables:
   * - `profiles.primary_org` (source of truth for default org)
   * - `organizations` (to hydrate org metadata)
   * - `org_members` (optional, to attach role)
   *
   * Allowed caller:
   * - Authenticated user.
   *
   * Implementation:
   * - Direct Supabase calls (read-only) and/or client state resolution.
   *
   * Returning null indicates:
   * - The user belongs to zero organizations or no resolvable primary org exists.
   *
   * @returns Active org context or `null` when none is set/resolvable.
   */
  async getActiveOrg(): Promise<ActiveOrgContext | null> {
    const userId = requireUserId();

    // 1) Load primary org preference
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("primary_org")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    const orgId = profile?.primary_org;
    if (!orgId) return null;

    // 2) Hydrate organization (RLS-enforced)
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .eq("id", orgId)
      .maybeSingle();

    // Org deleted or not visible
    if (orgError || !organization) {
      return null;
    }

    // 3) Attach membership (nullable by design)
    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id, user_id, role, joined_at")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) throw membershipError;

    return {
      organization,
      membership: membership ?? null,
      source: "profile.primary_org",
    };
  },

  /**
   * Sets the user's primary organization used as their default org context.
   *
   * Problem it solves:
   * - Updates the user's preferred org for routing and default dashboard selection.
   *
   * Conceptual tables:
   * - `profiles.primary_org`
   *
   * Allowed caller:
   * - Authenticated user; can only set their own profile fields (enforced by RLS).
   *
   * Implementation:
   * - Direct Supabase call (user-owned write under RLS).
   *
   * @param orgId - Organization ID to set as primary.
   * @returns Resolves when the primary org is persisted.
   */
  async setPrimaryOrg(orgId: string): Promise<void> {
    const userId = requireUserId();
    const { error } = await supabase
      .from("profiles")
      .update({ primary_org: orgId })
      .eq("id", userId);

    if (error) {
      throw error;
    }
    return;
  },

  /**
   * Lists organizations the current user belongs to, including their membership role.
   *
   * Problem it solves:
   * - Powers org switchers, dashboards, and capability computation.
   *
   * Conceptual tables:
   * - `org_members`
   * - `organizations`
   *
   * Allowed caller:
   * - Authenticated user; limited to memberships visible under RLS.
   *
   * Implementation:
   * - Direct Supabase call (read-only, user-scoped via RLS).
   *
   * @returns User's orgs paired with membership information.
   */
  async listUserOrganizations(): Promise<UserOrganizationSummary[]> {
    const userId = requireUserId();
    const { data, error } = await supabase
      .from("org_members")
      .select(`
        org_id,
        user_id,
        role,
        joined_at,
        organizations!inner (
          id,
          owner,
          slug,
          name,
          created_at,
          storage_limit_mb,
          bio,
          visibility,
          type
        )
      `)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return data.map((item) => {
      const org = Array.isArray(item.organizations)
        ? item.organizations[0]
        : item.organizations;

      if (!org) {
        throw new Error("Invariant violation: org_members row without organization");
      }

      return {
        organization: org,
        membership: {
          org_id: item.org_id,
          user_id: item.user_id,
          role: item.role,
          joined_at: item.joined_at,
        },
      };
    });
  },

  // ===========================================================================
  // Organization Metadata
  // ===========================================================================

  /**
   * Fetches an organization by ID.
   *
   * Problem it solves:
   * - Canonical org lookup for detail pages and server-backed validation.
   *
   * Conceptual tables:
   * - `organizations`
   *
   * Allowed caller:
   * - Authenticated user; access controlled by RLS (membership and/or visibility).
   *
   * Implementation:
   * - Direct Supabase call (read-only).
   *
   * @param orgId - Organization ID.
   * @returns Organization metadata.
   */
  async getOrg(orgId: string): Promise<Organization> {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .eq("id", orgId)
      .single();

    if (error) {
      throw error;
    }
    return data;
  },

  /**
   * Fetches an organization by slug.
   *
   * Problem it solves:
   * - URL-friendly organization lookup.
   *
   * Conceptual tables:
   * - `organizations`
   *
   * Allowed caller:
   * - Authenticated user; access controlled by RLS (membership and/or visibility).
   *
   * Implementation:
   * - Direct Supabase call (read-only).
   *
   * @param slug - Organization slug.
   * @returns Organization metadata.
   */
  async getOrgBySlug(slug: string): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .select("id, owner, slug, name, created_at, storage_limit_mb, bio, visibility, type")
      .eq("slug", slug)
      .single();

    if (error) {
      throw error;
    }
    return data;
  },

  /**
   * Applies a partial update to organization metadata.
   *
   * Problem it solves:
   * - Provides a single patch-style entry point for updating multiple org fields.
   *
   * Conceptual tables:
   * - `organizations`
   *
   * Allowed caller:
   * - Org owner/managers or platform admin; enforced server-side (RLS and/or Edge).
   *
   * Implementation:
   * - Direct Supabase call for simple owner-managed updates under RLS.
   * - Edge Function when the update requires additional validation, auditing, or side effects.
   *
   * @param orgId - Organization ID.
   * @param patch - Partial org fields to update (final implementation should validate allowed fields).
   * @returns Updated organization metadata.
   */
  async updateOrg(orgId: string, patch: OrgEditableFields): Promise<Organization> {
    // TODO: Make into edge function for security reasons
    const { data, error } = await supabase
      .from("organizations")
      .update(patch)
      .eq("id", orgId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  // ===========================================================================
  // Membership & Roles
  // ===========================================================================

  /**
   * Lists members of an organization, including their roles and minimal profile info.
   *
   * Problem it solves:
   * - Powers member management screens and role audits.
   *
   * Conceptual tables:
   * - `org_members`
   * - `profiles`
   *
   * Allowed caller:
   * - Org members with sufficient privileges or platform admin; enforced server-side (RLS/Edge).
   *
   * Implementation:
   * - Direct Supabase call (read-only) when RLS allows member lists.
   * - Edge Function if membership visibility or denormalization is privileged.
   *
   * @param orgId - Organization ID.
   * @returns Members with profile summaries.
   */
  async listMembers(orgId: string): Promise<OrgMember[]> {
    const { data, error } = await supabase
      .from("org_members")
      .select(`
        org_id,
        user_id,
        role,
        joined_at,
        profiles!inner (
          id,
          username,
          name,
          role
        )
      `)
      .eq("org_id", orgId);

    if (error) {
      throw error;
    }

    return data.map((item) => {
      const profile = Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles;

      if (!profile) {
        throw new Error("Invariant violation: org_members row without profile");
      }

      return {
        membership: {
          org_id: item.org_id,
          user_id: item.user_id,
          role: item.role,
          joined_at: item.joined_at,
        },
        profile: {
          id: profile.id,
          username: profile.username,
          name: profile.name,
          role: profile.role,
        },
      };
    });
  },

  /**
   * Fetches the current user's membership for a given organization.
   *
   * Problem it solves:
   * - Provides the role input for capability evaluation without duplicating logic across stores/components.
   *
   * Conceptual tables:
   * - `org_members`
   *
   * Allowed caller:
   * - Authenticated user; membership row visibility enforced by RLS.
   *
   * Implementation:
   * - Direct Supabase call (read-only, user-scoped via RLS).
   *
   * @param orgId - Organization ID.
   * @returns Membership record or `null` if the user is not a member.
   */
  async getMyMembership(orgId: string): Promise<OrgMembership | null> {
    const userId = requireUserId();

    const { data, error } = await supabase
      .from("org_members")
      .select("org_id, user_id, role, joined_at")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Send a request to join an organization.
   * 
   * Problem it solves:
   * - User-initiated join requests for organizations that require approval.
   * 
   * Conceptual tables:
   * - `org_join_requests`
   * 
   * Allowed caller:
   * - Authenticated user; can only create requests for themselves (enforced by RLS).
   * 
   * Implementation:
   * - Direct Supabase insert under RLS.
   * @param orgId - Organization ID.
   * @returns The created join request record.
   */
  async sendJoinRequest(orgId: string): Promise<OrgJoinRequest> {
    const userId = requireUserId();

    const { data, error } = await supabase
      .from("org_join_requests")
      .insert({ org_id: orgId, user_id: userId })
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Adds a user to an organization with a specific role.
   *
   * Problem it solves:
   * - Invites/admin-add flows that create membership rows with server-side enforcement.
   *
   * Conceptual tables:
   * - `org_members`
   *
   * Allowed caller:
   * - Org owner/managers or platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged write) preferred to enforce role rules, invitations, auditing, and notifications.
   * - Direct Supabase insert may be possible if RLS fully captures constraints.
   *
   * @param orgId - Organization ID.
   * @param userId - User/profile ID to add.
   * @param role - Role to assign.
   * @returns The created membership projection.
   */
  async addMember(orgId: string, userId: string, role: OrgRole): Promise<OrgMember> {
    const { data, error } = await supabase
      .from("org_members")
      .insert({ org_id: orgId, user_id: userId, role })
      .single();

    if (error) {
      throw error;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, name, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    return {
      membership: data,
      profile: profileData,
    };
  },

  /**
   * Removes a user from an organization.
   *
   * Problem it solves:
   * - Membership revocation and offboarding flows.
   *
   * Conceptual tables:
   * - `org_members`
   *
   * Allowed caller:
   * - Org owner/managers or platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged write) preferred to handle safeguards (cannot remove last owner, etc).
   * - Direct Supabase delete may be possible if policies and constraints are sufficient.
   *
   * @param orgId - Organization ID.
   * @param userId - User/profile ID to remove.
   * @returns Resolves when removal is complete.
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("org_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return;
  },

  /**
   * Changes a member's role within an organization.
   *
   * Problem it solves:
   * - Role management flows (promote/demote) with server-side validation.
   *
   * Conceptual tables:
   * - `org_members.role`
   *
   * Allowed caller:
   * - Org owner/managers or platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged write) preferred to enforce role hierarchy and invariants.
   *
   * @param orgId - Organization ID.
   * @param userId - User/profile ID whose role should change.
   * @param role - New role value.
   * @returns Updated member projection.
   */
  async changeMemberRole(orgId: string, userId: string, role: OrgRole): Promise<OrgMember> {
    const { data, error } = await supabase.functions.invoke(
      "change-member-role",
      {
        body: {
          orgId,
          userId,
          role,
        },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Transfers organization ownership to another user.
   *
   * Problem it solves:
   * - Owner succession and administrative handoff while maintaining membership invariants.
   *
   * Conceptual tables:
   * - `organizations.owner`
   * - `org_members` (ensure owner membership/role alignment)
   *
   * Allowed caller:
   * - Current org owner or platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, multi-table update).
   *
   * @param orgId - Organization ID.
   * @param newOwnerId - User/profile ID to become the new owner.
   * @returns Updated organization metadata.
   */
  async transferOwnership(orgId: string, newOwnerId: string): Promise<Organization> {
    const { data, error } = await supabase.functions.invoke(
      "transfer-ownership",
      {
        body: { orgId, newOwnerId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Removes the current user from an organization.
   *
   * Problem it solves:
   * - Self-service offboarding without requiring admin action.
   *
   * Conceptual tables:
   * - `org_members`
   * - (optional) `profiles.primary_org` if leaving the primary org requires clearing/updating it
   *
   * Allowed caller:
   * - Authenticated user; enforced server-side (cannot leave if invariants would break).
   *
   * Implementation:
   * - Edge Function preferred to handle edge cases (last owner, primary org reassignment).
   *
   * @param orgId - Organization ID to leave.
   * @returns Resolves when the membership is removed (or reassigned per policy).
   */
  async leaveOrg(orgId: string): Promise<void> {
    const { error } = await supabase.functions.invoke(
      "leave-organization",
      {
        body: { orgId },
      }
    );

    if (error) {
      throw error;
    }

    return;
  },

  // ===========================================================================
  // Organization Requests
  // ===========================================================================

  /**
   * Submits a request to create an organization (or otherwise request org provisioning).
   *
   * Problem it solves:
   * - Provides a structured intake path for organization provisioning with review workflows.
   *
   * Conceptual tables:
   * - `organization_requests` (insert)
   * - `profiles` (requester identity via auth)
   *
   * Allowed caller:
   * - Authenticated user; request creation is user-scoped and enforced server-side.
   *
   * Implementation:
   * - Direct Supabase insert under RLS OR Edge Function if additional validation/rate limits are required.
   *
   * @param payload - Request details (requested name/slug/type and optional message).
   * @returns The created request record.
   */
  async submitOrgRequest(payload: SubmitOrgRequestPayload): Promise<OrgRequest> {
    const userId = requireUserId();

    const { data, error } = await supabase
      .from("organization_requests")
      .insert({
        requester_id: userId,
        requested_name: payload.requested_name,
        requested_slug: payload.requested_slug,
        requested_type: payload.requested_type || null,
        message: payload.message || null,
      })
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Lists the current user's organization requests.
   *
   * Problem it solves:
   * - Allows users to track the status of their org provisioning requests.
   *
   * Conceptual tables:
   * - `organization_requests`
   *
   * Allowed caller:
   * - Authenticated user; user can only see their own requests (enforced by RLS).
   *
   * Implementation:
   * - Direct Supabase call (read-only, user-scoped via RLS).
   *
   * @returns Requests created by the current user.
   */
  async listMyOrgRequests(): Promise<OrgRequest[]> {
    const userId = requireUserId();

    const { data, error } = await supabase
      .from("organization_requests")
      .select(
        "id, requester_id, requested_name, requested_slug, requested_type, message, status, reviewed_by, reviewed_at, review_notes, organization_id, created_at, updated_at"
      )
      .eq("requester_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Fetches a single organization request by ID.
   *
   * Problem it solves:
   * - Supports request detail screens and deep links.
   *
   * Conceptual tables:
   * - `organization_requests`
   *
   * Allowed caller:
   * - Requester (for their own request) or platform admin; enforced server-side.
   *
   * Implementation:
   * - Direct Supabase call (read-only) when RLS distinguishes requester/admin access.
   *
   * @param requestId - Organization request ID.
   * @returns The request record.
   */
  async getOrgRequest(requestId: string): Promise<OrgRequest> {
    const { data, error } = await supabase
      .from("organization_requests")
      .select(
        "id, requester_id, requested_name, requested_slug, requested_type, message, status, reviewed_by, reviewed_at, review_notes, organization_id, created_at, updated_at"
      )
      .eq("id", requestId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Lists organization requests for admin review.
   *
   * Problem it solves:
   * - Enables platform review queues, triage, and status reporting.
   *
   * Conceptual tables:
   * - `organization_requests`
   * - (optional) `profiles` for requester/reviewer display
   *
   * Allowed caller:
   * - Platform admin/moderator; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, may bypass/extend RLS and support richer filtering).
   *
   * @param filters - Optional filters for queue management.
   * @returns Requests visible to admins, optionally denormalized.
   */
  async listOrgRequests(filters?: OrgRequestAdminFilters): Promise<OrgRequestAdminView[]> {
    const { data, error } = await supabase.functions.invoke(
      "list-organization-requests",
      {
        body: filters ?? {},
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Marks an organization request as approved (review step only).
   *
   * Problem it solves:
   * - Records admin decision separately from org creation/provisioning.
   *
   * Conceptual tables:
   * - `organization_requests.status`
   * - `organization_requests.reviewed_by`
   * - `organization_requests.reviewed_at`
   * - `organization_requests.review_notes` (optional)
   *
   * Allowed caller:
   * - Platform admin/moderator; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged review workflow).
   *
   * @param requestId - Organization request ID.
   * @returns Updated request record.
   */
  async approveOrgRequest(requestId: string): Promise<OrgRequestAdminView> {
    const { data, error } = await supabase.functions.invoke(
      "approve-organization-request",
      {
        body: { requestId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Rejects an organization request with optional notes.
   *
   * Problem it solves:
   * - Captures review outcomes and communicates rationale back to the requester.
   *
   * Conceptual tables:
   * - `organization_requests.status`
   * - `organization_requests.reviewed_by`
   * - `organization_requests.reviewed_at`
   * - `organization_requests.review_notes`
   *
   * Allowed caller:
   * - Platform admin/moderator; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged review workflow).
   *
   * @param requestId - Organization request ID.
   * @param notes - Optional rejection notes.
   * @returns Updated request record.
   */
  async rejectOrgRequest(requestId: string, notes?: string): Promise<OrgRequestAdminView> {
    const { data, error } = await supabase.functions.invoke(
      "reject-organization-request",
      {
        body: { requestId, notes: notes || null },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Marks an organization request as "contacted" (or equivalent outreach state).
   *
   * Problem it solves:
   * - Supports admin triage workflows that track outreach without final approval/rejection.
   *
   * Conceptual tables:
   * - `organization_requests.status`
   * - `organization_requests.reviewed_by` / `reviewed_at` (optional, depending on workflow)
   *
   * Allowed caller:
   * - Platform admin/moderator; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged workflow state transition).
   *
   * @param requestId - Organization request ID.
   * @returns Updated request record.
   */
  // async markRequestContacted(requestId: string): Promise<OrgRequestAdminView> {
  //   throw new Error("Not implemented");
  // },

  // ===========================================================================
  // Organization Creation & Approval (Edge-only)
  // ===========================================================================

  /**
   * Creates an organization record (privileged).
   *
   * Problem it solves:
   * - Provides a single provisioning endpoint for org creation that can also bootstrap membership and defaults.
   *
   * Conceptual tables:
   * - `organizations` (insert)
   * - `org_members` (optional insert for owner membership)
   * - `profiles.primary_org` (optional update for owner default org)
   *
   * Allowed caller:
   * - Platform admin or server-controlled automation; enforced in Edge Function.
   *
   * Implementation:
   * - Edge Function only (privileged, multi-table capable).
   *
   * @param payload - Organization creation payload.
   * @returns Newly created organization metadata.
   */
  async createOrg(payload: CreateOrgPayload): Promise<Organization> {
    const { data, error } = await supabase.functions.invoke(
      "create-organization",
      {
        body: payload,
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Approves an organization request and creates the organization it represents (atomic workflow).
   *
   * Problem it solves:
   * - Performs the "approve + provision" workflow in one server-authoritative operation.
   *
   * Conceptual tables:
   * - `organization_requests` (status transition + link `organization_id`)
   * - `organizations` (insert)
   * - `org_members` (bootstrap owner membership)
   * - `profiles.primary_org` (optional)
   *
   * Allowed caller:
   * - Platform admin/moderator; enforced in Edge Function.
   *
   * Implementation:
   * - Edge Function only (privileged, multi-table, transactional).
   *
   * @param requestId - Organization request ID to approve and provision.
   * @returns Newly created organization plus the updated request record.
   */
  async approveAndCreateOrg(requestId: string): Promise<ApproveAndCreateOrgResult> {
    const { data, error } = await supabase.functions.invoke(
      "approve-and-create-organization",
      {
        body: { requestId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Assigns (or reassigns) the owner of an organization.
   *
   * Problem it solves:
   * - Allows platform-level correction of ownership, migrations, or admin provisioning flows.
   *
   * Conceptual tables:
   * - `organizations.owner`
   * - `org_members` (ensure owner has appropriate membership/role)
   *
   * Allowed caller:
   * - Platform admin; enforced in Edge Function.
   *
   * Implementation:
   * - Edge Function only (privileged, multi-table).
   *
   * @param orgId - Organization ID.
   * @param userId - User/profile ID to assign as owner.
   * @returns Updated organization metadata.
   */
  async assignOwner(orgId: string, userId: string): Promise<Organization> {
    const { data, error } = await supabase.functions.invoke(
      "assign-organization-owner",
      {
        body: { orgId, userId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  // ===========================================================================
  // Storage & Capacity
  // ===========================================================================

  /**
   * Returns a usage snapshot of organization storage consumption.
   *
   * Problem it solves:
   * - Enables capacity-aware UI (remaining storage, warnings, upload gating).
   *
   * Conceptual tables:
   * - `media_assets.file_size_bytes` (aggregate sum scoped by `org_id`)
   *
   * Allowed caller:
   * - Org members (or anyone allowed by visibility policy) as enforced by RLS.
   *
   * Implementation:
   * - Direct Supabase call (read-only) if aggregation is exposed via view/RPC under RLS.
   * - Edge Function if aggregation requires privileged access or performance optimizations.
   *
   * @param orgId - Organization ID.
   * @returns Storage usage snapshot.
   */
  async getStorageUsage(orgId: string): Promise<OrgStorageUsage> {
    const { data, error } = await supabase
      .from("media_assets")
      .select("file_size_bytes")
      .eq("org_id", orgId);

    if (error) {
      throw error;
    }

    const usedBytes = data.reduce((sum, asset) => sum + (asset.file_size_bytes || 0), 0);

    return {
      org_id: orgId,
      used_bytes: usedBytes,
      calculated_at: new Date(),
    };
  },

  /**
   * Returns the configured storage limit for an organization.
   *
   * Problem it solves:
   * - Provides a single source of truth for capacity policy surfaces.
   *
   * Conceptual tables:
   * - `organizations.storage_limit_mb`
   *
   * Allowed caller:
   * - Org members (or anyone allowed by visibility policy) as enforced by RLS.
   *
   * Implementation:
   * - Direct Supabase call (read-only) to `organizations`.
   *
   * @param orgId - Organization ID.
   * @returns Storage limit.
   */
  async getStorageLimit(orgId: string): Promise<OrgStorageLimit> {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, storage_limit_mb")
      .eq("id", orgId)
      .single();

    if (error) {
      throw error;
    }

    return {
      org_id: data.id,
      limit_mb: data.storage_limit_mb,
    };
  },

  /**
   * Returns remaining storage for an organization.
   *
   * Problem it solves:
   * - Simplifies UI display of remaining capacity without duplicating calculations across the app.
   *
   * Conceptual tables:
   * - `organizations.storage_limit_mb`
   * - `media_assets.file_size_bytes` (aggregate)
   *
   * Allowed caller:
   * - Org members (or anyone allowed by visibility policy) as enforced by RLS.
   *
   * Implementation:
   * - Direct Supabase (read-only) OR Edge Function if aggregation/policy is centralized.
   *
   * @param orgId - Organization ID.
   * @returns Remaining storage snapshot (derived server-side).
   */
  async getRemainingStorage(orgId: string): Promise<OrgStorageRemaining> {
    const storageLimit = await this.getStorageLimit(orgId);
    const storageUsage = await this.getStorageUsage(orgId);

    const limitBytes = storageLimit.limit_mb * 1024 * 1024;
    const remainingBytes = limitBytes - storageUsage.used_bytes;

    return {
      org_id: orgId,
      used_bytes: storageUsage.used_bytes,
      limit_mb: storageLimit.limit_mb,
      remaining_bytes: remainingBytes,
      calculated_at: new Date(),
    };
  },

  /**
   * Indicates whether the organization is near its storage limit.
   *
   * Problem it solves:
   * - Allows the UI to show warnings or gate flows when nearing capacity thresholds.
   *
   * Conceptual tables:
   * - `organizations.storage_limit_mb`
   * - `media_assets.file_size_bytes` (aggregate)
   *
   * Allowed caller:
   * - Org members (or anyone allowed by visibility policy) as enforced by RLS.
   *
   * Implementation:
   * - Direct Supabase with threshold kept in service file.
   * - Edge Function preferred to keep threshold policy server-authoritative.
   *
   * @param orgId - Organization ID.
   * @returns `true` if near-limit per server-defined threshold.
   */
  async isNearStorageLimit(orgId: string): Promise<boolean> {
    // threshold percentage can be adjusted as needed
    const THRESHOLD_PERCENTAGE = 0.75;

    const storageLimit = await this.getStorageLimit(orgId);
    const storageUsage = await this.getStorageUsage(orgId);

    const limitBytes = storageLimit.limit_mb * 1024 * 1024;
    const usageRatio = storageUsage.used_bytes / limitBytes;

    return usageRatio >= THRESHOLD_PERCENTAGE;
  },

  /**
   * Checks whether an upload of a given size is allowed under the org's capacity policy.
   *
   * Problem it solves:
   * - Provides a preflight check for client upload flows without relying on client-side policy logic.
   *
   * Conceptual tables:
   * - `organizations.storage_limit_mb`
   * - `media_assets.file_size_bytes` (aggregate)
   * - (optional) Supabase Storage objects (out-of-band) depending on implementation
   *
   * Allowed caller:
   * - Org members allowed to upload; enforced server-side.
   *
   * Implementation:
   * - Edge Function preferred (policy + aggregation + potential reservation logic).
   *
   * @param orgId - Organization ID.
   * @param fileSizeBytes - Size of the file the client intends to upload.
   * @returns Eligibility result including optional remaining/limit context.
   */
  async canUpload(orgId: string, fileSizeBytes: number): Promise<UploadEligibility> {
    const { data, error } = await supabase.functions.invoke(
      "check-upload-eligibility",
      {
        body: { orgId, fileSizeBytes },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  // ===========================================================================
  // Org Activity & Health
  // ===========================================================================

  /**
   * Returns a high-level overview of an organization for dashboard surfaces.
   *
   * Problem it solves:
   * - Aggregates commonly needed org state into a single payload to minimize client orchestration.
   *
   * Conceptual tables:
   * - `organizations`
   * - `org_members`
   * - `media_assets`
   * - `jobs`
   *
   * Allowed caller:
   * - Org members; enforced server-side.
   *
   * Implementation:
   * - Edge Function preferred (multi-table aggregation).
   *
   * @param orgId - Organization ID.
   * @returns Dashboard-ready overview payload.
   */
  async getOrgOverview(orgId: string): Promise<OrgOverview> {
    const { data, error } = await supabase.functions.invoke(
      "get-organization-overview",
      {
        body: { orgId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns computed statistics for an organization.
   *
   * Problem it solves:
   * - Provides a consistent stats payload across dashboards and reporting views.
   *
   * Conceptual tables:
   * - `org_members` (member count)
   * - `media_assets` (upload count + storage bytes + last upload)
   * - `jobs` (job count + last job)
   *
   * Allowed caller:
   * - Org members; enforced server-side.
   *
   * Implementation:
   * - Edge Function preferred (aggregation), or Direct Supabase if exposed via views/materialized stats under RLS.
   *
   * @param orgId - Organization ID.
   * @returns Computed org stats.
   */
  async getOrgStats(orgId: string): Promise<OrgStats> {
    const { data, error } = await supabase.functions.invoke(
      "get-organization-stats",
      {
        body: { orgId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns a list of recent uploads for an organization.
   *
   * Problem it solves:
   * - Powers activity feeds and quick access to recently uploaded matches/media.
   *
   * Conceptual tables:
   * - `media_assets`
   *
   * Allowed caller:
   * - Org members; enforced server-side (RLS).
   *
   * Implementation:
   * - Direct Supabase call (read-only, org-scoped via RLS).
   *
   * @param orgId - Organization ID.
   * @returns Recent uploads ordered by creation time.
   */
  async getRecentUploads(orgId: string): Promise<OrgMediaAssetSummary[]> {
    const { data, error } = await supabase
      .from("media_assets")
      .select("id, org_id, uploader_id, bucket, storage_path, file_name, file_size_bytes, mime_type, duration_seconds, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns a summary of jobs for an organization.
   *
   * Problem it solves:
   * - Gives quick visibility into background processing workload and failures.
   *
   * Conceptual tables:
   * - `jobs`
   * - (optional) `compute_devices` for richer operational insights
   *
   * Allowed caller:
   * - Org members with appropriate privileges (or platform admin); enforced server-side.
   *
   * Implementation:
   * - Edge Function preferred for aggregation and privileged operational metadata.
   *
   * @param orgId - Organization ID.
   * @returns Aggregated job summary.
   */
  async getJobSummary(orgId: string): Promise<OrgJobSummary> {
    const { data, error } = await supabase.functions.invoke(
      "get-organization-job-summary",
      {
        body: { orgId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  // ===========================================================================
  // Admin / Platform Operations
  // ===========================================================================

  /**
   * Lists organizations for platform administration, optionally filtered.
   *
   * Problem it solves:
   * - Supports admin dashboards, reporting, and operational triage.
   *
   * Conceptual tables:
   * - `organizations`
   * - (optional) `org_members` (member counts)
   * - (optional) `media_assets` (storage usage)
   * - (optional) `jobs` (activity/health)
   *
   * Allowed caller:
   * - Platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, cross-org aggregation).
   *
   * @param filters - Optional admin filters for searching and pagination.
   * @returns Admin-oriented org list rows.
   */
  async listOrganizations(filters?: OrganizationAdminFilters): Promise<OrganizationAdminListItem[]> {
    const { data, error } = await supabase.functions.invoke(
      "list-organizations-admin",
      {
        body: filters ?? {},
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Computes and returns a health evaluation for a specific organization.
   *
   * Problem it solves:
   * - Enables proactive platform monitoring (capacity, errors, inactivity).
   *
   * Conceptual tables:
   * - `organizations`
   * - `media_assets`
   * - `jobs`
   * - (optional) `compute_devices`
   *
   * Allowed caller:
   * - Platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, cross-table aggregation and heuristics).
   *
   * @param orgId - Organization ID.
   * @returns Health payload with signals.
   */
  async getOrgHealth(orgId: string): Promise<OrgHealth> {
    const { data, error } = await supabase.functions.invoke(
      "get-organization-health",
      {
        body: { orgId },
      }
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns organizations that are near their configured storage limits.
   *
   * Problem it solves:
   * - Supports operational outreach and automated warnings for capacity management.
   *
   * Conceptual tables:
   * - `organizations.storage_limit_mb`
   * - `media_assets.file_size_bytes` (aggregate)
   *
   * Allowed caller:
   * - Platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, cross-org aggregation).
   *
   * @returns Orgs with computed utilization ratios.
   */
  async getOrgsNearLimits(): Promise<OrgNearLimit[]> {
    const { data, error } = await supabase.functions.invoke(
      "get-organizations-near-limits",
      {}
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns organizations created recently for admin review.
   *
   * Problem it solves:
   * - Supports onboarding workflows, audits, and operational visibility into new orgs.
   *
   * Conceptual tables:
   * - `organizations.created_at`
   *
   * Allowed caller:
   * - Platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, cross-org visibility).
   *
   * @returns Recently created organizations.
   */
  async getRecentlyCreatedOrgs(): Promise<OrganizationAdminListItem[]> {
    const { data, error } = await supabase.functions.invoke(
      "get-recently-created-organizations",
      {}
    );

    if (error) {
      throw error;
    }

    return data;
  },

  /**
   * Returns organizations considered inactive by platform-defined heuristics.
   *
   * Problem it solves:
   * - Supports cleanup, outreach, and capacity planning for dormant organizations.
   *
   * Conceptual tables:
   * - `organizations`
   * - `media_assets` (last upload time)
   * - `jobs` (last activity)
   *
   * Allowed caller:
   * - Platform admin; enforced server-side.
   *
   * Implementation:
   * - Edge Function (privileged, heuristic evaluation).
   *
   * @returns Organizations flagged as inactive.
   */
  async getInactiveOrgs(): Promise<OrganizationAdminListItem[]> {
    const { data, error } = await supabase.functions.invoke(
      "get-inactive-organizations",
      {}
    );

    if (error) {
      throw error;
    }

    return data;
  },
};
