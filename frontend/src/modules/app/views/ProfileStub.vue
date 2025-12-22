<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useAuthStore } from '@/auth/stores/useAuthStore';
import { profileService } from '@/modules/profiles/services/ProfileService';
import type { ProfileDetail } from '@/modules/profiles/types';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const profile = ref<ProfileDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const lastLoadedKey = ref<string | null>(null);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rawRouteKey = computed(() => {
  const value = route.params.username;
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' && value.length ? value.trim() : null;
});

const routeUsername = computed(() => {
  const value = rawRouteKey.value;
  if (!value) return null;
  if (UUID_PATTERN.test(value)) return null;
  return value.toLowerCase();
});

const routeProfileId = computed(() => {
  const value = rawRouteKey.value;
  if (!value) return null;
  if (UUID_PATTERN.test(value)) {
    return value;
  }
  return null;
});

const authUsername = computed(() => {
  const metadata = authStore.user?.user_metadata as { username?: string } | undefined;
  const handle = metadata?.username;
  return typeof handle === 'string' && handle.length ? handle.toLowerCase() : null;
});

const authProfileId = computed(() => authStore.user?.id ?? null);

const canEditProfile = computed(() => {
  if (!profile.value || !authStore.user) return false;
  return profile.value.id === authStore.user.id;
});

const formattedCreatedAt = computed(() => {
  if (!profile.value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
    profile.value.creation_time,
  );
});

const profileHandle = computed(() => {
  if (!profile.value?.username) return null;
  return `@${profile.value.username}`;
});

const orgMembershipCount = computed(() => profile.value?.memberships.length ?? 0);

const formatMembershipRole = (role: string) => {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(date);

type ProfileSource =
  | { type: 'username'; value: string }
  | { type: 'id'; value: string };

const loadProfile = async (source: ProfileSource) => {
  const cacheKey = `${source.type}:${source.value}`;
  if (lastLoadedKey.value === cacheKey && profile.value) {
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    profile.value =
      source.type === 'username'
        ? await profileService.profiles.getWithMembershipsByUsername(source.value)
        : await profileService.profiles.getWithMemberships(source.value);
    lastLoadedKey.value = cacheKey;
  } catch (err) {
    profile.value = null;
    error.value = err instanceof Error ? err.message : 'Unable to load profile right now.';
  } finally {
    loading.value = false;
  }
};

watch(
  [routeUsername, routeProfileId, authProfileId],
  ([username, profileId, fallbackId]) => {
    if (username) {
      loadProfile({ type: 'username', value: username });
      return;
    }

    if (profileId) {
      loadProfile({ type: 'id', value: profileId });
      return;
    }

    if (fallbackId) {
      loadProfile({ type: 'id', value: fallbackId });
      return;
    }

    profile.value = null;
    error.value = 'Profile unavailable.';
  },
  { immediate: true },
);

const jumpToOwnProfile = () => {
  if (authUsername.value) {
    router.push(`/profile/${authUsername.value}`);
    return;
  }

  if (authStore.user?.id) {
    router.push('/profile');
  }
};
</script>

<template>
  <section class="container space-y-8 py-6">
    <div v-if="loading" class="rounded border border-white/15 bg-black/40 p-6 text-white/70">
      Loading profile…
    </div>

    <div v-else-if="error" class="rounded border border-rose-400/40 bg-rose-500/10 p-6 text-white">
      <p class="font-semibold">{{ error }}</p>
      <p class="mt-2 text-sm text-white/80">Double-check the profile link or return to your own profile.</p>
      <button
        v-if="authStore.user?.id"
        type="button"
        class="mt-4 inline-flex items-center rounded border border-white/30 px-4 py-2 text-sm font-medium uppercase tracking-wide hover:bg-white/10"
        @click="jumpToOwnProfile"
      >
        Take me to my profile
      </button>
    </div>

    <div v-else-if="profile" class="space-y-8">
      <header class="rounded border border-white/15 bg-white/5 p-6 text-white">
        <p class="text-xs uppercase tracking-[0.3em] text-white/60">Profile</p>
        <div class="mt-2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-4xl font-semibold">
              {{ profileHandle ?? profile.name }}
            </h1>
            <p class="text-white/70">
              {{ profile.name }} · {{ profile.role }} · Joined {{ formattedCreatedAt }}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <RouterLink
              v-if="canEditProfile"
              to="/settings"
              class="inline-flex items-center rounded border border-white/30 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            >
              <Icon icon="carbon:edit" width="18" height="18" class="mr-2" />
              Edit profile
            </RouterLink>
            <span
              v-else
              class="inline-flex items-center rounded border border-white/20 px-4 py-2 text-sm text-white/70"
            >
              <Icon icon="carbon:view" width="18" height="18" class="mr-2" />
              Viewing only
            </span>
          </div>
        </div>
      </header>

      <section class="rounded border border-white/15 bg-white/5 p-5">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <article class="rounded border border-white/15 bg-black/40 p-4 text-white">
            <p class="text-xs uppercase tracking-wide text-white/50">XP</p>
            <div class="mt-2 text-3xl font-semibold">{{ profile.xp ?? '—' }}</div>
          </article>
          <article class="rounded border border-white/15 bg-black/40 p-4 text-white">
            <p class="text-xs uppercase tracking-wide text-white/50">Platform role</p>
            <div class="mt-2 text-xl font-semibold">{{ profile.role }}</div>
          </article>
          <article class="rounded border border-white/15 bg-black/40 p-4 text-white">
            <p class="text-xs uppercase tracking-wide text-white/50">Organizations</p>
            <div class="mt-2 text-3xl font-semibold">{{ orgMembershipCount }}</div>
          </article>
          <article class="rounded border border-white/15 bg-black/40 p-4 text-white">
            <p class="text-xs uppercase tracking-wide text-white/50">Member since</p>
            <div class="mt-2 text-xl font-semibold">{{ formattedCreatedAt }}</div>
          </article>
        </div>
      </section>

      <section class="rounded border border-white/15 bg-white/5 p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3 text-white">
          <div>
            <p class="text-sm uppercase tracking-wide text-white/60">Memberships</p>
            <h2 class="text-2xl font-semibold">Organizations & roles</h2>
          </div>
          <RouterLink
            v-if="canEditProfile"
            to="/organizations"
            class="text-sm font-semibold text-white/70 underline-offset-4 hover:text-white"
          >
            Manage memberships
          </RouterLink>
        </div>

        <div
          v-if="profile.memberships.length === 0"
          class="rounded border border-white/15 bg-black/30 p-6 text-white/70"
        >
          Not part of any organizations yet.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="membership in profile.memberships"
            :key="`${membership.org_id}-${membership.org_role}`"
            class="rounded border border-white/15 bg-black/30 p-4 text-white"
          >
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-lg font-semibold">{{ membership.org_name }}</p>
                <p class="text-sm text-white/70">
                  {{ formatMembershipRole(membership.org_role) }} · Joined {{ formatDate(membership.join_date) }}
                </p>
              </div>
              <RouterLink
                class="inline-flex items-center text-sm uppercase tracking-wide text-white/70 hover:text-white"
                :to="membership.slug ? `/orgs/${membership.slug}/overview` : `/orgs/${membership.org_id}/overview`"
              >
                View org
                <Icon icon="carbon:chevron-right" width="16" height="16" class="ml-1" />
              </RouterLink>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
