import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Device, Cluster, Job, Command, UserProfile, SystemSnapshot, ProcessInfo, NodeTrustScore, JobRecoveryRecord, VerificationLog } from '@/types';
import type { TrustHistoryEntry } from '@/lib/trustHistory';

interface AppState {
  // Auth
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;

  // Devices
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;

  // Live metrics per device
  metricsMap: Record<string, SystemSnapshot>;
  setDeviceMetrics: (deviceId: string, metrics: SystemSnapshot) => void;

  // Processes per device
  processesMap: Record<string, ProcessInfo[]>;
  setDeviceProcesses: (deviceId: string, processes: ProcessInfo[]) => void;

  // Clusters
  clusters: Cluster[];
  setClusters: (clusters: Cluster[]) => void;

  // Jobs
  jobs: Job[];
  setJobs: (jobs: Job[]) => void;

  // Commands
  commands: Command[];
  setCommands: (commands: Command[]) => void;

  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;

  // ── Trust & Recovery Engine ─────────────────────────────────────────────────
  /** Live trust scores per deviceId */
  trustScores: Record<string, NodeTrustScore>;
  setTrustScores: (scores: Record<string, NodeTrustScore>) => void;
  updateTrustScore: (deviceId: string, score: NodeTrustScore) => void;

  /** Job recovery event records */
  recoveryEvents: JobRecoveryRecord[];
  setRecoveryEvents: (events: JobRecoveryRecord[]) => void;

  /** Result verification logs */
  verificationLogs: VerificationLog[];
  setVerificationLogs: (logs: VerificationLog[]) => void;

  /** Trust score time-series history for analytics */
  trustHistory: TrustHistoryEntry[];
  setTrustHistory: (entries: TrustHistoryEntry[]) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Auth
      user: null,
      setUser: (user) => set({ user }),

      // Devices
      devices: [],
      setDevices: (devices) => set({ devices }),
      updateDevice: (id, updates) => set(state => ({
        devices: state.devices.map(d => d.id === id ? { ...d, ...updates } : d)
      })),

      // Live metrics
      metricsMap: {},
      setDeviceMetrics: (deviceId, metrics) => set(state => ({
        metricsMap: { ...state.metricsMap, [deviceId]: metrics }
      })),

      // Processes
      processesMap: {},
      setDeviceProcesses: (deviceId, processes) => set(state => ({
        processesMap: { ...state.processesMap, [deviceId]: processes }
      })),

      // Clusters
      clusters: [],
      setClusters: (clusters) => set({ clusters }),

      // Jobs
      jobs: [],
      setJobs: (jobs) => set({ jobs }),

      // Commands
      commands: [],
      setCommands: (commands) => set({ commands }),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      selectedDeviceId: null,
      setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),

      // ── Trust & Recovery Engine ───────────────────────────────────────────────
      trustScores: {},
      setTrustScores: (trustScores) => set({ trustScores }),
      updateTrustScore: (deviceId, score) => set(state => ({
        trustScores: { ...state.trustScores, [deviceId]: score }
      })),

      recoveryEvents: [],
      setRecoveryEvents: (recoveryEvents) => set({ recoveryEvents }),

      verificationLogs: [],
      setVerificationLogs: (verificationLogs) => set({ verificationLogs }),

      trustHistory: [],
      setTrustHistory: (trustHistory) => set({ trustHistory }),
    }),
    { name: 'ClusterOS' }
  )
);


// Derived selectors
export const selectOnlineDevices = (state: AppState) =>
  state.devices.filter(d => {
    const m = state.metricsMap[d.deviceId];
    return m?.status === 'online' && (Date.now() - (m.timestamp ?? 0)) < 15000;
  });

export const selectOfflineDevices = (state: AppState) =>
  state.devices.filter(d => {
    const m = state.metricsMap[d.deviceId];
    return !m || m.status !== 'online' || (Date.now() - (m.timestamp ?? 0)) >= 15000;
  });

export const selectClusterStats = (clusterId: string) => (state: AppState) => {
  const cluster = state.clusters.find(c => c.id === clusterId);
  if (!cluster) return null;

  const clusterDevices = state.devices.filter(d => cluster.deviceIds.includes(d.deviceId));
  const onlineCount = clusterDevices.filter(d => {
    const m = state.metricsMap[d.deviceId];
    return m?.status === 'online' && (Date.now() - (m.timestamp ?? 0)) < 15000;
  }).length;

  let totalCpu = 0, totalRam = 0, usedRam = 0, totalGpu = 0;

  for (const device of clusterDevices) {
    const m = state.metricsMap[device.deviceId];
    if (m) {
      totalCpu += m.cpu.total;
      totalRam += m.ram.total;
      usedRam += m.ram.used;
      totalGpu += m.gpu.usagePercent;
    }
  }

  return {
    totalDevices: clusterDevices.length,
    onlineDevices: onlineCount,
    avgCpuPercent: clusterDevices.length ? totalCpu / clusterDevices.length : 0,
    totalRamGB: totalRam,
    usedRamGB: usedRam,
    avgGpuPercent: clusterDevices.length ? totalGpu / clusterDevices.length : 0,
  };
};
