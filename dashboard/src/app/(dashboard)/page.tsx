'use client';

import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import {
  Monitor, Cpu, MemoryStick, Zap, Activity, AlertTriangle,
  Server, Network, Briefcase, CheckCircle, ShieldCheck, ShieldAlert,
  ShieldX, RefreshCw, Eye, CheckCircle2, XCircle
} from 'lucide-react';
import { MetricGauge } from '@/components/charts/MetricGauge';
import { getTrustLevel, getTrustColor, getTrustHexColor, computeTrustEngineStats } from '@/lib/trust';
import { computeRecoveryStats, formatRecoveryTime } from '@/lib/recovery';
import { computeVerificationStats } from '@/lib/verification';
import Link from 'next/link';

export default function DashboardPage() {
  const { devices, metricsMap, clusters, jobs, trustScores, recoveryEvents, verificationLogs } = useAppStore();
  const onlineDevices = devices.filter(d => metricsMap[d.deviceId]?.status === 'online');
  const offlineDevices = devices.filter(d => metricsMap[d.deviceId]?.status !== 'online');

  // Aggregate stats
  const totalCpu = onlineDevices.length > 0
    ? onlineDevices.reduce((acc, d) => acc + (metricsMap[d.deviceId]?.cpu.total || 0), 0) / onlineDevices.length
    : 0;
  const totalRamPercent = onlineDevices.length > 0
    ? onlineDevices.reduce((acc, d) => acc + (metricsMap[d.deviceId]?.ram.usedPercent || 0), 0) / onlineDevices.length
    : 0;
  const totalGpu = onlineDevices.length > 0
    ? onlineDevices.reduce((acc, d) => acc + (metricsMap[d.deviceId]?.gpu.usagePercent || 0), 0) / onlineDevices.length
    : 0;

  const runningJobs = jobs.filter(j => j.status === 'running').length;
  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const failedJobs = jobs.filter(j => j.status === 'failed').length;

  const kpis = [
    {
      label: 'Online Devices',
      value: onlineDevices.length,
      total: devices.length,
      icon: Monitor,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
    },
    {
      label: 'Avg CPU Load',
      value: `${totalCpu.toFixed(1)}%`,
      icon: Cpu,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      warn: totalCpu > 85,
    },
    {
      label: 'Avg RAM Usage',
      value: `${totalRamPercent.toFixed(1)}%`,
      icon: MemoryStick,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      warn: totalRamPercent > 90,
    },
    {
      label: 'Avg GPU Load',
      value: `${totalGpu.toFixed(1)}%`,
      icon: Zap,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
    },
    {
      label: 'Running Jobs',
      value: runningJobs,
      icon: Activity,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
    },
    {
      label: 'Clusters',
      value: clusters.length,
      icon: Network,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time overview of your distributed infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live — updates every 5s
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className={`glass-card p-4 border ${kpi.border} hover-card`}
          >
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} border ${kpi.border} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
            </div>
            <div className="flex items-end gap-1">
              <div className={`text-2xl font-bold text-white tabular-nums ${kpi.warn ? 'text-red-400' : ''}`}>
                {kpi.value}
              </div>
              {kpi.total !== undefined && (
                <div className="text-slate-500 text-sm mb-0.5">/{kpi.total}</div>
              )}
            </div>
            <div className="text-slate-400 text-xs mt-1">{kpi.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Middle row: Gauges + Device list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System gauges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-green-400" />
            Cluster Average Metrics
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <MetricGauge value={totalCpu} label="CPU" color="#3b82f6" />
            <MetricGauge value={totalRamPercent} label="RAM" color="#8b5cf6" />
            <MetricGauge value={totalGpu} label="GPU" color="#f59e0b" />
          </div>
        </motion.div>

        {/* Online Devices */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.4 }}
          className="glass-card p-6 lg:col-span-2"
        >
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Monitor className="w-4 h-4 text-green-400" />
            Device Status
            <span className="ml-auto text-xs text-slate-500">{devices.length} total</span>
          </h2>

          {devices.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Monitor className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No devices paired yet</p>
              <p className="text-xs mt-1">Go to Devices → Add Device</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {devices.map(device => {
                const metrics = metricsMap[device.deviceId];
                const online = metrics?.status === 'online';
                return (
                  <div key={device.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-900/40">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-green-400 shadow-[0_0_6px_#22c55e]' : 'bg-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{device.name || device.machineName}</div>
                      <div className="text-xs text-slate-500">{device.deviceId}</div>
                    </div>
                    {online && metrics && (
                      <div className="flex gap-3 text-xs font-mono text-slate-400">
                        <span>{metrics.cpu.total.toFixed(0)}%</span>
                        <span>{metrics.ram.usedPercent.toFixed(0)}%</span>
                      </div>
                    )}
                    <div className={`text-xs px-2 py-0.5 rounded-full ${online ? 'bg-green-500/10 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                      {online ? 'online' : 'offline'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom row: Jobs summary + Load alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.48, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-green-400" />
            Job Queue Status
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Running', value: runningJobs, color: 'text-blue-400', bg: 'bg-blue-500/10' },
              { label: 'Completed', value: completedJobs, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Failed', value: failedJobs, color: 'text-red-400', bg: 'bg-red-500/10' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg ${item.bg} p-3 text-center`}>
                <div className={`text-2xl font-bold ${item.color} tabular-nums`}>{item.value}</div>
                <div className="text-xs text-slate-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Load alerts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, duration: 0.4 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-green-400" />
            Load Intelligence
          </h2>
          {onlineDevices.length === 0 ? (
            <p className="text-slate-500 text-sm">No devices online to analyze</p>
          ) : (
            <div className="space-y-2">
              {onlineDevices
                .filter(d => {
                  const m = metricsMap[d.deviceId];
                  return m && (m.cpu.total > 85 || m.ram.usedPercent > 90);
                })
                .slice(0, 4)
                .map(device => {
                  const m = metricsMap[device.deviceId];
                  if (!m) return null;

                  // Find lowest loaded device
                  const lowestDevice = onlineDevices
                    .filter(d => d.deviceId !== device.deviceId)
                    .sort((a, b) =>
                      (metricsMap[a.deviceId]?.cpu.total || 0) -
                      (metricsMap[b.deviceId]?.cpu.total || 0)
                    )[0];

                  return (
                    <div key={device.id} className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <span className="text-white font-medium">{device.name || device.machineName}</span>
                        <span className="text-slate-400"> is overloaded (CPU: {m.cpu.total.toFixed(0)}%)</span>
                        {lowestDevice && (
                          <div className="text-slate-500 mt-0.5">
                            → Recommend routing to <span className="text-green-400">{lowestDevice.name || lowestDevice.machineName}</span> ({(metricsMap[lowestDevice.deviceId]?.cpu.total || 0).toFixed(0)}% CPU)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

              {onlineDevices.every(d => {
                const m = metricsMap[d.deviceId];
                return !m || (m.cpu.total <= 85 && m.ram.usedPercent <= 90);
              }) && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  All systems operating normally
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Trust & Recovery Engine Widgets ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Widget 1: Node Trust Overview */}
        {(() => {
          const trustList = Object.values(trustScores).sort((a, b) => b.score - a.score).slice(0, 4);
          const stats = computeTrustEngineStats(trustScores);
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.60, duration: 0.4 }}
              className="glass-card p-5 border border-green-500/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                  Node Trust Overview
                </h2>
                <Link href="/trust" className="text-[10px] text-green-400 hover:text-green-300 transition-colors">
                  View all →
                </Link>
              </div>

              {trustList.length === 0 ? (
                <div className="text-center py-6">
                  <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs">Computing trust scores…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trustList.map(trust => {
                    const level = getTrustLevel(trust.score);
                    const hexColor = getTrustHexColor(level);
                    return (
                      <div key={trust.deviceId} className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {level === 'high'   && <ShieldCheck className="w-3.5 h-3.5 text-green-400" />}
                          {level === 'medium' && <ShieldAlert className="w-3.5 h-3.5 text-yellow-400" />}
                          {level === 'low'    && <ShieldX className="w-3.5 h-3.5 text-red-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">{trust.deviceName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${trust.score}%`, background: hexColor }}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-bold w-6 text-right" style={{ color: hexColor }}>
                              {trust.score}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
                    <span>Avg: <span className="text-white">{stats.avgTrustScore}</span></span>
                    <span>High: <span className="text-green-400">{stats.highTrustNodes}</span></span>
                    <span>Low: <span className="text-red-400">{stats.lowTrustNodes}</span></span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* Widget 2: Job Recovery */}
        {(() => {
          const recStats = computeRecoveryStats(recoveryEvents);
          const activeRecoveries = recoveryEvents.filter(r => r.status === 'active');
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.66, duration: 0.4 }}
              className="glass-card p-5 border border-blue-500/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  Job Recovery
                </h2>
                <Link href="/trust" className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Recovered',     value: recStats.successfulRecoveries, color: 'text-green-400',  bg: 'bg-green-500/10' },
                  { label: 'Active',        value: recStats.activeRecoveries,     color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                  { label: 'Avg Time',      value: formatRecoveryTime(recStats.avgRecoveryTimeMs), color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Success Rate',  value: `${recStats.successRate}%`,  color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-lg p-2.5 text-center`}>
                    <div className={`text-lg font-bold ${item.color} tabular-nums`}>{item.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {activeRecoveries.length > 0 ? (
                <div className="space-y-1">
                  {activeRecoveries.slice(0, 2).map(r => (
                    <div key={r.id} className="flex items-center gap-2 p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <RefreshCw className="w-3 h-3 text-yellow-400 animate-spin" />
                      <span className="text-[10px] text-yellow-300 truncate">Recovering: {r.jobName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  No active recoveries
                </div>
              )}
            </motion.div>
          );
        })()}

        {/* Widget 3: Verification Status */}
        {(() => {
          const verStats = computeVerificationStats(verificationLogs);
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.72, duration: 0.4 }}
              className="glass-card p-5 border border-purple-500/10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  Verification Status
                </h2>
                <Link href="/trust" className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors">
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Verified',       value: verStats.verifiedCount,  color: 'text-green-400',  bg: 'bg-green-500/10' },
                  { label: 'Failed Verify',  value: verStats.mismatchCount,  color: 'text-red-400',    bg: 'bg-red-500/10' },
                  { label: 'Flagged Nodes',  value: verStats.flaggedNodes.length, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'Success Rate',   value: `${verStats.successRate}%`, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-lg p-2.5 text-center`}>
                    <div className={`text-lg font-bold ${item.color} tabular-nums`}>{item.value}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.label}</div>
                  </div>
                ))}
              </div>

              {verStats.flaggedNodes.length > 0 ? (
                <div className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-red-300">{verStats.flaggedNodes.length} node(s) flagged for mismatch</span>
                </div>
              ) : verStats.totalVerifications > 0 ? (
                <div className="flex items-center gap-2 text-green-400 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All results verified ✓
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">No verifications performed yet</div>
              )}
            </motion.div>
          );
        })()}

      </div>
    </div>
  );
}
