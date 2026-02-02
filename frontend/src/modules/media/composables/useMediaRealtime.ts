import { onUnmounted, ref } from 'vue';
import { supabase } from '@/lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Composable for managing Realtime subscriptions to media_assets table.
 * 
 * Subscribes to INSERT and UPDATE events for media assets in a specific organization.
 * Handles connection lifecycle, auto-reconnection, and cleanup.
 * 
 * Usage:
 * ```ts
 * const { subscribe, unsubscribe, isSubscribed } = useMediaRealtime();
 * 
 * subscribe(orgId, (payload) => {
 *   console.log('Media asset changed:', payload.new);
 * });
 * 
 * // Auto-unsubscribes on component unmount
 * ```
 */
export function useMediaRealtime() {
  const channel = ref<RealtimeChannel | null>(null);
  const isSubscribed = ref(false);
  const subscriptionStatus = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const error = ref<string | null>(null);

  /**
   * Subscribe to media_assets changes for a specific organization.
   * 
   * @param orgId - Organization UUID to filter events by
   * @param onUpdate - Callback fired when an asset is created or updated
   */
  function subscribe(
    orgId: string,
    onUpdate: (payload: any) => void
  ) {
    // Don't create duplicate subscriptions
    if (channel.value) {
      console.warn('[Realtime] Already subscribed, unsubscribing first');
      unsubscribe();
    }

    subscriptionStatus.value = 'connecting';
    error.value = null;

    console.log(`[Realtime] 🔌 Subscribing to media_assets for org: ${orgId}`);

    // Create a channel with org-specific identifier
    const channelName = `media_assets:org_id=eq.${orgId}`;
    const realtimeChannel = supabase.channel(channelName);

    // Listen for INSERT events (new uploads)
    realtimeChannel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'media_assets',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        console.log('[Realtime] ➕ New media asset:', payload.new);
        onUpdate(payload);
      }
    );

    // Listen for UPDATE events (processing status changes)
    realtimeChannel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'media_assets',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        console.log('[Realtime] 🔄 Media asset updated:', payload.new);
        onUpdate(payload);
      }
    );

    // Subscribe and handle connection lifecycle
    realtimeChannel
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ Connected and subscribed');
          subscriptionStatus.value = 'connected';
          isSubscribed.value = true;
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] ❌ Channel error:', err);
          subscriptionStatus.value = 'error';
          error.value = err?.message || 'Channel error';
          isSubscribed.value = false;
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] ⏱️ Connection timed out');
          subscriptionStatus.value = 'error';
          error.value = 'Connection timed out';
          isSubscribed.value = false;
        } else if (status === 'CLOSED') {
          console.log('[Realtime] 🔌 Connection closed');
          subscriptionStatus.value = 'idle';
          isSubscribed.value = false;
        }
      });

    channel.value = realtimeChannel;
  }

  /**
   * Unsubscribe from the current channel and clean up resources.
   */
  function unsubscribe() {
    if (!channel.value) return;

    console.log('[Realtime] 🔌 Unsubscribing from media_assets');

    // Unsubscribe and remove the channel
    channel.value.unsubscribe();
    channel.value = null;
    isSubscribed.value = false;
    subscriptionStatus.value = 'idle';
    error.value = null;
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    unsubscribe();
  });

  return {
    subscribe,
    unsubscribe,
    isSubscribed,
    subscriptionStatus,
    error,
  };
}
