// Admin Dashboard Overview Types

export type AdminDashboardMetrics = {
  activeOrgs: number;
  activeUsers30d: number;
  narrations30d: number;
  pipelineFailures: number;
};

export type TimeSeriesPoint = {
  date: string;
  count: number;
};

export type MediaUploadPoint = TimeSeriesPoint & {
  sizeGb: number;
};

export type AdminDashboardCharts = {
  narrationsOverTime: TimeSeriesPoint[];
  mediaUploadVolume: MediaUploadPoint[];
};

export type AttentionItemCategory = 
  | 'job_failure' 
  | 'processing_failure' 
  | 'storage_warning' 
  | 'inactive_org';

export type AttentionItem = {
  id: string;
  category: AttentionItemCategory;
  type?: string;
  state?: string;
  errorMessage?: string;
  fileName?: string;
  stage?: string;
  updatedAt?: string;
  createdAt?: string;
  orgName: string;
  orgId: string;
};

export type ActivityEventType = 
  | 'org_created' 
  | 'media_uploaded' 
  | 'narration_generated' 
  | 'job_completed' 
  | 'job_failed';

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  title: string;
  subtitle: string | null;
  timestamp: string;
  orgId: string;
  orgName: string;
};

export type AdminDashboardAttentionItems = {
  failedJobs: AttentionItem[];
  processingFailures: AttentionItem[];
};

export type AdminDashboardOverview = {
  metrics: AdminDashboardMetrics;
  charts: AdminDashboardCharts;
  attentionItems: AdminDashboardAttentionItems;
  recentActivity: ActivityEvent[];
  generatedAt: string;
};
