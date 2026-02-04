import { supabase } from '@/lib/supabaseClient';
import type { OrgGroup } from '@/modules/groups/types';

export type GroupMemberRow = {
  group_id: string;
  profile_id: string;
};

export const groupsService = {
  async getGroupsForOrg(orgId: string): Promise<Array<{ group: OrgGroup; memberIds: string[] }>> {
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, org_id, name, description, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });

    if (groupsError) throw groupsError;

    const groupIds = (groups ?? []).map((g) => g.id as string);

    if (groupIds.length === 0) {
      return [];
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id, profile_id')
      .in('group_id', groupIds);

    if (membershipError) throw membershipError;

    const byGroup = new Map<string, string[]>();
    for (const row of (membershipRows ?? []) as GroupMemberRow[]) {
      const existing = byGroup.get(row.group_id) ?? [];
      existing.push(row.profile_id);
      byGroup.set(row.group_id, existing);
    }

    return (groups ?? []).map((g) => ({
      group: g as OrgGroup,
      memberIds: byGroup.get((g as any).id) ?? [],
    }));
  },

  async createGroup(orgId: string, payload: { name: string; description?: string | null }): Promise<OrgGroup> {
    const { data, error } = await supabase
      .from('groups')
      .insert({
        org_id: orgId,
        name: payload.name,
        description: payload.description ?? null,
      })
      .select('id, org_id, name, description, created_at')
      .single();

    if (error) throw error;
    return data as OrgGroup;
  },

  async addMemberToGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('group_members').insert({ group_id: groupId, profile_id: userId });
    if (error) throw error;
  },

  async removeMemberFromGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', userId);
    if (error) throw error;
  },

  async deleteGroup(groupId: string): Promise<void> {
    // First delete all group members (cascade should handle this, but explicit is safer)
    const { error: membersError } = await supabase.from('group_members').delete().eq('group_id', groupId);
    if (membersError) throw membersError;

    // Then delete the group itself
    const { error: groupError } = await supabase.from('groups').delete().eq('id', groupId);
    if (groupError) throw groupError;
  },
};
