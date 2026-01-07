<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { orgService } from "@/modules/orgs/services/orgServiceV2";
import { toast } from "@/lib/toast";
import type {
  OrgRequestAdminFilters,
  OrgRequestAdminView,
  OrganizationRequestStatus,
} from "@/modules/orgs/types";

type ActionState = "approve" | "reject";

const requests = ref<OrgRequestAdminView[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const statusFilter = ref<OrganizationRequestStatus | "all">("pending");
const search = ref("");
const actionById = ref<Record<string, ActionState>>({});
const rejectionNotes = ref<Record<string, string>>({});
const expandedById = ref<Record<string, boolean>>({});

const statusOptions: { value: OrganizationRequestStatus | "all"; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "contacted", label: "Contacted" },
  { value: "all", label: "All" },
];

const pendingCount = computed(
  () => requests.value.filter((request) => request.status === "pending").length
);

const reviewedCount = computed(
  () => requests.value.filter((request) => request.status !== "pending").length
);

const buildFilters = (): OrgRequestAdminFilters => {
  const filters: OrgRequestAdminFilters = {};
  const trimmedSearch = search.value.trim();
  if (statusFilter.value !== "all") {
    filters.status = statusFilter.value;
  }
  if (trimmedSearch) {
    filters.search = trimmedSearch;
  }
  return filters;
};

const loadRequests = async () => {
  loading.value = true;
  error.value = null;
  try {
    requests.value = await orgService.listOrgRequests(buildFilters());
    expandedById.value = {};
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load organization requests.";
    error.value = message;
    toast({
      variant: "error",
      message,
    });
  } finally {
    loading.value = false;
  }
};

const handleApprove = async (request: OrgRequestAdminView) => {
  if (request.status !== "pending") return;
  if (!window.confirm(`Approve request for ${request.requested_name}?`)) {
    return;
  }
  actionById.value[request.id] = "approve";
  try {
    await orgService.approveAndCreateOrg(request.id);
    toast({
      variant: "success",
      message: `Approved ${request.requested_name}.`,
    });
    await loadRequests();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to approve request.",
    });
  } finally {
    delete actionById.value[request.id];
  }
};

const handleReject = async (request: OrgRequestAdminView) => {
  if (request.status !== "pending") return;
  const notes = rejectionNotes.value[request.id]?.trim() || undefined;
  const confirmMessage = notes
    ? `Reject request for ${request.requested_name} with notes?`
    : `Reject request for ${request.requested_name}?`;
  if (!window.confirm(confirmMessage)) {
    return;
  }
  actionById.value[request.id] = "reject";
  try {
    await orgService.rejectOrgRequest(request.id, notes);
    toast({
      variant: "success",
      message: `Rejected ${request.requested_name}.`,
    });
    rejectionNotes.value[request.id] = "";
    await loadRequests();
  } catch (err) {
    toast({
      variant: "error",
      message: err instanceof Error ? err.message : "Failed to reject request.",
    });
  } finally {
    delete actionById.value[request.id];
  }
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatRelative = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return String(value);

  const diffSeconds = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (abs < 60) return rtf.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, "day");
  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, "week");
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, "month");
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, "year");
};

const typeLabel = (value: string | null | undefined) => {
  const normalized = (value || "").toLowerCase();
  if (normalized === "team" || normalized === "organization") return "TEAM";
  if (normalized === "personal" || normalized === "individual") return "PERSONAL";
  return "UNKNOWN";
};

const isExpanded = (id: string) => !!expandedById.value[id];
const toggleExpanded = (id: string) => {
  expandedById.value[id] = !expandedById.value[id];
};

const reviewedSummary = (request: OrgRequestAdminView) => {
  const when = request.reviewed_at ? formatRelative(request.reviewed_at) : null;
  const who = request.reviewed_by || request.reviewer ? profileLabel(request.reviewer, request.reviewed_by) : null;
  if (when && who) return `Reviewed ${when} by ${who}`;
  if (when) return `Reviewed ${when}`;
  if (who) return `Reviewed by ${who}`;
  return "Reviewed";
};

