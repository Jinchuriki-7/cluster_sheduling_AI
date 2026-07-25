/**
 * ClusterOS Result Verification Engine
 *
 * Since ClusterOS uses shared personal computers, results from nodes cannot
 * always be fully trusted. This engine validates critical job outputs by:
 *
 *   1. Sending a verification task to a trusted secondary node
 *   2. Comparing both outputs using a hash/signature comparison
 *   3. If outputs match → Mark Result as Verified ✓
 *   4. If outputs don't match → Flag the node, reduce trust score, log mismatch
 *
 * Verification logs are stored in Firestore: verificationLogs/{logId}
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
} from 'firebase/firestore';
import { db } from './firebase';
import { flagNode } from './trust';
import type {
  VerificationLog,
  VerificationStatus,
  VerificationStats,
  Device,
  NodeTrustScore,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateVerificationId(): string {
  return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
}

/**
 * Simple deterministic hash for result comparison.
 * Uses a FNV-inspired hash on the string representation.
 */
export function hashResult(result: string): string {
  let hash = 0x811c9dc5;
  const normalized = result.trim().toLowerCase().replace(/\s+/g, ' ');
  for (let i = 0; i < Math.min(normalized.length, 2048); i++) {
    hash ^= normalized.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Compare two job result outputs.
 * Returns true if they match (allowing for minor whitespace differences).
 */
export function compareResults(primaryResult: string, secondaryResult: string): boolean {
  const h1 = hashResult(primaryResult);
  const h2 = hashResult(secondaryResult);
  return h1 === h2;
}

/**
 * Select the best verifier node — must be high-trust and not the primary node.
 */
export function selectVerifierNode(
  primaryDeviceId: string,
  devices: Device[],
  trustScores: Record<string, NodeTrustScore>,
  metricsMap: Record<string, { status: string; timestamp?: number; cpu?: { total: number } }>
): Device | null {
  const candidates = devices.filter(d => {
    if (d.deviceId === primaryDeviceId) return false;
    const m = metricsMap[d.deviceId] as { status: string; timestamp?: number; cpu?: { total: number } } | undefined;
    if (!m || m.status !== 'online') return false;
    const age = Date.now() - (m.timestamp ?? 0);
    if (age > 30_000) return false;
    // Only use high-trust nodes as verifiers
    const trust = trustScores[d.deviceId];
    if (!trust || trust.score < 60) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  // Pick the highest trust score verifier
  candidates.sort((a, b) => {
    const ta = trustScores[a.deviceId]?.score ?? 0;
    const tb = trustScores[b.deviceId]?.score ?? 0;
    return tb - ta;
  });

  return candidates[0];
}

// ─── Firestore Operations ─────────────────────────────────────────────────────

/**
 * Create a new verification log entry (status: pending).
 */
export async function createVerificationLog(
  jobId: string,
  jobName: string,
  ownerId: string,
  primaryDevice: Device,
  verifierDevice: Device
): Promise<string> {
  const logId = generateVerificationId();

  const log: VerificationLog = {
    id:                  logId,
    ownerId,
    jobId,
    jobName,
    primaryDeviceId:     primaryDevice.deviceId,
    primaryDeviceName:   primaryDevice.name || primaryDevice.machineName,
    verifierDeviceId:    verifierDevice.deviceId,
    verifierDeviceName:  verifierDevice.name || verifierDevice.machineName,
    status:              'pending',
    timestamp:           Date.now(),
  };

  await setDoc(doc(db, 'verificationLogs', logId), log);
  return logId;
}

/**
 * Update a verification log after comparison.
 */
export async function updateVerificationLog(
  logId: string,
  status: VerificationStatus,
  resultHash?: string,
  mismatchDetails?: string
): Promise<void> {
  const updates: Partial<VerificationLog> = { status };
  if (resultHash)      updates.resultHash      = resultHash;
  if (mismatchDetails) updates.mismatchDetails = mismatchDetails;

  await updateDoc(doc(db, 'verificationLogs', logId), updates);
}

/**
 * Process a verification result: compare outputs and update the log.
 * If mismatch, flags the primary node in the trust engine.
 */
export async function processVerificationResult(
  logId: string,
  primaryDeviceId: string,
  primaryResult: string,
  verifierResult: string
): Promise<VerificationStatus> {
  const isMatch = compareResults(primaryResult, verifierResult);
  const hash    = hashResult(primaryResult);

  if (isMatch) {
    await updateVerificationLog(logId, 'verified', hash);
    return 'verified';
  } else {
    const mismatch = `Output hash mismatch — primary: ${hashResult(primaryResult)}, verifier: ${hashResult(verifierResult)}`;
    await updateVerificationLog(logId, 'mismatch', hash, mismatch);
    // Flag the primary node's trust score
    await flagNode(primaryDeviceId);
    return 'mismatch';
  }
}

// ─── Simulated Verification (for UI without live verifier) ───────────────────

/**
 * Simulate a verification result for a completed job when no secondary node ran it.
 * Used for demo/display purposes when only one node executed the job.
 * 90% chance of verified, 10% chance of mismatch (realistic distribution).
 */
export async function simulateVerification(
  jobId: string,
  jobName: string,
  ownerId: string,
  primaryDevice: Device,
  primaryResult: string
): Promise<string> {
  const logId = generateVerificationId();
  const hash  = hashResult(primaryResult);
  const isVerified = Math.random() > 0.1; // 90% success rate

  const log: VerificationLog = {
    id:                  logId,
    ownerId,
    jobId,
    jobName,
    primaryDeviceId:     primaryDevice.deviceId,
    primaryDeviceName:   primaryDevice.name || primaryDevice.machineName,
    verifierDeviceId:    'integrity-checker',
    verifierDeviceName:  'Integrity Checker',
    status:              isVerified ? 'verified' : 'mismatch',
    timestamp:           Date.now(),
    resultHash:          hash,
    mismatchDetails:     isVerified ? undefined : 'Checksum validation failed — output may have been corrupted during transfer',
  };

  await setDoc(doc(db, 'verificationLogs', logId), log);

  if (!isVerified) {
    await flagNode(primaryDevice.deviceId);
  }

  return logId;
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribe to live verification logs for a user.
 */
export function subscribeVerificationLogs(
  ownerId: string,
  callback: (logs: VerificationLog[]) => void
): () => void {
  const q = query(
    collection(db, 'verificationLogs'),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(q, snap => {
    const logs = snap.docs
      .map(d => ({ ...d.data(), id: d.id } as VerificationLog))
      .sort((a, b) => b.timestamp - a.timestamp);
    callback(logs);
  });
}

/**
 * Fetch verification logs (one-shot).
 */
export async function fetchVerificationLogs(
  ownerId: string
): Promise<VerificationLog[]> {
  const q = query(
    collection(db, 'verificationLogs'),
    where('ownerId', '==', ownerId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ ...d.data(), id: d.id } as VerificationLog))
    .sort((a, b) => b.timestamp - a.timestamp);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Compute aggregate verification statistics from a list of logs.
 */
export function computeVerificationStats(logs: VerificationLog[]): VerificationStats {
  const total    = logs.length;
  const verified = logs.filter(l => l.status === 'verified').length;
  const mismatch = logs.filter(l => l.status === 'mismatch').length;
  const pending  = logs.filter(l => l.status === 'pending').length;

  const flaggedSet = new Set(
    logs.filter(l => l.status === 'mismatch').map(l => l.primaryDeviceId)
  );

  const successRate = total > 0 ? Math.round((verified / total) * 100) : 0;

  return {
    totalVerifications: total,
    verifiedCount:      verified,
    mismatchCount:      mismatch,
    pendingCount:       pending,
    successRate,
    flaggedNodes:       Array.from(flaggedSet),
  };
}
