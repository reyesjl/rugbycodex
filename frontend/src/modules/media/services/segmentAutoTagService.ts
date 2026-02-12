import { invokeEdge } from '@/lib/api';
import { handleEdgeFunctionError } from '@/lib/handleEdgeFunctionError';
import type { SegmentTagType } from '@/modules/media/types/SegmentTag';
import type { SegmentTagSuggestion } from '@/modules/media/types/SegmentTagSuggestion';

export type AutoTagSkipped = {
  tag_key: string;
  tag_type: SegmentTagType;
  reason: string;
};

export type AutoTagResponse = {
  suggested_tags: SegmentTagSuggestion[];
  skipped_tags: AutoTagSkipped[];
};

export const segmentAutoTagService = {
  async autoTagSegment(params: {
    narrationId?: string;
    segmentId?: string;
    force?: boolean;
  }): Promise<AutoTagResponse> {
    const narrationId = String(params.narrationId ?? '').trim();
    const segmentId = String(params.segmentId ?? '').trim();
    if (!narrationId && !segmentId) {
      throw new Error('Missing narrationId or segmentId.');
    }

    const response = await invokeEdge('auto-tag-segment', {
      body: {
        narration_id: narrationId || null,
        segment_id: segmentId || null,
        force: Boolean(params.force),
      },
      orgScoped: true,
    });

    if (response.error) {
      throw await handleEdgeFunctionError(response.error, 'Unable to auto-tag segment.');
    }

    const data = (response.data ?? {}) as {
      suggested_tags?: SegmentTagSuggestion[];
      skipped_tags?: AutoTagSkipped[];
    };

    return {
      suggested_tags: Array.isArray(data.suggested_tags) ? data.suggested_tags : [],
      skipped_tags: Array.isArray(data.skipped_tags) ? data.skipped_tags : [],
    };
  },
};
