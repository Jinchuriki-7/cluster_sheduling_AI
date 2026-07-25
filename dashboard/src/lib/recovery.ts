/**
 * ClusterOS Job Recovery Engine
 *
 * Implements checkpoint-based job recovery when a node fails mid-execution.
 *
 * Recovery Flow:
 *   Running Job → Node Failure Detected → Checkpoint Recovery
 *   → Healthy Node Selected → Continue Remaining Work → Job Completed
 *
 * This engine:
 *   1. Detects node failures by watching job status + device metrics
 *   2. Creates recovery records in Firestore (jobRecovery collection)
 *   3. Reassigns surviving work to the next best healthy node
 *   4. Tracks recovery statistics for analytics
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  JobRecoveryRecord,
  RecoveryStatus,
  RecoveryStats,
  Job,
  Device,
  SystemSnapshot,
  NodeTrustScore,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRecoveryId(): string {
  return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

// ─── Core Recovery Logic ──────────────────────────────────────────────────────

/**
 * Detect if a running job's assigned node has failed.
 * Returns true if the node is no longer responsive.
 */
export function isNodeFailed(
  deviceId: string,
  metricsMap: Record<string, SystemSnapshot>,
  staleLimitMs = 30_000
): boolean {
  const metrics = metricsMap[deviceId];
  if (!metrics) return true;
  if (metrics.status !== 'online') return true;
  const age = Date.now() - (metrics.timestamp ?? 0);
  return age > staleLimitMs;
}

/**
 * Select the best healthy node for recovery.
 * Prioritises high trust score, then low CPU usage.
 */
export function selectRecoveryNode(
  failedDeviceId: string,
  devices: Device[],
  metricsMap: Record<string, SystemSnapshot>,
  trustScores: Record<string, NodeTrustScore>
): Device | null {
  const candidates = devices.filter(d => {
    if (d.deviceId === failedDeviceId) return false;
    const m = metricsMap[d.deviceId];
    if (!m || m.status !== 'online') return false;
    const age = Date.now() - (m.timestamp ?? 0);
    if (age > 30_000) return false;
    if ((m.cpu?.total ?? 100) >= 95) return false;
    if ((m.ram?.usedPercent ?? 100) >= 95) return false;
    // Reject low-trust nodes for recovery assignments
    const trust = trustScores[d.deviceId];
    if (trust && trust.score < 30) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Sort: highest trust score first, then lowest CPU
  candidates.sort((a, b) => {
    const ta = trustScores[a.deviceId]?.score ?? 50;
    const tb = trustScores[b.deviceId]?.score ?? 50;
    if (Math.abs(ta - tb) > 5) return tb - ta; // significant trust difference
    const ca = metricsMap[a.deviceId]?.cpu?.total ?? 50;
    const cb = metricsMap[b.deviceId]?.cpu?.total ?? 50;
    return ca - cb;
  });

  return candidates[0];
}

/**
 * Estimate what percentage of the job had completed before failure.
 * Uses the job's startedAt timestamp and an expected duration heuristic.
 */
export function estimateProgressAtFailure(job: Job): number {
  if (!job.startedAt) return 0;
  const elapsed = Date.now() - job.startedAt;
  // Heuristic: assume average job takes ~5 minutes
  const estimatedDurationMs = 5 * 60 * 1000;
  return Math.min(Math.round((elapsed / estimatedDurationMs) * 100), 95);
}

// ─── Firestore Operations ─────────────────────────────────────────────────────

/**
 * Create a new job recovery record when a failure is detected.
 */
export async function createRecoveryRecord(
  job: Job,
  failedDevice: Device,
  ownerId: string,
  failureReason?: string
): Promise<string> {
  const recoveryId = generateRecoveryId();
  const progress   = estimateProgressAtFailure(job);

  const record: JobRecoveryRecord = {
    id:                  recoveryId,
    ownerId,
    jobId:               job.id,
    jobName:             job.name,
    originalDeviceId:    failedDevice.deviceId,
    originalDeviceName:  failedDevice.name || failedDevice.machineName,
    failureDetectedAt:   Date.now(),
    checkpointAt:        job.startedAt,
    status:              'active',
    progressAtFailure:   progress,
    failureReason:       failureReason ?? 'Node became unresponsive',
  };

  await setDoc(doc(db, 'jobRecovery', recoveryId), record);
  return recoveryId;
}

/**
 * Update recovery record when a new node takes over.
 */
export async function startRecovery(
  recoveryId: string,
  recoveredDevice: Device
): Promise<void> {
  await updateDoc(doc(db, 'jobRecovery', recoveryId), {
    recoveredDeviceId:   recoveredDevice.deviceId,
    recoveredDeviceName: recoveredDevice.name || recoveredDevice.machineName,
    recoveryStartedAt:   Date.now(),
    status:              'active',
  });
}

/**
 * Mark recovery as completed.
 */
export async function completeRecovery(recoveryId: string): Promise<void> {
  const now = Date.now();
  // Read existing to compute recovery time
  const snap = await getDocs(query(
    collection(db, 'jobRecovery'),
    where('id', '==', recoveryId)
  ));

  const existing = snap.docs[0]?.data() as JobRecoveryRecord | undefined;
  const startedAt = existing?.recoveryStartedAt ?? now;
  const recoveryTimeMs = now - startedAt;

  await updateDoc(doc(db, 'jobRecovery', recoveryId), {
    status:               'recovered',
    recoveryCompletedAt:  now,
    recoveryTimeMs,
  });
}

/**
 * Mark recovery as failed.
 */
export async function failRecovery(recoveryId: string, reason: string): Promise<void> {
  await updateDoc(doc(db, 'jobRecovery', recoveryId), {
    status:              'failed',
    recoveryCompletedAt: Date.now(),
    failureReason:       reason,
  });
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribe to live recovery events for a user.
 */
export function subscribeRecoveryEvents(
  ownerId: string,
  callback: (records: JobRecoveryRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'jobRecovery'),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(q, snap => {
    const records = snap.docs
      .map(d => ({ ...d.data(), id: d.id } as JobRecoveryRecord))
      .sort((a, b) => b.failureDetectedAt - a.failureDetectedAt);
    callback(records);
  });
}

/**
 * Fetch recent recovery events (one-shot, last 50).
 */
export async function fetchRecoveryEvents(
  ownerId: string
): Promise<JobRecoveryRecord[]> {
  const q = query(
    collection(db, 'jobRecovery'),
    where('ownerId', '==', ownerId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as JobRecoveryRecord))
    .sort((a, b) => b.failureDetectedAt - a.failureDetectedAt)
    .slice(0, 50);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Compute aggregate recovery statistics from a list of records.
 */
export function computeRecoveryStats(records: JobRecoveryRecord[]): RecoveryStats {
  const total      = records.length;
  const successful = records.filter(r => r.status === 'recovered').length;
  const failed     = records.filter(r => r.status === 'failed').length;
  const active     = records.filter(r => r.status === 'active').length;

  const completedWithTime = records.filter(
    r => r.status === 'recovered' && r.recoveryTimeMs != null
  );
  const avgTimeMs = completedWithTime.length > 0
    ? completedWithTime.reduce((acc, r) => acc + (r.recoveryTimeMs ?? 0), 0) / completedWithTime.length
    : 0;

  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

  return {
    totalRecoveries:      total,
    successfulRecoveries: successful,
    failedRecoveries:     failed,
    activeRecoveries:     active,
    successRate,
    avgRecoveryTimeMs:    Math.round(avgTimeMs),
  };
}

/**
 * Format recovery time for display.
 */
export function formatRecoveryTime(ms: number | undefined): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}
