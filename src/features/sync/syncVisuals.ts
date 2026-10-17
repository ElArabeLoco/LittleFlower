/**
 * Icons and tone colors for the sync UI, keyed by the semantic names that
 * syncPresentation returns. Tones follow the palette roles: petal = action,
 * leaf = healthy, polen = attention, brick = problem, mist = quiet.
 */

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CloudAlert,
  CloudCheck,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import type { SyncAlertKind } from '@/application/useSyncStatus';
import type { SyncEventIcon, SyncEventTone, SyncIcon, SyncTone } from './syncPresentation';

export const HEALTH_ICONS: Record<SyncIcon, LucideIcon> = {
  synced: CloudCheck,
  syncing: RefreshCw,
  pending: CloudUpload,
  offline: CloudOff,
  error: CloudAlert,
};

export const EVENT_ICONS: Record<SyncEventIcon, LucideIcon> = {
  upload: ArrowUp,
  download: ArrowDown,
  failed: CircleAlert,
  connected: Wifi,
  disconnected: WifiOff,
  'connection-error': TriangleAlert,
};

export const ALERT_ICONS: Record<SyncAlertKind, LucideIcon> = {
  'upload-rejected': CircleAlert,
  auth: CircleAlert,
  connection: TriangleAlert,
  offline: CloudOff,
};

export const TONE_TEXT: Record<SyncTone | SyncEventTone, string> = {
  muted: 'text-[var(--text-muted)]',
  brand: 'text-[var(--text-brand)]',
  now: 'text-[var(--text-now)]',
  negative: 'text-[var(--text-negative)]',
  positive: 'text-[var(--text-positive)]',
};

/** The syncing icon turns slowly: activity, not alarm. Applied to a wrapper, never the SVG. */
export const SLOW_SPIN = { className: 'animate-spin', style: { animationDuration: '2.4s' } } as const;
