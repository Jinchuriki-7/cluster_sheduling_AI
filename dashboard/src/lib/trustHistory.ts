/**
 * ClusterOS Trust Score History Engine
 *
 * Persists periodic trust score snapshots to Firestore so that
 * the Analytics page can render a time-series "Trust History" chart.
 *
 * Collection: trustHistory/{autoId}
 * Fields: ownerId, deviceId, deviceName, score, level, timestamp
 *
 * Snapshots are written every time trust scores are recomputed (≈ every 30s).
 * The UI queries the last 50 snapshots per device for charting.
 */

import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import type { NodeTrustScore, TrustScoreHistoryPoint } from '@/types';

export interface TrustHistoryEntry {
  id?: string;
  ownerId: string;
  deviceId: string;
  deviceName: string;
  score: number;
  level: 'high' | 'medium' | 'low';
  timestamp: number;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Save a batch of trust score snapshots (one per device) to Firestore.
 * Called every time trust scores are recomputed in the layout.
 */
export async function saveTrustHistoryBatch(
  scores: Record<string, NodeTrustScore>
): Promise<void> {
  const entries = Object.values(scores);
  if (entries.length === 0) return;

  const now = Date.now();
  await Promise.all(
    entries.map(s =>
      addDoc(collection(db, 'trustHistory'), {
        ownerId:    s.ownerId,
        deviceId:   s.deviceId,
        deviceName: s.deviceName,
        score:      s.score,
        level:      s.level,
        timestamp:  now,
      } satisfies Omit<TrustHistoryEntry, 'id'>)
    )
  );
}

/**
 * Fetch the last N trust history snapshots for a specific device (one-shot).
 */
export async function fetchDeviceTrustHistory(
  deviceId: string,
  maxPoints = 50
): Promise<TrustHistoryEntry[]> {
  const q = query(
    collection(db, 'trustHistory'),
    where('deviceId', '==', deviceId),
    orderBy('timestamp', 'desc'),
    limit(maxPoints)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TrustHistoryEntry))
    .reverse(); // oldest first for charting
}

/**
 * Fetch trust history for all devices owned by a user (last N per device).
 */
export async function fetchAllTrustHistory(
  ownerId: string,
  maxPoints = 100
): Promise<TrustHistoryEntry[]> {
  const q = query(
    collection(db, 'trustHistory'),
    where('ownerId', '==', ownerId),
    orderBy('timestamp', 'desc'),
    limit(maxPoints)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as TrustHistoryEntry))
    .reverse(); // oldest first for charting
}

/**
 * Subscribe to live trust history updates for a user.
 * Returns entries sorted oldest-first (suitable for a time-series chart).
 */
export function subscribeTrustHistory(
  ownerId: string,
  callback: (entries: TrustHistoryEntry[]) => void,
  maxPoints = 100
): () => void {
  const q = query(
    collection(db, 'trustHistory'),
    where('ownerId', '==', ownerId),
    orderBy('timestamp', 'desc'),
    limit(maxPoints)
  );

  return onSnapshot(q, snap => {
    const entries = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as TrustHistoryEntry))
      .reverse();
    callback(entries);
  });
}

// ─── Chart Data Helpers ───────────────────────────────────────────────────────

/**
 * Convert raw trust history entries into a chart-ready series grouped by device.
 * Returns an array of { time, [deviceName]: score } objects for Recharts.
 */
export function buildTrustHistoryChartData(
  entries: TrustHistoryEntry[]
): Array<Record<string, number | string>> {
  if (entries.length === 0) return [];

  // Build a map: timestamp (rounded to minute) → { deviceName: score }
  const timeMap = new Map<number, Record<string, number>>();

  for (const e of entries) {
    // Round to nearest minute for cleaner chart labels
    const rounded = Math.floor(e.timestamp / 60_000) * 60_000;
    if (!timeMap.has(rounded)) timeMap.set(rounded, {});
    timeMap.get(rounded)![e.deviceName.slice(0, 12)] = e.score;
  }

  // Sort by time and return array
  return Array.from(timeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([ts, scores]) => ({
      time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...scores,
    }));
}

/**
 * Get unique device names present in a trust history entry list.
 */
export function getDeviceNamesFromHistory(entries: TrustHistoryEntry[]): string[] {
  return Array.from(new Set(entries.map(e => e.deviceName.slice(0, 12))));
}
