'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, Legend, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { BarChart3, Cpu, MemoryStick, Zap, Activity, TrendingUp, ShieldCheck, RefreshCw, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeTrustEngineStats, getTrustHexColor, getTrustLevel } from '@/lib/trust';
import { computeRecoveryStats, formatRecoveryTime } from '@/lib/recovery';
import { computeVerificationStats } from '@/lib/verification';
import { buildTrustHistoryChartData, getDeviceNamesFromHistory } from '@/lib/trustHistory';

export default function AnalyticsPage() {
  const { devices, metricsMap, jobs, commands, trustScores, recoveryEvents, verificationLogs, trustHistory } = useAppStore();

  const onlineDevices = devices.filter(d => metricsMap[d.deviceId]?.status === 'online');

  // Current device load comparison
  const deviceLoadData = onlineDevices.map(d => {
    const m = metricsMap[d.deviceId];
    return {
      name: (d.name || d.machineName || d.deviceId).slice(0, 12),
      cpu: m?.cpu?.total !== undefined ? Number(m.cpu.total.toFixed(1)) : 0,
      ram: m?.ram?.usedPercent !== undefined ? Number(m.ram.usedPercent.toFixed(1)) : 0,
      gpu: m?.gpu?.usagePercent !== undefined ? Number(m.gpu.usagePercent.toFixed(1)) : 0,
    };
  });

  // Job status distribution
  const jobStats = [
    { name: 'Completed', value: jobs.filter(j => j.status === 'completed').length, color: '#22c55e' },
    { name: 'Running', value: jobs.filter(j => j.status === 'running').length, color: '#3b82f6' },
    { name: 'Queued', value: jobs.filter(j => j.status === 'queued').length, color: '#f59e0b' },
    { name: 'Failed', value: jobs.filter(j => j.status === 'failed').length, color: '#ef4444' },
  ];

  // Command success rate
  const cmdSuccess = commands.filter(c => c.status === 'success').length;
  const cmdFailed = commands.filter(c => c.status === 'failed').length;
  const cmdSuccessRate = commands.length > 0 ? (cmdSuccess / commands.length * 100).toFixed(1) : 0;

  // Simulated temperature trend (real app would store historical data)
  const tempTrend = onlineDevices.slice(0, 5).map(d => ({
    name: (d.name || d.deviceId).slice(0, 10),
    cpu: metricsMap[d.deviceId]?.temperatures?.cpu?.toFixed(1) || 0,
    gpu: metricsMap[d.deviceId]?.temperatures?.gpu?.toFixed(1) || 0,
  }));

  const CustomTooltipStyle = {
    contentStyle: {
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: '8px',
      fontSize: '12px',
      color: '#f8fafc'
    },
    labelStyle: { color: '#94a3b8' }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 text-sm mt-0.5">Performance insights across your cluster</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Commands', value: commands.length, icon: Activity, color: 'text-blue-400' },
          { label: 'Success Rate', value: `${cmdSuccessRate}%`, icon: TrendingUp, color: 'text-green-400' },
          { label: 'Total Jobs', value: jobs.length, icon: BarChart3, color: 'text-purple-400' },
          { label: 'Online Devices', value: onlineDevices.length, icon: Cpu, color: 'text-orange-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-4"
          >
            <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-white tabular-nums">{stat.value}</div>
            <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Device Load Comparison */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-green-400" />
          Device Load Comparison (Current)
        </h2>
        {deviceLoadData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
            No online devices to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deviceLoadData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <Tooltip {...CustomTooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '8px' }}
              />
              <Bar dataKey="cpu" name="CPU %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="ram" name="RAM %" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="gpu" name="GPU %" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job stats */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-400" />
            Job Distribution
          </h2>
          <div className="space-y-3">
            {jobStats.map(stat => (
              <div key={stat.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">{stat.name}</span>
                  <span className="text-xs font-mono text-slate-300">{stat.value}</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: jobs.length > 0 ? `${(stat.value / jobs.length) * 100}%` : '0%',
                      background: stat.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-400" />
            Device Temperatures (°C)
          </h2>
          {tempTrend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No temperature data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tempTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="°" />
                <Tooltip {...CustomTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8', paddingTop: '8px' }} />
                <Bar dataKey="cpu" name="CPU °C" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="gpu" name="GPU °C" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────── */}
      {/* Reliability Intelligence Section */}
      {/* ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="border-t border-slate-800 pt-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Reliability Intelligence</h2>
            <p className="text-slate-400 text-xs">Node Trust & Job Recovery Engine analytics</p>
          </div>
        </div>

        {/* Reliability KPIs */}
        {(() => {
          const trustStats = computeTrustEngineStats(trustScores);
          const recStats   = computeRecoveryStats(recoveryEvents);
          const verStats   = computeVerificationStats(verificationLogs);
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Avg Trust Score',      value: trustStats.avgTrustScore, color: 'text-green-400',  icon: ShieldCheck },
                { label: 'Recovery Success',      value: `${recStats.successRate}%`, color: 'text-blue-400',   icon: RefreshCw },
                { label: 'Verification Rate',     value: `${verStats.successRate}%`, color: 'text-purple-400', icon: Eye },
                { label: 'Avg Recovery Time',     value: formatRecoveryTime(recStats.avgRecoveryTimeMs), color: 'text-yellow-400', icon: Activity },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="glass-card p-4"
                >
                  <stat.icon className={`w-4 h-4 ${stat.color} mb-2`} />
                  <div className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          );
        })()}

        {/* Trust Score Distribution + Recovery Stats side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Trust Score by Node (bar chart) */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              Node Trust Scores
            </h3>
            {Object.values(trustScores).length === 0 ? (
              <div className="h-44 flex items-center justify-center text-slate-500 text-sm">
                No trust scores computed yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={Object.values(trustScores)
                    .sort((a, b) => b.score - a.score)
                    .map(t => ({
                      name: t.deviceName.slice(0, 10),
                      score: t.score,
                      fill: getTrustHexColor(getTrustLevel(t.score)),
                    }))}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip {...CustomTooltipStyle} />
                  <Bar dataKey="score" name="Trust Score" radius={[3, 3, 0, 0]}>
                    {Object.values(trustScores)
                      .sort((a, b) => b.score - a.score)
                      .map((t, i) => (
                        <Cell key={i} fill={getTrustHexColor(getTrustLevel(t.score))} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Trust Level Pie + Recovery pie side by side */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-400" />
              Trust Distribution & Recovery Overview
            </h3>
            {(() => {
              const ts = computeTrustEngineStats(trustScores);
              const rs = computeRecoveryStats(recoveryEvents);
              const trustPie = [
                { name: 'High Trust',   value: ts.highTrustNodes,          fill: '#22c55e' },
                { name: 'Medium Trust', value: ts.mediumTrustNodes,        fill: '#eab308' },
                { name: 'Low Trust',    value: ts.lowTrustNodes,           fill: '#ef4444' },
              ].filter(d => d.value > 0);
              const recPie = [
                { name: 'Recovered', value: rs.successfulRecoveries, fill: '#22c55e' },
                { name: 'Active',    value: rs.activeRecoveries,     fill: '#eab308' },
                { name: 'Failed',    value: rs.failedRecoveries,     fill: '#ef4444' },
              ].filter(d => d.value > 0);

              if (ts.totalNodes === 0 && rs.totalRecoveries === 0) {
                return <div className="h-44 flex items-center justify-center text-slate-500 text-sm">No data yet</div>;
              }

              return (
                <div className="flex gap-4 h-44">
                  {trustPie.length > 0 && (
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-500 text-center mb-1">Trust Levels</div>
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie data={trustPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                            {trustPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                          </Pie>
                          <Tooltip {...CustomTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {recPie.length > 0 && (
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-500 text-center mb-1">Recoveries</div>
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie data={recPie} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value">
                            {recPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                          </Pie>
                          <Tooltip {...CustomTooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Recent Verification Logs Table */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-400" />
            Recent Verification Logs
            <span className="ml-auto text-xs text-slate-500">{verificationLogs.length} total</span>
          </h3>
          {verificationLogs.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-sm">No verification logs yet</div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-3 px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider">
                <div className="col-span-3">Job</div>
                <div className="col-span-3">Primary Node</div>
                <div className="col-span-3">Verifier</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Time</div>
              </div>
              {verificationLogs.slice(0, 10).map((log, i) => (
                <div key={log.id ?? i} className="grid grid-cols-12 gap-3 px-3 py-2 rounded-lg bg-slate-900/40 items-center">
                  <div className="col-span-3 text-xs text-white truncate">{log.jobName}</div>
                  <div className="col-span-3 text-xs text-slate-400 truncate">{log.primaryDeviceName}</div>
                  <div className="col-span-3 text-xs text-slate-400 truncate">{log.verifierDeviceName}</div>
                  <div className="col-span-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      log.status === 'verified'  ? 'bg-green-500/15 text-green-400'
                      : log.status === 'mismatch' ? 'bg-red-500/15 text-red-400'
                      : log.status === 'pending'  ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-slate-800 text-slate-400'
                    }`}>{log.status.toUpperCase()}</span>
                  </div>
                  <div className="col-span-1 text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Failure History */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Failure & Recovery History
          </h3>
          {recoveryEvents.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
              No failure events recorded — all jobs ran successfully
            </div>
          ) : (
            <div className="space-y-2">
              {recoveryEvents.slice(0, 6).map((rec, i) => (
                <div key={rec.id ?? i} className="flex items-center gap-4 px-3 py-2 rounded-lg bg-slate-900/40">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    rec.status === 'recovered' ? 'bg-green-400' : rec.status === 'active' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{rec.jobName}</div>
                    <div className="text-[10px] text-slate-500">
                      {rec.originalDeviceName} → {rec.recoveredDeviceName ?? 'no replacement found'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className={`font-semibold ${
                      rec.status === 'recovered' ? 'text-green-400' : rec.status === 'active' ? 'text-yellow-400' : 'text-red-400'
                    }`}>{rec.status}</span>
                    {rec.recoveryTimeMs && <span>{formatRecoveryTime(rec.recoveryTimeMs)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trust History Time-Series Chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            Trust Score History
            <span className="ml-auto text-xs text-slate-500">{trustHistory.length} snapshots</span>
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">Trust score trend per node over time (updated every 30 seconds)</p>
          {trustHistory.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <ShieldCheck className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                No history yet — scores will be recorded as nodes stay online
              </div>
            </div>
          ) : (() => {
            const chartData    = buildTrustHistoryChartData(trustHistory);
            const deviceNames  = getDeviceNamesFromHistory(trustHistory);
            const LINE_COLORS  = ['#22c55e','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316'];
            return (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px', color: '#f8fafc' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }} />
                  {deviceNames.map((name, i) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={LINE_COLORS[i % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>

        {/* Recovery Logs Detail Table */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-400" />
            Recovery Logs
            <span className="ml-auto text-xs text-slate-500">{recoveryEvents.length} events</span>
          </h3>
          {recoveryEvents.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-slate-500 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400 mr-2" />
              No recovery events — all jobs completed without node failure
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 gap-3 px-3 py-1.5 text-[10px] text-slate-500 uppercase tracking-wider">
                <div className="col-span-3">Job</div>
                <div className="col-span-2">Failed Node</div>
                <div className="col-span-2">Recovery Node</div>
                <div className="col-span-2">Progress</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Time</div>
              </div>
              {recoveryEvents.slice(0, 12).map((rec, i) => (
                <div key={rec.id ?? i} className="grid grid-cols-12 gap-3 px-3 py-2 rounded-lg bg-slate-900/40 items-center">
                  <div className="col-span-3 text-xs text-white truncate font-medium">{rec.jobName}</div>
                  <div className="col-span-2 text-[10px] text-slate-400 truncate">{rec.originalDeviceName}</div>
                  <div className="col-span-2 text-[10px] text-green-400 truncate">{rec.recoveredDeviceName ?? '—'}</div>
                  <div className="col-span-2">
                    {rec.progressAtFailure != null ? (
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${rec.progressAtFailure}%` }} />
                        </div>
                        <span className="text-[10px] text-amber-400">{rec.progressAtFailure}%</span>
                      </div>
                    ) : <span className="text-[10px] text-slate-600">—</span>}
                  </div>
                  <div className="col-span-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      rec.status === 'recovered' ? 'bg-green-500/15 text-green-400'
                      : rec.status === 'active'  ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-red-500/15 text-red-400'
                    }`}>{rec.status.toUpperCase()}</span>
                  </div>
                  <div className="col-span-1 text-[10px] text-slate-500">
                    {rec.recoveryTimeMs ? formatRecoveryTime(rec.recoveryTimeMs) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </motion.div>
    </div>
  );
}
