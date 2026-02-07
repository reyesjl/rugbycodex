<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
  RadioGroup,
  RadioGroupOption,
} from '@headlessui/vue';
import { Icon } from '@iconify/vue';

interface Props {
  show: boolean;
  userName: string;
  currentRole: 'user' | 'admin';
  loading?: boolean;
  isSelf?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  confirm: [newRole: 'user' | 'admin'];
}>();

const selectedRole = ref<'user' | 'admin'>('user');

watch(() => props.show, (newShow) => {
  if (newShow) {
    selectedRole.value = props.currentRole;
  }
});

const handleClose = () => {
  if (props.loading) return;
  emit('close');
};

const handleConfirm = () => {
  emit('confirm', selectedRole.value);
};

const roleChanged = () => selectedRole.value !== props.currentRole;
</script>

<template>
  <TransitionRoot :show="show" as="template">
    <Dialog as="div" class="relative z-70" @close="handleClose">
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
            <DialogPanel class="bg-black border border-white/20 rounded-lg w-full max-w-md text-white my-8">
              <!-- Header -->
              <header class="p-4 border-b border-b-white/20">
                <DialogTitle as="h2" class="text-lg font-semibold">
                  Edit User Role
                </DialogTitle>
              </header>

              <!-- Body -->
              <div class="p-4 space-y-4">
                <div class="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div class="text-xs text-white/50 uppercase tracking-wider mb-1">User</div>
                  <div class="text-sm font-semibold text-white">{{ userName }}</div>
                </div>

                <!-- Self-edit warning -->
                <div v-if="isSelf" class="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
                  <div class="flex items-start gap-2">
                    <Icon icon="carbon:warning" class="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div class="text-sm text-amber-200">
                      You cannot change your own role for security reasons.
                    </div>
                  </div>
                </div>

                <!-- Role selector -->
                <div>
                  <label class="block text-sm font-medium text-white/70 mb-2">
                    Select Role
                  </label>
                  <RadioGroup v-model="selectedRole" :disabled="loading || isSelf">
                    <div class="space-y-2">
                      <RadioGroupOption
                        value="user"
                        v-slot="{ checked }"
                        as="template"
                      >
                        <div
                          class="relative rounded border px-3 py-2 cursor-pointer transition"
                          :class="[
                            checked 
                              ? 'border-blue-400 bg-blue-500/10' 
                              : 'border-white/20 bg-white/10 hover:bg-white/15',
                            (loading || isSelf) && 'opacity-50 cursor-not-allowed'
                          ]"
                        >
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                              <div
                                class="flex items-center justify-center w-5 h-5 rounded-full border-2 transition"
                                :class="checked ? 'border-blue-400 bg-blue-400' : 'border-white/40'"
                              >
                                <div v-if="checked" class="w-2 h-2 rounded-full bg-white"></div>
                              </div>
                              <div>
                                <div class="text-sm font-semibold text-white">User</div>
                                <div class="text-xs text-white/60">Standard platform access</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </RadioGroupOption>

                      <RadioGroupOption
                        value="admin"
                        v-slot="{ checked }"
                        as="template"
                      >
                        <div
                          class="relative rounded border px-3 py-2 cursor-pointer transition"
                          :class="[
                            checked 
                              ? 'border-purple-400 bg-purple-500/10' 
                              : 'border-white/20 bg-white/10 hover:bg-white/15',
                            (loading || isSelf) && 'opacity-50 cursor-not-allowed'
                          ]"
                        >
                          <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                              <div
                                class="flex items-center justify-center w-5 h-5 rounded-full border-2 transition"
                                :class="checked ? 'border-purple-400 bg-purple-400' : 'border-white/40'"
                              >
                                <div v-if="checked" class="w-2 h-2 rounded-full bg-white"></div>
                              </div>
                              <div>
                                <div class="flex items-center gap-2">
                                  <div class="text-sm font-semibold text-white">Admin</div>
                                  <Icon icon="carbon:user-admin" class="h-4 w-4 text-purple-400" />
                                </div>
                                <div class="text-xs text-white/60">Full platform access</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </RadioGroupOption>
                    </div>
                  </RadioGroup>
                </div>

                <!-- Warning for role promotion -->
                <div v-if="roleChanged() && selectedRole === 'admin'" class="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
                  <div class="flex items-start gap-2">
                    <Icon icon="carbon:warning" class="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div class="text-sm text-amber-200">
                      This will grant full platform admin access. The user will be able to manage all organizations, users, and system settings.
                    </div>
                  </div>
                </div>

                <!-- Warning for role demotion -->
                <div v-if="roleChanged() && selectedRole === 'user'" class="rounded-lg border border-rose-400/40 bg-rose-500/10 p-4">
                  <div class="flex items-start gap-2">
                    <Icon icon="carbon:warning" class="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                    <div class="text-sm text-rose-200">
                      This will revoke admin privileges. The user will lose access to admin features.
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex justify-between p-4 border-t border-t-white/20">
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                  @click="handleClose"
                  :disabled="loading"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="px-4 py-2 text-sm rounded-lg border border-blue-500 bg-blue-500/70 hover:bg-blue-700/70 transition disabled:opacity-50"
                  @click="handleConfirm"
                  :disabled="loading || !roleChanged() || isSelf"
                >
                  <span v-if="loading">Saving...</span>
                  <span v-else>Save</span>
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