const profileLabel = (
  profile?: { id?: string | null; name?: string | null; username?: string | null } | null,
  fallbackId?: string | null
) => {
  const name = profile?.name?.trim() || profile?.username?.trim();
  if (name) return name;
  if (profile?.id) return `User ${profile.id.slice(0, 8)}...`;
  if (fallbackId) return `User ${fallbackId.slice(0, 8)}...`;
  return "Unknown";
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "pending":
      return "border-amber-400/40 bg-amber-400/15 text-amber-200";
    case "approved":
      return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
    case "rejected":
      return "border-rose-400/40 bg-rose-400/15 text-rose-200";
    case "contacted":
      return "border-sky-400/40 bg-sky-400/15 text-sky-200";
    default:
      return "border-white/20 bg-white/5 text-white/70";
  }
};

let refreshTimer: number | undefined;
const scheduleRefresh = () => {
  if (refreshTimer) window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    void loadRequests();
  }, 250);
};

watch([statusFilter, search], () => {
  scheduleRefresh();
});

onBeforeUnmount(() => {
  if (refreshTimer) window.clearTimeout(refreshTimer);
});

onMounted(() => {
  void loadRequests();
});
</script>

<template>
  <section class="container-lg space-y-6 py-5 text-white">
    <header class="space-y-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 class="text-3xl font-semibold">Organization Requests</h1>
          <p class="text-white/70">Review pending requests. Audit details are available per item.</p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1">
            <label
              class="text-[11px] uppercase tracking-[0.3em] text-white/50"
              for="status-filter"
            >
              Status
            </label>
            <select
              id="status-filter"
              v-model="statusFilter"
              class="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white outline-none"
              :disabled="loading"
            >
              <option v-for="option in statusOptions" :key="option.value" :value="option.value" class="bg-black">
                {{ option.label }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label
              class="text-[11px] uppercase tracking-[0.3em] text-white/50"
              for="search-requests"
            >
              Search
            </label>
            <input
              id="search-requests"
              v-model="search"
              type="text"
              placeholder="Search by name"
              class="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white outline-none"
              :disabled="loading"
              autocomplete="off"
            />
          </div>

          <button
            type="button"
            class="inline-flex items-center justify-center rounded border border-white/20 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 disabled:opacity-60"
            :disabled="loading"
            aria-label="Refresh"
            title="Refresh"
            @click="loadRequests"
          >
            <span class="sr-only">Refresh</span>
            <Icon icon="carbon:renew" width="18" height="18" />
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-4 text-xs uppercase tracking-[0.3em] text-white/40">
        <span>Total: {{ requests.length }}</span>
        <span>Pending: {{ pendingCount }}</span>
        <span v-if="reviewedCount">Reviewed: {{ reviewedCount }}</span>
      </div>
    </header>

    <div v-if="loading" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization requests...
    </div>

    <div v-else-if="error" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">Unable to load organization requests.</p>
      <p class="mt-2 text-sm text-white/80">{{ error }}</p>
    </div>

    <div
      v-else-if="requests.length === 0"
      class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70"
    >
      No organization requests match the current filters.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="request in requests"
        :key="request.id"
        class="rounded-lg border bg-white/5"
        :class="[
          request.status === 'pending'
            ? 'border-white/15'
            : 'border-white/10 opacity-80',
        ]"
      >
        <div
          class="flex items-start gap-4 px-5 py-4"
          :class="[
            request.status === 'pending'
              ? 'border-l-2 border-amber-300/60'
              : 'border-l-2 border-transparent',
          ]"
        >
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="truncate text-base font-semibold text-white">
                    {{ request.requested_name }}
                  </div>
                  <span
                    class="inline-flex rounded-full border border-white/20 bg-black/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/80"
                  >
                    {{ typeLabel(request.requested_type) }}
                  </span>
                </div>

                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span class="text-white/70">
                    {{ profileLabel(request.requester, request.requester_id) }}
                  </span>
                  <span class="text-white/35">•</span>
                  <span v-if="request.status === 'pending'">Requested {{ formatRelative(request.created_at) }}</span>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <span
                  class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  :class="statusBadgeClass(request.status)"
                >
                  {{ request.status }}
                </span>

                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20"
                  :aria-expanded="isExpanded(request.id) ? 'true' : 'false'"
                  :aria-controls="`org-request-details-${request.id}`"
                  @click="toggleExpanded(request.id)"
                >
                  <span>Details</span>
                  <Icon
                    icon="carbon:chevron-down"
                    width="16"
                    height="16"
                    class="transition-transform"
                    :class="[ isExpanded(request.id) ? 'rotate-180' : 'rotate-0' ]"
                  />
                </button>
              </div>
            </div>

            <p
              class="mt-3 truncate text-sm text-white/75"
              :title="request.message || ''"
            >
              {{ request.message || 'No message provided.' }}
            </p>

            <div v-if="request.status === 'pending'" class="mt-4 space-y-2">
              <textarea
                v-model="rejectionNotes[request.id]"
                rows="2"
                placeholder="Rejection notes (optional)"
                class="w-full rounded border border-white/20 bg-black/40 px-2 py-2 text-xs text-white outline-none focus:border-white/30"
                :disabled="!!actionById[request.id]"
              ></textarea>

              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded border border-emerald-400 bg-emerald-500/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  :disabled="!!actionById[request.id]"
                  @click="handleApprove(request)"
                >
                  <span v-if="actionById[request.id] === 'approve'">Approving...</span>
                  <span v-else>Approve</span>
                </button>
                <button
                  type="button"
                  class="rounded border border-rose-400 bg-rose-500/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-500 disabled:opacity-60"
                  :disabled="!!actionById[request.id]"
                  @click="handleReject(request)"
                >
                  <span v-if="actionById[request.id] === 'reject'">Rejecting...</span>
                  <span v-else>Reject</span>
                </button>
              </div>
            </div>
            <div v-else class="mt-4 text-xs text-white/45">
              {{ reviewedSummary(request) }}
            </div>
          </div>
        </div>

        <div
          v-if="isExpanded(request.id)"
          :id="`org-request-details-${request.id}`"
          class="border-t border-white/10 bg-black/20 px-5 py-4 text-sm text-white/70"
        >
          <div class="grid gap-3 md:grid-cols-2">
            <div>
              <div class="text-xs uppercase tracking-[0.25em] text-white/40">Requested</div>
              <div class="mt-1 text-white/75">{{ formatDate(request.created_at) }}</div>
            </div>

            <div>
              <div class="text-xs uppercase tracking-[0.25em] text-white/40">Reviewed</div>
              <div class="mt-1 text-white/75">{{ formatDate(request.reviewed_at) }}</div>
              <div v-if="request.reviewed_by || request.reviewer" class="mt-1 text-xs text-white/50">
                {{ profileLabel(request.reviewer, request.reviewed_by) }}
              </div>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-xs uppercase tracking-[0.25em] text-white/40">Review Notes</div>
            <p class="mt-1 whitespace-pre-line text-white/75">
              {{ request.review_notes || '—' }}
            </p>
          </div>

          <div class="mt-4">
            <div class="text-xs uppercase tracking-[0.25em] text-white/40">Internal IDs</div>
            <div class="mt-2 grid gap-2 text-xs text-white/60 md:grid-cols-2">
              <div><span class="text-white/40">Request:</span> {{ request.id }}</div>
              <div><span class="text-white/40">Requester:</span> {{ request.requester_id || '—' }}</div>
              <div><span class="text-white/40">Organization:</span> {{ request.organization_id || '—' }}</div>
              <div><span class="text-white/40">Reviewed By:</span> {{ request.reviewed_by || '—' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>

</style>
