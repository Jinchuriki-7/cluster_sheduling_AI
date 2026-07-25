/**
 * ClusterOS Node Trust Score Engine
 *
 * Computes a dynamic Trust Score (0–100) for every connected node based on:
 *   - Uptime percentage
 *   - Job completion ratio (successful / total)
 *   - Heartbeat stability
 *   - Average response time score
 *   - System health status
 *   - Recent disconnection penalty
 *
 * Formula (weights sum to 1.0):
 *   TrustScore = 0.25×uptime + 0.25×completionRatio + 0.20×heartbeatStability
 *              + 0.15×responseTime + 0.10×systemHealth - disconnectionPenalty
 *
 * Score ranges:
 *   High:   75–100  (green)
 *   Medium: 40–74   (yellow)
 *   Low:     0–39   (red)
 */

import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  NodeTrustScore,
  TrustLevel,
  TrustEngineStats,
  Device,
  SystemSnapshot,
  Job,
} from '@/types';

// ─── Score weights ────────────────────────────────────────────────────────────

const WEIGHTS = {
  uptime:           0.25,
  completionRatio:  0.25,
  heartbeat:        0.20,
  responseTime:     0.15,
  systemHealth:     0.10,
  // disconnectionPenalty applied after weighted sum
};

const DISCONNECTION_PENALTY_PER_EVENT = 5; // points deducted per recent disconnect
const MAX_DISCONNECTION_PENALTY = 30;      // cap the penalty

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, isFinite(v) ? v : min));
}

/** Map health status string to a 0–100 score */
function healthStatusToScore(healthStatus: string | undefined): number {
  switch (healthStatus) {
    case 'healthy':   return 100;
    case 'degraded':  return 50;
    case 'critical':  return 10;
    default:          return 70; // unknown — assume moderate
  }
}

/** Estimate heartbeat stability from recent timestamps (0–100) */
function computeHeartbeatStability(metrics: SystemSnapshot | undefined): number {
  if (!metrics) return 0;
  const now = Date.now();
  const lastBeat = metrics.heartbeatAt ?? metrics.timestamp ?? 0;
  const ageSec = (now - lastBeat) / 1000;

  // Perfect if heartbeat < 10s ago, degrades to 0 at 60s
  if (ageSec <= 10) return 100;
  if (ageSec >= 60) return 0;
  return clamp(100 - ((ageSec - 10) / 50) * 100);
}

/** Inverse latency → score (0–100) */
function responseTimeToScore(latencyMs: number | undefined): number {
  const ms = latencyMs ?? 20;
  if (ms <= 5)   return 100;
  if (ms >= 300) return 0;
  return clamp(100 - ((ms - 5) / 295) * 100);
}

/** Uptime percentage from seconds → 0–100 */
function uptimeToScore(uptimeSeconds: number | undefined): number {
  // Longer uptime = more stability. Score saturates at 72 h (3 days)
  const hours = (uptimeSeconds ?? 0) / 3600;
  if (hours >= 72) return 100;
  return clamp((hours / 72) * 100);
}

