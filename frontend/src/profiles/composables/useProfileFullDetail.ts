import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import { type MembershipRelationRow, type OrgMembership, type OrgMembershipRow, type ProfileDetail } from '@/profiles/types';
import { profileService } from '@/profiles/services/ProfileService';
import { useDbWatcherStore, type PostgresChange } from '@/lib/useDbWatcher';
import { supabase } from '@/lib/supabaseClient';


export function useProfileFullDetail() {
  const profile = ref<ProfileDetail | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const loadProfile = async (id: string) => {
    clearProfile();
    try {
      profile.value = await profileService.profiles.getWithMemberships(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load profile.';
    } finally {
      loading.value = false;
    }
  };

  const memberships: ComputedRef<OrgMembership[]> = computed(() => {
    return profile.value?.memberships || [];
  });

  function canManageOrg(orgId: string): boolean {
    const membership = memberships.value.find(org => org.org_id === orgId);
    if (!membership) return false;
    return membership.org_role === 'owner' || membership.org_role === 'manager';
  };

  function clearProfile() {
    profile.value = null;
    loading.value = false;
    error.value = null;
  }

  const dbWatcher = useDbWatcherStore()

  function handleMembershipChange(payload: PostgresChange<OrgMembershipRow>) {
    console.log("Event Type on membership change:", payload.eventType);
    console.log('Membership old:', payload.old)
    console.log('Membership new:', payload.new)
    switch (payload.eventType) {
      case 'INSERT':
        // If a new membership is added for the current profile, reload the profile detail
        if (profile.value && payload.new && payload.new.user_id === profile.value.id) {
          loadProfile(profile.value.id);
        }
        break;
      case 'UPDATE':
        if (profile.value && payload.new) {  
          profile.value.memberships.forEach(membership => {
            // Update the membership details if it matches the updated record
            if (membership.org_id === payload.new!.org_id) {
              membership.org_role = payload.new!.role;
            }
          });
        };
        break;
      case 'DELETE':
        if (profile.value && payload.old) {  
          // Remove the membership from the profile's memberships
          profile.value.memberships = profile.value.memberships.filter(
            membership => membership.org_id !== payload.old!.org_id
          );
        };
        break;
      default:
        console.warn(`Unhandled membership change event type: ${payload.eventType}`);
    }
  }

  onMounted(() => {
    console.log("Mounting!");
    console.log(supabase.getChannels());
    const unsub = dbWatcher.subscribe<OrgMembershipRow>('org_members', handleMembershipChange)
    onBeforeUnmount(() => {
      console.log("Unmounting!");
      unsub();
    });
  })


  return {
    profile,
    loading,
    error,
    memberships,

    loadProfile,
    canManageOrg,
    clearProfile,
  }
};

