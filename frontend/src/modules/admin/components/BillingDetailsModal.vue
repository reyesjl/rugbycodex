<script setup lang="ts">
import { TransitionRoot, TransitionChild, Dialog, DialogPanel, DialogTitle } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import type { BillingItem } from '@/modules/admin/types/BillingItem';

interface Props {
  show: boolean;
  billing: BillingItem | null;
}

interface Emits {
  (e: 'close'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function getCurrentMonthLabel(): string {
  const now = new Date();
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(now);
}
</script>

<template>
  <TransitionRoot appear :show="show" as="template">
    <Dialog as="div" @close="emit('close')" class="relative z-70">
      <!-- Backdrop -->
      <TransitionChild
        as="template"
        enter="duration-300 ease-out"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="duration-200 ease-in"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      </TransitionChild>

      <!-- Dialog positioning -->
      <div class="fixed inset-0 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <!-- Dialog panel -->
          <TransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-2xl transform overflow-hidden rounded-lg bg-black border border-white/20 text-white shadow-xl transition-all">
              <!-- Header -->
              <header class="flex items-center justify-between p-6 border-b border-white/20">
                <div>
                  <DialogTitle as="h2" class="text-xl font-semibold">
                    {{ billing?.organization.name }}
                  </DialogTitle>
                  <p class="text-sm text-white/60 mt-1">Billing Details</p>
                </div>
                <button
                  @click="emit('close')"
                  class="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white transition"
                >
                  <Icon icon="carbon:close" class="h-5 w-5" />
                </button>
              </header>

              <!-- Body -->
              <div v-if="billing" class="p-6 space-y-6">
                <!-- Revenue Info -->
                <div class="rounded-lg border border-white/10 bg-white/5 p-4">
                  <h3 class="text-sm font-medium text-white/60 mb-3">Revenue</h3>
                  <div class="text-3xl font-bold text-green-400">
                    {{ formatCurrency(billing.monthly_revenue) }}<span class="text-base text-white/60">/month</span>
                  </div>
                </div>

                <!-- Usage Stats -->
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-medium text-white/60">Usage Statistics</h3>
                    <span class="text-xs text-white/40">{{ getCurrentMonthLabel() }}</span>
                  </div>
                  
                  <div class="grid grid-cols-2 gap-3">
                    <!-- Members -->
                    <div class="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div class="flex items-center gap-2 text-white/60 text-sm mb-1">
                        <Icon icon="carbon:user-multiple" class="h-4 w-4" />
                        <span>Members</span>
                      </div>
                      <div class="text-2xl font-semibold">{{ billing.member_count }}</div>
                    </div>

                    <!-- Narrations -->
                    <div class="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div class="flex items-center gap-2 text-white/60 text-sm mb-1">
                        <Icon icon="carbon:microphone" class="h-4 w-4" />
                        <span>Narrations</span>
                      </div>
                      <div v-if="billing.loading_narrations" class="flex items-center gap-2">
                        <div class="animate-pulse bg-white/20 rounded h-7 w-16"></div>
                        <Icon icon="carbon:renew" class="h-4 w-4 text-white/40 animate-spin" />
                      </div>
                      <div v-else-if="billing.narration_error" class="text-red-400">
                        <div class="text-sm">Error loading</div>
                        <div class="text-xs text-red-400/60 mt-1">{{ billing.narration_error }}</div>
                      </div>
                      <div v-else>
                        <div class="text-2xl font-semibold">{{ billing.narration_count || 0 }}</div>
                        <div class="text-xs text-white/40 mt-1">
                          ~{{ ((billing.narration_count || 0) * 2).toLocaleString() }} OpenAI API calls
                        </div>
                      </div>
                    </div>

                    <!-- Storage -->
                    <div class="rounded-lg border border-white/10 bg-white/5 p-4 col-span-2">
                      <div class="flex items-center gap-2 text-white/60 text-sm mb-1">
                        <Icon icon="carbon:db2-database" class="h-4 w-4" />
                        <span>Storage Used</span>
                      </div>
                      <div class="text-2xl font-semibold">{{ formatBytes(billing.storage_used_bytes) }}</div>
                      <div class="text-xs text-white/40 mt-1">
                        Limit: {{ billing.organization.storage_limit_mb || 0 }} MB
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Organization Info -->
                <div class="space-y-3">
                  <h3 class="text-sm font-medium text-white/60">Organization Details</h3>
                  
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-white/60">Slug</span>
                      <span class="font-mono">{{ billing.organization.slug }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-white/60">Type</span>
                      <span class="capitalize">{{ billing.organization.type }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-white/60">Visibility</span>
                      <span class="capitalize">{{ billing.organization.visibility }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-white/60">Created</span>
                      <span>{{ formatDate(billing.organization.created_at) }}</span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-white/60">Last Activity</span>
                      <span>{{ formatDate(billing.last_activity_at) }}</span>
                    </div>
                  </div>
                </div>

                <!-- API Cost Breakdown -->
                <div class="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                  <div class="flex items-start gap-2">
                    <Icon icon="carbon:information" class="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div class="text-sm">
                      <p class="text-blue-400 font-medium mb-1">OpenAI API Usage</p>
                      <p class="text-white/70">
                        Each narration generates <strong>2 OpenAI API calls</strong>: 
                        1 Whisper call for transcription and 1 embedding call for search indexing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-end p-6 border-t border-white/20">
                <button
                  @click="emit('close')"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition"
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

<style scoped>
/* intentionally empty */
</style>