/** Get trust level label from score */
export function getTrustLevel(score: number): TrustLevel {
  if (score >= 75) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/** Trust level display color (Tailwind class) */
export function getTrustColor(level: TrustLevel): string {
  switch (level) {
    case 'high':   return 'text-green-400';
    case 'medium': return 'text-yellow-400';
    case 'low':    return 'text-red-400';
  }
}

/** Trust level background color (Tailwind class) */
export function getTrustBg(level: TrustLevel): string {
  switch (level) {
    case 'high':   return 'bg-green-500/10 border-green-500/30';
    case 'medium': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'low':    return 'bg-red-500/10 border-red-500/30';
  }
}

/** Trust level badge color (hex) */
export function getTrustHexColor(level: TrustLevel): string {
  switch (level) {
    case 'high':   return '#22c55e';
    case 'medium': return '#eab308';
    case 'low':    return '#ef4444';
  }
}

// ─── Core Computation ─────────────────────────────────────────────────────────

/**
 * Compute the trust score for a single node given its current metrics and job history.
 */
export function computeTrustScore(
  device: Device,
  metrics: SystemSnapshot | undefined,
  jobs: Job[],
  existingRecord?: NodeTrustScore | null
): NodeTrustScore {
  const deviceJobs = jobs.filter(j =>
    j.targetDeviceIds?.includes(device.deviceId)
  );

  const completed = deviceJobs.filter(j => j.status === 'completed').length;
  const failed    = deviceJobs.filter(j => j.status === 'failed').length;
  const total     = completed + failed;

  // Sub-scores
  const uptimeScore       = uptimeToScore(metrics?.uptimeSeconds);
  const completionRatio   = total > 0 ? (completed / total) : 0.8; // default 80% if no history
  const completionScore   = clamp(completionRatio * 100);
  const heartbeatScore    = computeHeartbeatStability(metrics);
  const responseScore     = responseTimeToScore(metrics?.network?.latencyMs);
  const healthScore       = healthStatusToScore(metrics?.healthStatus);

  // Weighted sum
  const weighted =
    WEIGHTS.uptime          * uptimeScore +
    WEIGHTS.completionRatio * completionScore +
    WEIGHTS.heartbeat       * heartbeatScore +
    WEIGHTS.responseTime    * responseScore +
    WEIGHTS.systemHealth    * healthScore;

  // Disconnection penalty (carried forward from existing record)
  const recentDisconnections = existingRecord?.recentDisconnections ?? 0;
  const penalty = Math.min(
    recentDisconnections * DISCONNECTION_PENALTY_PER_EVENT,
    MAX_DISCONNECTION_PENALTY
  );

  // Verification penalty / bonus
  const verifyTotal = (existingRecord?.successfulVerifications ?? 0) +
                      (existingRecord?.failedVerifications ?? 0);
  const verifyPenalty = verifyTotal > 0
    ? (existingRecord!.failedVerifications / verifyTotal) * 15
    : 0;

  const rawScore = weighted - penalty - verifyPenalty;
  const score    = clamp(Math.round(rawScore));
  const level    = getTrustLevel(score);

  return {
    deviceId:                 device.deviceId,
    deviceName:               device.name || device.machineName,
    ownerId:                  device.ownerId,
    score,
    level,
    uptimePercent:            clamp(uptimeScore),
    jobCompletionRatio:       completionRatio,
    heartbeatStability:       clamp(heartbeatScore),
    avgResponseTimeScore:     clamp(responseScore),
    systemHealthScore:        clamp(healthScore),
    recentDisconnections,
    totalJobsCompleted:       completed,
    totalJobsFailed:          failed,
    successfulVerifications:  existingRecord?.successfulVerifications ?? 0,
    failedVerifications:      existingRecord?.failedVerifications ?? 0,
    isFlagged:                existingRecord?.isFlagged ?? false,
    lastUpdated:              Date.now(),
    createdAt:                existingRecord?.createdAt ?? Date.now(),
  };
}

/**
 * Compute trust scores for all devices and return a map keyed by deviceId.
 */
export function computeAllTrustScores(
  devices: Device[],
  metricsMap: Record<string, SystemSnapshot>,
  jobs: Job[],
  existingScores: Record<string, NodeTrustScore>
): Record<string, NodeTrustScore> {
  const result: Record<string, NodeTrustScore> = {};
  for (const device of devices) {
    const metrics  = metricsMap[device.deviceId];
    const existing = existingScores[device.deviceId] ?? null;
    result[device.deviceId] = computeTrustScore(device, metrics, jobs, existing);
  }
  return result;
}

// ─── Aggregate Stats ──────────────────────────────────────────────────────────

export function computeTrustEngineStats(
  trustScores: Record<string, NodeTrustScore>
): TrustEngineStats {
  const scores = Object.values(trustScores);
  const total  = scores.length;

  if (total === 0) {
    return { totalNodes: 0, highTrustNodes: 0, mediumTrustNodes: 0, lowTrustNodes: 0, flaggedNodes: 0, avgTrustScore: 0 };
  }

  const high    = scores.filter(s => s.level === 'high').length;
  const medium  = scores.filter(s => s.level === 'medium').length;
  const low     = scores.filter(s => s.level === 'low').length;
  const flagged = scores.filter(s => s.isFlagged).length;
  const avg     = Math.round(scores.reduce((acc, s) => acc + s.score, 0) / total);

  return { totalNodes: total, highTrustNodes: high, mediumTrustNodes: medium, lowTrustNodes: low, flaggedNodes: flagged, avgTrustScore: avg };
}

// ─── Firestore Persistence ────────────────────────────────────────────────────

/**
 * Persist a trust score record to Firestore.
 * Uses deviceId as the document key so updates are idempotent.
 */
export async function saveTrustScore(record: NodeTrustScore): Promise<void> {
  await setDoc(
    doc(db, 'trustScores', record.deviceId),
    { ...record, lastUpdated: Date.now() }
  );
}

/**
 * Persist all trust scores for a user's devices.
 */
export async function saveAllTrustScores(
  scores: Record<string, NodeTrustScore>
): Promise<void> {
  await Promise.all(Object.values(scores).map(saveTrustScore));
}

/**
 * Subscribe to live trust score updates for all devices owned by ownerId.
 */
export function subscribeTrustScores(
  ownerId: string,
  callback: (scores: Record<string, NodeTrustScore>) => void
): () => void {
  const q = query(collection(db, 'trustScores'), where('ownerId', '==', ownerId));
  const unsub = onSnapshot(q, snap => {
    const map: Record<string, NodeTrustScore> = {};
    snap.docs.forEach(d => {
      const data = d.data() as NodeTrustScore;
      map[data.deviceId] = data;
    });
    callback(map);
  });
  return unsub;
}

/**
 * Fetch all trust scores for a user (one-shot).
 */
export async function fetchTrustScores(
  ownerId: string
): Promise<Record<string, NodeTrustScore>> {
  const q    = query(collection(db, 'trustScores'), where('ownerId', '==', ownerId));
  const snap = await getDocs(q);
  const map: Record<string, NodeTrustScore> = {};
  snap.docs.forEach(d => {
    const data = d.data() as NodeTrustScore;
    map[data.deviceId] = data;
  });
  return map;
}

/**
 * Record a disconnection event — increments the counter on the existing score.
 * Called by the dashboard layout when a device goes offline unexpectedly.
 */
export async function recordDisconnection(
  deviceId: string,
  ownerId: string
): Promise<void> {
  const existing = (await getDocs(
    query(collection(db, 'trustScores'), where('deviceId', '==', deviceId))
  )).docs[0]?.data() as NodeTrustScore | undefined;

  if (!existing) return;

  await setDoc(doc(db, 'trustScores', deviceId), {
    ...existing,
    recentDisconnections: (existing.recentDisconnections ?? 0) + 1,
    lastUpdated: Date.now(),
  });
}

/**
 * Flag a node (called after result mismatch).
 * Reduces trust score by 15 points immediately.
 */
export async function flagNode(deviceId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'trustScores'), where('deviceId', '==', deviceId))
  );
  if (snap.empty) return;

  const existing = snap.docs[0].data() as NodeTrustScore;
  const newScore = clamp(existing.score - 15);
  const newLevel = getTrustLevel(newScore);

  await setDoc(doc(db, 'trustScores', deviceId), {
    ...existing,
    score:               newScore,
    level:               newLevel,
    isFlagged:           true,
    failedVerifications: (existing.failedVerifications ?? 0) + 1,
    lastUpdated:         Date.now(),
  });
}
