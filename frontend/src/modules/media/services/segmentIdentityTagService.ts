import { invokeEdge } from '@/lib/api';
import { handleEdgeFunctionError } from '@/lib/handleEdgeFunctionError';
import type { SegmentTag } from '@/modules/media/types/SegmentTag';

export const segmentIdentityTagService = {
  async addIdentityTag(params: {
    segmentId: string;
    tagKey: string;
    taggedProfileId: string;
  }): Promise<SegmentTag> {
    const segmentId = String(params.segmentId ?? '').trim();
    const tagKey = String(params.tagKey ?? '').trim();
    const taggedProfileId = String(params.taggedProfileId ?? '').trim();
    if (!segmentId) throw new Error('Missing segmentId.');
    if (!tagKey) throw new Error('Missing tagKey.');
    if (!taggedProfileId) throw new Error('Missing taggedProfileId.');

    const response = await invokeEdge('create-identity-tag', {
      body: {
        segment_id: segmentId,
        tag_key: tagKey,
        tagged_profile_id: taggedProfileId,
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, 'Unable to add identity tag.');
    }

    const data = response.data as SegmentTag | null;
    if (!data) {
      throw new Error('Failed to add identity tag.');
    }
    return data;
  },
};
