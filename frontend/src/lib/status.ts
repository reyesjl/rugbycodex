export type StatusDisplay = {
  label: string;
  icon: string | null;
  iconClass?: string;
  textClass?: string;
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
      return { label: 'Processing', icon: 'ei:spinner', iconClass: 'animate-spin', textClass: 'text-amber-400/80' };
    case 'ready':
      return { label: 'Ready', icon: 'carbon:radio-button-checked', textClass: 'text-emerald-400/80' };
    case 'uploading':
      return { label: 'Uploading', icon: 'carbon:cloud-upload', textClass: 'text-blue-400/80' };
    case 'interrupted':
      return { label: 'Upload interrupted.', icon: 'carbon:warning-alt', iconClass: 'text-yellow-500/70', textClass: 'text-yellow-500/80' };
    case 'failed':
      return { label: 'Failed', icon: 'carbon:warning-alt', textClass: 'text-red-400/80' };
    case 'intent':
      return { label: 'Intent', icon: 'carbon:radio-button', textClass: 'text-white/40' };
    default:
      return {
        label: normalized ? titleCaseFromToken(normalized) : 'Unknown',
        icon: null,
        textClass: 'text-white/40',
      };
  }
}
