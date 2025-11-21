<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { stringToSlugCase } from '@/lib';
import CustomSelect from '@/components/CustomSelect.vue';
import { orgService } from '@/modules/orgs/services/orgService';
import { type CreateOrganizationInput } from '@/modules/orgs/types';

const router = useRouter();
const orgName = ref('');
const orgSlug = ref('');
const ownerId = ref('');
const storageSize = ref(10);

const isCreating = ref(false);
const createError = ref<string | null>(null);
const createSuccess = ref(false);

// Listen to org name changes
watch(orgName, (newName) => {
  orgSlug.value = stringToSlugCase(newName);
});

// Validate slug format
const slugError = computed(() => {
  if (!orgSlug.value) return null;

  if (/\s/.test(orgSlug.value)) {
    return 'Slug cannot contain spaces';
  }

  if (orgSlug.value !== orgSlug.value.toLowerCase()) {
    return 'Slug must be lowercase';
  }

  if (!/^[a-z0-9-]*$/.test(orgSlug.value)) {
    return 'Slug can only contain lowercase letters, numbers, and hyphens';
  }

  return null;
});

const handleCreateOrg = async () => {
  if (!orgName.value.trim() || !orgSlug.value.trim()) {
    createError.value = 'Name and Slug are required.';
    return;
  }

  if (slugError.value) {
    createError.value = slugError.value;
    return;
  }

  isCreating.value = true;
  createError.value = null;
  createSuccess.value = false;

  try {
    await orgService.organizations.create({
      name: orgName.value,
      slug: orgSlug.value,
      owner: ownerId.value || null,
      storage_limit_mb: storageSize.value * 1024
    } as CreateOrganizationInput);

    createSuccess.value = true;

    // Reset form
    orgName.value = '';
    orgSlug.value = '';
    ownerId.value = '';
    storageSize.value = 10;

    setTimeout(() => {
      router.push({ name: 'AdminListOrgs' });
    }, 500);
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Failed to create organization.';
  } finally {
    isCreating.value = false;
  }
};

const storageSizeOptions = [
  { value: 5, label: '5 GB' },
  { value: 10, label: '10 GB' },
  { value: 20, label: '20 GB' }
];
</script>

<template>
  <section class="container flex min-h-screen flex-col gap-16 ">
    <section
      class="rounded-3xl bg-neutral-100/80 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.1)] backdrop-blur dark:bg-neutral-900/70 dark:shadow-[0_40px_80px_rgba(15,23,42,0.35)]">
      <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Organization Details</h2>

      <form @submit.prevent="handleCreateOrg" class="mt-6 space-y-6">
        <div>
          <label for="orgName" class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Organization Name
          </label>
          <input id="orgName" v-model="orgName" type="text"
            class="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20"
            placeholder="Enter organization name" />
        </div>

        <div>
          <label for="orgSlug" class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Organization Slug
          </label>
          <input id="orgSlug" v-model="orgSlug" type="text" :class="[
            'mt-2 w-full rounded-xl border px-4 py-3 transition focus:outline-none focus:ring-2',
            slugError
              ? 'border-rose-500 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500 dark:bg-rose-950/30 dark:text-rose-100 dark:focus:border-rose-500 dark:focus:ring-rose-500/20'
              : 'border-neutral-300 bg-white text-neutral-900 focus:border-neutral-900 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20'
          ]" placeholder="Enter organization slug (e.g., my-org)" />
          <p v-if="slugError" class="mt-2 text-sm text-rose-600 dark:text-rose-400">{{ slugError }}</p>
        </div>

        <div>
          <label for="ownerId" class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Owner ID
          </label>
          <input id="ownerId" v-model="ownerId" type="text"
            class="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-900 transition focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:focus:border-neutral-100 dark:focus:ring-neutral-100/20"
            placeholder="Enter owner user ID" />
        </div>

        <div>
          <label for="storageSize" class="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Storage Size
          </label>
          <CustomSelect v-model="storageSize" :options="storageSizeOptions" placeholder="Select storage size" />
        </div>

        <div v-if="createError" class="rounded-xl bg-rose-50 p-4 dark:bg-rose-950/30">
          <p class="text-sm text-rose-600 dark:text-rose-400">{{ createError }}</p>
        </div>

        <div v-if="createSuccess" class="rounded-xl bg-green-50 p-4 dark:bg-green-950/30">
          <p class="text-sm text-green-600 dark:text-green-400">Organization created successfully! Redirecting...</p>
        </div>

        <div class="flex gap-3">
          <button type="submit" :disabled="isCreating"
            class="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-100 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200">
            <span v-if="isCreating"
              class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-200 border-t-transparent dark:border-neutral-700"></span>
            <span>{{ isCreating ? 'Creating...' : 'Create Organization' }}</span>
          </button>

          <RouterLink to="/dashboard"
            class="inline-flex items-center gap-2 rounded-2xl border border-neutral-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-neutral-900 hover:text-neutral-100 dark:border-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900">
            Cancel
          </RouterLink>
        </div>
      </form>
    </section>
  </section>
</template>
