import { computed, ref, watch } from 'vue';
import { segmentTagService } from '@/modules/media/services/segmentTagService';
import type { SegmentTag, SegmentTagType } from '@/modules/media/types/SegmentTag';

type TagsBySegmentId = Record<string, SegmentTag[]>;

export function useSegmentTags(options: { segmentIds: () => string[] }) {
  const tagsBySegmentId = ref<TagsBySegmentId>({});
  const loadingSegmentIds = ref(new Set<string>());
  let requestId = 0;

  const segmentIds = computed(() => options.segmentIds().map((id) => String(id)).filter(Boolean));

  function updateTagsForSegment(segmentId: string, updater: (tags: SegmentTag[]) => SegmentTag[]): void {
    const existing = tagsBySegmentId.value[segmentId] ?? [];
    tagsBySegmentId.value = {
      ...tagsBySegmentId.value,
      [segmentId]: updater(existing),
    };
  }

  async function reload(): Promise<void> {
    const ids = segmentIds.value;
    const currentRequestId = ++requestId;

    if (ids.length === 0) {
      tagsBySegmentId.value = {};
      return;
    }

    try {
      const next = await segmentTagService.listTagsForSegments(ids);
      if (currentRequestId !== requestId) return;
      const normalized: TagsBySegmentId = {};
      for (const id of ids) {
        normalized[id] = next[id] ?? [];
      }
      tagsBySegmentId.value = normalized;
    } catch {
      // Best-effort hydration; ignore tag load failures.
    }
  }

  async function addTag(params: {
    segmentId: string;
    tagKey: string;
    tagType: SegmentTagType;
  }): Promise<SegmentTag | null> {
    const segmentId = String(params.segmentId ?? '');
    if (!segmentId) return null;
    if (loadingSegmentIds.value.has(segmentId)) return null;

    const nextLoading = new Set(loadingSegmentIds.value);
    nextLoading.add(segmentId);
    loadingSegmentIds.value = nextLoading;

    try {
      const tag = await segmentTagService.addTag({
        segmentId,
        tagKey: params.tagKey,
        tagType: params.tagType,
      });
      // Optimistically update local tag state (no re-fetch).
      updateTagsForSegment(segmentId, (tags) => [...tags, tag]);
      return tag;
    } finally {
      const cleared = new Set(loadingSegmentIds.value);
      cleared.delete(segmentId);
      loadingSegmentIds.value = cleared;
    }
  }

  async function removeTag(params: { segmentId: string; tagId: string }): Promise<boolean> {
    const segmentId = String(params.segmentId ?? '');
    const tagId = String(params.tagId ?? '');
    if (!segmentId || !tagId) return false;
    if (loadingSegmentIds.value.has(segmentId)) return false;

    const nextLoading = new Set(loadingSegmentIds.value);
    nextLoading.add(segmentId);
    loadingSegmentIds.value = nextLoading;

    try {
      await segmentTagService.removeTag(tagId);
      // Optimistically update local tag state (no re-fetch).
      updateTagsForSegment(segmentId, (tags) => tags.filter((tag) => String(tag.id) !== tagId));
      return true;
    } finally {
      const cleared = new Set(loadingSegmentIds.value);
      cleared.delete(segmentId);
      loadingSegmentIds.value = cleared;
    }
  }

  watch(
    () => segmentIds.value.join('|'),
    () => {
      void reload();
    },
    { immediate: true }
  );

  return {
    tagsBySegmentId,
    reload,
    addTag,
    removeTag,
  };
}
