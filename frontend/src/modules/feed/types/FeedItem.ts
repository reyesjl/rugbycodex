export type FeedItem = {
  /** Segment id (primary key for narration + feed identity) */
  id: string;
  orgId: string;
  orgName?: string | null;

  mediaAssetId: string;
  bucket: string;
  mediaAssetSegmentId: string;
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;

  title: string;
  metaLine: string;
  createdAt: Date;
};
