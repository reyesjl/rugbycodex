<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { OrgRequestAdminView } from '@/modules/orgs/types';

interface Props {
  show: boolean;
  request: OrgRequestAdminView | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const handleClose = () => {
  emit('close');
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const typeLabel = (value: string | null | undefined) => {
  const normalized = (value || "").toLowerCase();
  if (normalized === "team" || normalized === "organization") return "TEAM";
  if (normalized === "personal" || normalized === "individual") return "PERSONAL";
  return "UNKNOWN";
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
</script>

<template>
  <TransitionRoot :show="show" as="template">
    <Dialog as="div" class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/75 backdrop-blur-sm" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-2xl transform overflow-hidden rounded-lg border border-white/20 bg-gray-900 text-left align-middle shadow-xl transition-all">
              <!-- Header -->
              <div class="flex items-start justify-between border-b border-white/10 px-6 py-4">
                <DialogTitle as="h3" class="text-lg font-semibold text-white">
                  Request Details
                </DialogTitle>
                <button
                  type="button"
                  class="text-white/40 transition hover:text-white/70"
                  @click="handleClose"
                >
                  <Icon icon="carbon:close" class="h-5 w-5" />
                </button>
              </div>

              <!-- Body -->
              <div v-if="request" class="px-6 py-4 space-y-6">
                <!-- Basic Info -->
                <div class="space-y-4">
                  <div class="flex items-start gap-3">
                    <div class="flex-1">
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Organization Name</div>
                      <div class="text-lg font-semibold text-white">{{ request.requested_name }}</div>
                    </div>
                    <span
                      class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                      :class="statusBadgeClass(request.status)"
                    >
                      {{ request.status }}
                    </span>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Type</div>
                      <div class="text-sm text-white/70">{{ typeLabel(request.requested_type) }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Requester</div>
                      <div class="text-sm text-white/70">{{ profileLabel(request.requester, request.requester_id) }}</div>
                    </div>
                  </div>

                  <div v-if="request.message">
                    <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Message</div>
                    <div class="text-sm text-white/70 whitespace-pre-line rounded border border-white/10 bg-white/5 p-3">
                      {{ request.message }}
                    </div>
                  </div>
                </div>

                <!-- Timestamps -->
                <div class="border-t border-white/10 pt-4">
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Requested At</div>
                      <div class="text-sm text-white/70">{{ formatDate(request.created_at) }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Updated At</div>
                      <div class="text-sm text-white/70">{{ formatDate(request.updated_at) }}</div>
                    </div>
                  </div>
                </div>

                <!-- Review Info -->
                <div v-if="request.status !== 'pending'" class="border-t border-white/10 pt-4 space-y-4">
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Reviewed At</div>
                      <div class="text-sm text-white/70">{{ formatDate(request.reviewed_at) }}</div>
                    </div>
                    <div>
                      <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Reviewed By</div>
                      <div class="text-sm text-white/70">{{ profileLabel(request.reviewer, request.reviewed_by) }}</div>
                    </div>
                  </div>

                  <div v-if="request.review_notes">
                    <div class="text-xs text-white/50 uppercase tracking-wider mb-1">Review Notes</div>
                    <div class="text-sm text-white/70 whitespace-pre-line rounded border border-white/10 bg-white/5 p-3">
                      {{ request.review_notes }}
                    </div>
                  </div>
                </div>

                <!-- Internal IDs -->
                <div class="border-t border-white/10 pt-4">
                  <div class="text-xs text-white/50 uppercase tracking-wider mb-2">Internal IDs</div>
                  <div class="grid gap-2 text-xs text-white/60">
                    <div class="flex justify-between">
                      <span class="text-white/40">Request ID:</span>
                      <span class="font-mono">{{ request.id }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-white/40">Requester ID:</span>
                      <span class="font-mono">{{ request.requester_id || "—" }}</span>
                    </div>
                    <div v-if="request.organization_id" class="flex justify-between">
                      <span class="text-white/40">Organization ID:</span>
                      <span class="font-mono">{{ request.organization_id }}</span>
                    </div>
                    <div v-if="request.reviewed_by" class="flex justify-between">
                      <span class="text-white/40">Reviewer ID:</span>
                      <span class="font-mono">{{ request.reviewed_by }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex items-center justify-end border-t border-white/10 px-6 py-4">
                <button
                  type="button"
                  class="rounded border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  @click="handleClose"
                >
                  Close
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
