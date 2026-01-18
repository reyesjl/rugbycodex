<script lang="ts" setup>
import { ref } from 'vue';
import { toast } from "@/lib/toast";
import { useRoute, useRouter } from 'vue-router';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrganizationType } from '@/modules/orgs/types';

const router = useRouter();
const route = useRoute();

const name = ref('');
const type = ref<OrganizationType>('team');
const message = ref('');
const loading = ref(false);
const errors = ref<Record<string, string>>({});

const organizationTypes: { value: OrganizationType; label: string }[] = [
  { value: 'team', label: 'Team' },
  { value: 'academy', label: 'Academy' },
  { value: 'personal', label: 'Personal' },
];

const validateForm = (): boolean => {
  errors.value = {};

  if (!name.value.trim()) {
    errors.value.name = 'Organization name is required.';
  }

  return Object.keys(errors.value).length === 0;
};

const submit = async () => {
  if (!validateForm()) {
    return;
  }

  loading.value = true;
  try {
    await orgService.submitOrgRequest({
      requested_name: name.value.trim(),
      requested_type: type.value,
      message: message.value.trim() || null,
    });

    toast({
      variant: 'success',
      message: 'Organization request submitted successfully. We\'ll review it shortly.',
      durationMs: 3000,
    });

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
    if (redirect) {
      // Prefer explicit return location when the user entered from onboarding or another page.
      router.push(redirect);
    } else {
      router.back();
    }
  } catch (err) {
    console.error('Failed to submit org request:', err);
    toast({
      variant: 'error',
      message: err instanceof Error ? err.message : 'Failed to submit organization request.',
      durationMs: 3000,
    });
  } finally {
    loading.value = false;
  }
};

const cancel = () => {
  // router back
  router.back();
};
</script>

<template>
  <div class="min-h-screen bg-black text-white p-4">
    <div class="max-w-2xl mx-auto py-8">
      <!-- Header -->
      <header class="mb-6">
        <h2 class="text-xl">Create Organization</h2>
        <p class="text-sm text-gray-400">
          Request a new organization workspace. Admins will review your request.
        </p>
      </header>

      <!-- Form -->
      <div class="space-y-4">
        <!-- Organization Name -->
        <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
          <div class="col-span-4">
            <label class="text-sm" for="name">Name<span class="text-red-400">*</span></label>
          </div>
          <div class="col-span-8">
            <input v-model="name" id="name" type="text"
              class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
              placeholder="My Rugby Team" :disabled="loading" />
            <p v-if="errors.name" class="text-xs text-red-400 mt-1">{{ errors.name }}</p>
          </div>
        </div>

        <!-- Organization Type -->
        <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
          <div class="col-span-4">
            <label class="text-sm" for="type">Type<span class="text-red-400">*</span></label>
          </div>
          <div class="col-span-8">
            <select v-model="type" id="type"
              class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
              :disabled="loading">
              <option v-for="opt in organizationTypes" :key="opt.value" :value="opt.value" class="bg-black text-white">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Message -->
        <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
          <div class="col-span-4">
            <label class="text-sm" for="message">Message</label>
          </div>
          <div class="col-span-8">
            <textarea v-model="message" id="message" rows="3"
              class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none resize-none"
              placeholder="Optional: Tell us about your organization..." :disabled="loading"></textarea>
            <p class="text-xs text-gray-400 mt-1">
              Optional context for admins reviewing your request
            </p>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-between mt-6 pt-4 border-t border-t-white/20">
        <button @click="cancel" :disabled="loading"
          class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50">
          Cancel
        </button>
        <button @click="submit" :disabled="loading"
          class="px-2 py-1 text-xs rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition disabled:opacity-50">
          <span v-if="loading">Submitting...</span>
          <span v-else>Submit Request</span>
        </button>
      </div>
    </div>
  </div>
</template>
