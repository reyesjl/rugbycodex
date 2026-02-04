<script lang="ts" setup>
import { ref, watch } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { Icon } from '@iconify/vue';
import { toast } from "@/lib/toast";
import { useRoute, useRouter } from 'vue-router';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import type { OrganizationType } from '@/modules/orgs/types';

type OrgTypeOption = {
  value: OrganizationType;
  label: string;
};

const router = useRouter();
const route = useRoute();

const name = ref('');
const type = ref<OrganizationType>('team');
const message = ref('');
const loading = ref(false);
const errors = ref<Record<string, string>>({});

const organizationTypes: OrgTypeOption[] = [
  { value: 'team', label: 'Team' },
  { value: 'academy', label: 'Academy' },
  { value: 'personal', label: 'Personal' },
];

const selectedOrgType = ref<OrgTypeOption>(organizationTypes[0]!);

watch(selectedOrgType, (opt) => {
  type.value = opt.value;
});

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
            <label class="text-sm">Type<span class="text-red-400">*</span></label>
          </div>
          <div class="col-span-8">
            <Listbox v-model="selectedOrgType" :disabled="loading">
              <div class="relative">
                <ListboxButton class="relative w-full cursor-pointer rounded bg-white/10 border border-white/20 px-2 py-1 pr-10 text-left text-sm focus:border-white outline-none disabled:opacity-50">
                  <span class="block truncate">{{ selectedOrgType.label }}</span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <Icon icon="carbon:chevron-down" class="h-4 w-4 text-white/40" />
                  </span>
                </ListboxButton>
                
                <transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/20 py-1 text-sm shadow-lg focus:outline-none">
                    <ListboxOption
                      v-for="opt in organizationTypes"
                      :key="opt.value"
                      :value="opt"
                      as="template"
                      v-slot="{ active, selected }"
                    >
                      <li
                        class="relative cursor-pointer select-none py-2 pl-3 pr-9"
                        :class="active ? 'bg-white/10 text-white' : 'text-white/70'"
                      >
                        <span :class="selected ? 'font-semibold' : 'font-normal'" class="block truncate">
                          {{ opt.label }}
                        </span>
                        <span v-if="selected" class="absolute inset-y-0 right-0 flex items-center pr-3 text-green-500">
                          <Icon icon="carbon:checkmark" class="h-4 w-4" />
                        </span>
                      </li>
                    </ListboxOption>
                  </ListboxOptions>
                </transition>
              </div>
            </Listbox>
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
