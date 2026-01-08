<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { formatMonthYear } from '@/lib/date';
import { useActiveOrganizationStore } from '../stores/useActiveOrganizationStore';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { orgService } from '../services/orgServiceV2';
import { toast } from '@/lib/toast';

const authStore = useAuthStore();
const activeOrganizationStore = useActiveOrganizationStore();
const { orgContext, resolving, memberCount } = storeToRefs(activeOrganizationStore);

const org = computed(() => orgContext.value?.organization ?? null);

const canManage = computed(() => {
  if (authStore.isAdmin) return true;
  const role = activeOrganizationStore.orgContext?.membership?.role;
  return role === 'owner' || role === 'manager' || role === 'staff';
});

const BIO_MAX_LENGTH = 500;

const isEditingBio = ref(false);
const bioEditValue = ref('');
const isSavingBio = ref(false);

const bioCharCount = computed(() => bioEditValue.value.length);
const isBioOverLimit = computed(() => bioCharCount.value > BIO_MAX_LENGTH);

const startEditingBio = () => {
  if (!org.value) return;
  bioEditValue.value = org.value.bio ?? '';
  isEditingBio.value = true;
};

const cancelEditingBio = () => {
  isEditingBio.value = false;
  bioEditValue.value = '';
};

const saveBio = async () => {
  if (!org.value) return;
  
  if (isBioOverLimit.value) {
    toast({ 
      message: `Bio cannot exceed ${BIO_MAX_LENGTH} characters`, 
      variant: 'error' 
    });
    return;
  }
  
  isSavingBio.value = true;
  try {
    const updated = await orgService.updateOrg(org.value.id, {
      bio: bioEditValue.value.trim() || null,
    });
    
    // Update the local store
    if (orgContext.value) {
      orgContext.value.organization.bio = updated.bio;
    }
    
    toast({ message: 'Bio updated successfully', variant: 'success' });
    isEditingBio.value = false;
  } catch (error) {
    toast({ 
      message: error instanceof Error ? error.message : 'Failed to update bio', 
      variant: 'error' 
    });
  } finally {
    isSavingBio.value = false;
  }
};

const badgeClass =
  'rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/50';

</script>

<template>
  <section class="container pt-6 text-white">
    <div v-if="resolving" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Loading organization…
    </div>

    <div v-else-if="!org" class="rounded-lg border border-white/10 bg-white/5 p-6 text-white/70">
      Organization unavailable.
    </div>

    <div v-else class="space-y-4">
      <header class="space-y-2">
        <div class="flex flex-col gap-2 md:flex-row md:items-center">
          <h1 class="text-3xl">{{ org.name }}</h1>
          <div class="flex flex-wrap gap-2">
            <span :class="badgeClass">{{ org.visibility ?? 'unknown' }}</span>
          </div>
        </div>

        <div class="flex">
          <div class="text-xs text-gray-500">Circa {{ formatMonthYear(org.created_at) ?? 'Unknown' }} • {{ memberCount }} members</div>
        </div>

        <div v-if="!isEditingBio" class="max-w-2xl">
          <div class="flex items-start gap-2">
            <p class="text-white/70 flex-1">
              {{ org.bio && org.bio.trim().length ? org.bio : 'No bio yet.' }}
            </p>
            <button
              v-if="canManage"
              @click="startEditingBio"
              class="shrink-0 cursor-pointer rounded p-1 hover:bg-white/10 transition-colors"
              title="Edit bio"
            >
              <Icon icon="carbon:edit" class="h-4 w-4 text-white/50 hover:text-white/70" />
            </button>
          </div>
        </div>

        <div v-else class="max-w-2xl space-y-2">
          <div class="relative">
            <textarea
              v-model="bioEditValue"
              class="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 pb-7 text-white placeholder-white/30 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
              :class="{ 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20': isBioOverLimit }"
              rows="3"
              placeholder="Enter organization bio..."
              :disabled="isSavingBio"
            />
            <div 
              class="absolute bottom-2 right-2 text-xs pointer-events-none px-2 py-0.5 rounded bg-black/60"
              :class="isBioOverLimit ? 'text-red-400' : 'text-white/60'"
            >
              {{ bioCharCount }} / {{ BIO_MAX_LENGTH }}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              @click="saveBio"
              :disabled="isSavingBio || isBioOverLimit"
              class="flex gap-2 items-center rounded-lg px-2 py-1 text-black border border-white bg-white hover:bg-white/90 cursor-pointer text-xs transition disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              {{ isSavingBio ? 'Saving...' : 'Save' }}
            </button>
            <button
              @click="cancelEditingBio"
              :disabled="isSavingBio"
              class="flex gap-2 items-center rounded-lg px-2 py-1 text-white border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer text-xs transition disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              Cancel
            </button>
          </div>
        </div>

      </header>
    </div>
  </section>
</template>
