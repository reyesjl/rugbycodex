export type StatusDisplay = {
  label: string;
  icon: string | null;
  iconClass?: string;
};

function titleCaseFromToken(token: string): string {
  return token
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Maps a `media_asset_status` token to UI-friendly display metadata.
 */
export function getMediaAssetStatusDisplay(status: string | null | undefined): StatusDisplay {
  const normalized = (status ?? '').trim().toLowerCase();

  switch (normalized) {
    case 'processing':
      return { label: 'Processing', icon: 'ei:spinner', iconClass: 'animate-spin' };
    case 'ready':
      return { label: 'Ready', icon: 'carbon:radio-button-checked' };
    case 'uploading':
      return { label: 'Uploading', icon: 'carbon:cloud-upload' };
    case 'failed':
      return { label: 'Failed', icon: 'carbon:warning-alt' };
    case 'intent':
      return { label: 'Intent', icon: 'carbon:radio-button' };
    default:
      return {
        label: normalized ? titleCaseFromToken(normalized) : 'Unknown',
        icon: null,
      };
  }
}
