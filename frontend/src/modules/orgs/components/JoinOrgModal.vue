<script lang="ts" setup>
import { ref } from 'vue';
import { toast } from "@/lib/toast";
import { useRouter } from 'vue-router';
import { orgService } from '@/modules/orgs/services/orgServiceV2';
import { useUserContextStore } from '@/modules/user/stores/useUserContextStore';

const emit = defineEmits(['close']);
const router = useRouter();
const userContextStore = useUserContextStore();

const code = ref('');
const loading = ref(false);
const error = ref<string | null>(null);


const submit = async () => {
    if (!code.value.trim()) {
        error.value = "Please enter a join code.";
        return;
    }

    loading.value = true;
    error.value = null;
    try {
        const result = await orgService.joinWithCode(code.value);

        // Ensure user context is up to date
        await userContextStore.reload();

        toast({
            variant: result.status === "already_member" ? "info" : "success",
            message:
                result.status === "already_member"
                    ? "You are already a member."
                    : "Joined organization.",
            durationMs: 3000,
        });
        
        emit('close');

        if (result.status === "joined") {
            router.push(`/organizations/${result.org.slug}`);
        }
    } catch (err) {
        // Simple error handling: service layer has already normalized the message
        error.value = err instanceof Error ? err.message : "Failed to join organization.";
    } finally {
        loading.value = false;
    }
}
</script>
<template>
    <Teleport to="body">
        <div class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            @click.self="emit('close')">
            <div class="bg-black border border-white/20 rounded w-full max-w-xl text-white">
                <!-- Header -->
                <header class="p-4 border-b border-b-white/20">
                    <h2>Join organization</h2>
                    <p class="text-sm text-gray-400">Enter the code provided by your organization to join.</p>
                </header>

                <!-- input section -->
                <div class="p-4">
                    <div class="flex flex-col gap-2 md:grid md:grid-cols-12">
                        <div class="col-span-4">
                            <label class="text-sm" for="code">Code</label>
                        </div>
                        <div class="col-span-8">
                            <input v-model="code"
                                class="text-sm w-full rounded bg-white/10 border border-white/20 px-2 py-1 focus:border-white outline-none"
                                placeholder="Enter join code" />
                            <p v-if="error" class="text-xs text-red-400 mt-3">{{ error }}</p>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between p-4 border-t border-t-white/20">
                    <!-- submit and cancel buttons -->
                    <button @click="emit('close')"
                        class="px-2 py-1 text-xs rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition">
                        Cancel
                    </button>
                    <button @click="submit" :disabled="loading"
                        class="px-2 py-1 text-xs rounded-lg border border-green-500 bg-green-500/70 hover:bg-green-700/70 transition disabled:opacity-50">
                        <span v-if="loading">Joining...</span>
                        <span v-else>Submit</span>
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>
<style scoped></style>
