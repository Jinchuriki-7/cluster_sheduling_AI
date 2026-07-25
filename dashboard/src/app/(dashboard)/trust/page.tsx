'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/store/appStore';
import {
  ShieldCheck, ShieldAlert, ShieldX, RefreshCw, CheckCircle2,
  XCircle, AlertTriangle, Clock, Zap, TrendingUp, TrendingDown,
  Activity, Server, Search, ChevronRight, RotateCcw, Eye
} from 'lucide-react';
import { getTrustLevel, getTrustColor, getTrustBg, getTrustHexColor, computeTrustEngineStats } from '@/lib/trust';
import { computeRecoveryStats, formatRecoveryTime } from '@/lib/recovery';
import { computeVerificationStats } from '@/lib/verification';
import { NodeTrustDetailPanel } from '@/components/NodeTrustDetailPanel';
import type { TrustLevel, NodeTrustScore, JobRecoveryRecord, VerificationLog } from '@/types';

// ─── Utility ──────────────────────────────────────────────────────────────────

function trustIcon(level: TrustLevel) {
  if (level === 'high')   return <ShieldCheck className="w-4 h-4 text-green-400" />;
  if (level === 'medium') return <ShieldAlert className="w-4 h-4 text-yellow-400" />;
  return <ShieldX className="w-4 h-4 text-red-400" />;
}

function TrustBar({ score }: { score: number }) {
  const level  = getTrustLevel(score);
  const color  = level === 'high' ? '#22c55e' : level === 'medium' ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
      <span className="text-xs font-mono font-bold w-8 text-right"
        style={{ color }}>{score}</span>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color, border,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; border: string;
}) {
  return (
    <div className={`glass-card p-5 border ${border}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color} tabular-nums`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function RecoveryFlowDiagram({ record }: { record: JobRecoveryRecord }) {
  const steps = [
    { label: 'Running Job',            done: true },
    { label: 'Failure Detected',       done: true },
    { label: 'Checkpoint Saved',       done: !!record.checkpointAt },
    { label: 'Node Selected',          done: !!record.recoveredDeviceId },
    { label: 'Continuing Work',        done: record.status === 'recovered' || record.status === 'active' },
    { label: 'Job Completed',          done: record.status === 'recovered' },
  ];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
            step.done
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-slate-800 text-slate-500 border border-slate-700'
          }`}>
            {step.done
              ? <CheckCircle2 className="w-3 h-3" />
              : <Clock className="w-3 h-3" />}
            {step.label}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'trust' | 'recovery' | 'verification';

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'trust',        label: 'Node Trust Overview',  icon: ShieldCheck },
  { id: 'recovery',     label: 'Job Recovery',          icon: RefreshCw },
  { id: 'verification', label: 'Verification Status',   icon: Eye },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrustRecoveryPage() {
  const { trustScores, recoveryEvents, verificationLogs, devices } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('trust');
  const [searchQuery, setSearchQuery]   = useState('');
  const [selectedTrust, setSelectedTrust] = useState<NodeTrustScore | null>(null);

  const trustList  = useMemo(() => Object.values(trustScores), [trustScores]);
  const trustStats = useMemo(() => computeTrustEngineStats(trustScores), [trustScores]);
  const recStats   = useMemo(() => computeRecoveryStats(recoveryEvents), [recoveryEvents]);
  const verStats   = useMemo(() => computeVerificationStats(verificationLogs), [verificationLogs]);

  const filteredTrust = useMemo(() =>
    trustList.filter(t => t.deviceName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.score - a.score),
    [trustList, searchQuery]
  );

  const filteredRecovery = useMemo(() =>
    recoveryEvents.filter(r =>
      r.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.originalDeviceName.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [recoveryEvents, searchQuery]
  );

  const filteredVerification = useMemo(() =>
    verificationLogs.filter(l =>
      l.jobName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.primaryDeviceName.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [verificationLogs, searchQuery]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-green-400" />
            Node Trust & Job Recovery Engine
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Reliability, fault tolerance, and result verification for distributed computing
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Trust engine active
        </div>
      </motion.div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard
            label="Avg Trust Score"
            value={trustStats.avgTrustScore}
            sub={`${trustStats.totalNodes} nodes evaluated`}
            icon={ShieldCheck}
            color={trustStats.avgTrustScore >= 75 ? 'text-green-400' : trustStats.avgTrustScore >= 40 ? 'text-yellow-400' : 'text-red-400'}
            border={trustStats.avgTrustScore >= 75 ? 'border-green-500/20' : trustStats.avgTrustScore >= 40 ? 'border-yellow-500/20' : 'border-red-500/20'}
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard
            label="Recovery Success Rate"
            value={`${recStats.successRate}%`}
            sub={`${recStats.successfulRecoveries}/${recStats.totalRecoveries} recovered`}
            icon={RefreshCw}
            color="text-blue-400"
            border="border-blue-500/20"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <StatCard
            label="Verification Rate"
            value={`${verStats.successRate}%`}
            sub={`${verStats.verifiedCount}/${verStats.totalVerifications} verified`}
            icon={CheckCircle2}
            color="text-purple-400"
            border="border-purple-500/20"
          />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
          <StatCard
            label="Flagged Nodes"
            value={verStats.flaggedNodes.length}
            sub={`${trustStats.lowTrustNodes} low-trust nodes`}
            icon={AlertTriangle}
            color={verStats.flaggedNodes.length > 0 ? 'text-red-400' : 'text-green-400'}
            border={verStats.flaggedNodes.length > 0 ? 'border-red-500/20' : 'border-green-500/20'}
          />
        </motion.div>
      </div>

      {/* Trust Level Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card p-5"
      >
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-400" />
          Trust Distribution Across Cluster
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'High Trust',   value: trustStats.highTrustNodes,   color: '#22c55e', bg: 'bg-green-500/10',  desc: 'Score ≥ 75' },
            { label: 'Medium Trust', value: trustStats.mediumTrustNodes, color: '#eab308', bg: 'bg-yellow-500/10', desc: 'Score 40–74' },
            { label: 'Low Trust',    value: trustStats.lowTrustNodes,    color: '#ef4444', bg: 'bg-red-500/10',    desc: 'Score < 40' },
          ].map(item => (
            <div key={item.label} className={`${item.bg} rounded-xl p-4 text-center border border-white/5`}>
              <div className="text-3xl font-bold tabular-nums" style={{ color: item.color }}>
                {item.value}
              </div>
              <div className="text-white text-sm font-medium mt-1">{item.label}</div>
              <div className="text-slate-500 text-xs mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
        {trustStats.totalNodes > 0 && (
          <div className="mt-4 flex rounded-full overflow-hidden h-3">
            {trustStats.highTrustNodes > 0 && (
              <div
                className="bg-green-500 transition-all duration-700"
                style={{ width: `${(trustStats.highTrustNodes / trustStats.totalNodes) * 100}%` }}
              />
            )}
            {trustStats.mediumTrustNodes > 0 && (
              <div
                className="bg-yellow-500 transition-all duration-700"
                style={{ width: `${(trustStats.mediumTrustNodes / trustStats.totalNodes) * 100}%` }}
              />
            )}
            {trustStats.lowTrustNodes > 0 && (
              <div
                className="bg-red-500 transition-all duration-700"
                style={{ width: `${(trustStats.lowTrustNodes / trustStats.totalNodes) * 100}%` }}
              />
            )}
            {trustStats.totalNodes === 0 && (
              <div className="bg-slate-700 w-full" />
            )}
          </div>
        )}
      </motion.div>

      {/* Tabs + Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.30 }}
        className="glass-card overflow-hidden"
      >
        {/* Tab Bar */}
        <div className="flex items-center border-b border-slate-800">
          <div className="flex flex-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSearchQuery(''); }}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                  activeTab === tab.id
                    ? 'border-green-400 text-green-400 bg-green-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter..."
                className="pl-9 pr-4 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-green-500/40 w-40"
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">

          {/* ── Tab 1: Node Trust Overview ──────────────────────────────────── */}
          {activeTab === 'trust' && (
            <motion.div
              key="trust"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              {filteredTrust.length === 0 ? (
                <div className="text-center py-16">
                  <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No trust scores computed yet</p>
                  <p className="text-slate-600 text-xs mt-1">Trust scores update every 30 seconds as devices connect</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header row */}
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Node</div>
                    <div className="col-span-4">Trust Score</div>
                    <div className="col-span-2 text-center">Level</div>
                    <div className="col-span-1 text-center">Jobs ✓</div>
                    <div className="col-span-1 text-center">Jobs ✗</div>
                    <div className="col-span-1 text-center">Status</div>
                  </div>

                  {filteredTrust.map((trust, i) => {
                    const level = getTrustLevel(trust.score);
                    const bgClass = trust.isFlagged
                      ? 'bg-red-500/5 border border-red-500/20'
                      : 'bg-slate-900/40';
                    const isSelected = selectedTrust?.deviceId === trust.deviceId;
                    return (
                      <motion.div
                        key={trust.deviceId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-xl ${bgClass} items-center cursor-pointer transition-all ${
                          isSelected ? 'ring-1 ring-green-500/40' : 'hover:bg-slate-800/60'
                        }`}
                        onClick={() => setSelectedTrust(isSelected ? null : trust)}
                      >
                        {/* Node Name */}
                        <div className="col-span-3 flex items-center gap-2">
                          {trustIcon(level)}
                          <div>
                            <div className="text-sm text-white font-medium truncate">{trust.deviceName}</div>
                            <div className="text-[10px] text-slate-500 truncate">{trust.deviceId.slice(0, 12)}…</div>
                          </div>
                        </div>

                        {/* Trust Bar */}
                        <div className="col-span-4">
                          <TrustBar score={trust.score} />
                        </div>

                        {/* Level Badge */}
                        <div className="col-span-2 flex justify-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTrustBg(level)} ${getTrustColor(level)}`}>
                            {level.toUpperCase()}
                          </span>
                        </div>

                        {/* Jobs completed */}
                        <div className="col-span-1 text-center text-xs text-green-400 font-mono font-bold">
                          {trust.totalJobsCompleted}
                        </div>

                        {/* Jobs failed */}
                        <div className="col-span-1 text-center text-xs text-red-400 font-mono font-bold">
                          {trust.totalJobsFailed}
                        </div>

                        {/* Flagged status */}
                        <div className="col-span-1 flex justify-center">
                          {trust.isFlagged ? (
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Expanded trust detail panel */}
                  <AnimatePresence>
                    {selectedTrust && (
                      <NodeTrustDetailPanel
                        trust={selectedTrust}
                        onClose={() => setSelectedTrust(null)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Scheduler guidance note */}
                  <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <p className="text-xs text-blue-300 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>The Intelligent Scheduler uses Trust Score (10% weight) when selecting nodes for workloads. Nodes scoring below 30 are soft-excluded from recovery assignments.</span>
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Tab 2: Job Recovery ─────────────────────────────────────────── */}
          {activeTab === 'recovery' && (
            <motion.div
              key="recovery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              {/* Recovery Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Recoveries',  value: recStats.totalRecoveries,      color: 'text-slate-300',  icon: RefreshCw },
                  { label: 'Successful',         value: recStats.successfulRecoveries, color: 'text-green-400',  icon: CheckCircle2 },
                  { label: 'Active Recovery',    value: recStats.activeRecoveries,     color: 'text-yellow-400', icon: Activity },
                  { label: 'Avg Recovery Time',  value: formatRecoveryTime(recStats.avgRecoveryTimeMs), color: 'text-blue-400', icon: Clock },
                ].map(item => (
                  <div key={item.label} className="bg-slate-900/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      <span className="text-[10px] text-slate-500">{item.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${item.color} tabular-nums`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Recovery List */}
              {filteredRecovery.length === 0 ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No recovery events recorded</p>
                  <p className="text-slate-600 text-xs mt-1">Recovery events appear automatically when a node fails during job execution</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRecovery.map((record, i) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`p-4 rounded-xl border ${
                        record.status === 'recovered' ? 'bg-green-500/5 border-green-500/20'
                        : record.status === 'active'  ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{record.jobName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Failure on <span className="text-slate-300">{record.originalDeviceName}</span>
                            {record.recoveredDeviceName && (
                              <> → recovered to <span className="text-green-400">{record.recoveredDeviceName}</span></>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            record.status === 'recovered' ? 'bg-green-500/15 text-green-400'
                            : record.status === 'active'  ? 'bg-yellow-500/15 text-yellow-400 animate-pulse'
                            : 'bg-red-500/15 text-red-400'
                          }`}>
                            {record.status.toUpperCase()}
                          </span>
                          {record.recoveryTimeMs && (
                            <span className="text-[10px] text-slate-500">
                              {formatRecoveryTime(record.recoveryTimeMs)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recovery flow */}
                      <RecoveryFlowDiagram record={record} />

                      {record.progressAtFailure != null && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Progress at failure:</span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${record.progressAtFailure}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-amber-400">{record.progressAtFailure}%</span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Tab 3: Verification Status ──────────────────────────────────── */}
          {activeTab === 'verification' && (
            <motion.div
              key="verification"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-6"
            >
              {/* Verification Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Verified Results',  value: verStats.verifiedCount,  color: 'text-green-400',  icon: CheckCircle2 },
                  { label: 'Mismatches',         value: verStats.mismatchCount,  color: 'text-red-400',    icon: XCircle },
                  { label: 'Pending',            value: verStats.pendingCount,   color: 'text-yellow-400', icon: Clock },
                  { label: 'Flagged Nodes',      value: verStats.flaggedNodes.length, color: 'text-orange-400', icon: AlertTriangle },
                ].map(item => (
                  <div key={item.label} className="bg-slate-900/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      <span className="text-[10px] text-slate-500">{item.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${item.color} tabular-nums`}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Flagged nodes section */}
              {verStats.flaggedNodes.length > 0 && (
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Flagged Nodes — Result Mismatch Detected
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {verStats.flaggedNodes.map(id => {
                      const ts = useAppStore.getState().trustScores[id];
                      return (
                        <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg text-xs">
                          <ShieldX className="w-3 h-3 text-red-400" />
                          <span className="text-slate-300">{ts?.deviceName ?? id.slice(0, 12)}</span>
                          {ts && <span className="text-red-400 font-mono">Score: {ts.score}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verification Log Table */}
              {filteredVerification.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No verification logs yet</p>
                  <p className="text-slate-600 text-xs mt-1">Verification records appear after jobs complete</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] text-slate-500 uppercase tracking-wider">
                    <div className="col-span-3">Job</div>
                    <div className="col-span-3">Primary Node</div>
                    <div className="col-span-3">Verifier</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-1">Time</div>
                  </div>

                  {filteredVerification.map((log, i) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-12 gap-3 px-4 py-3 rounded-xl bg-slate-900/40 items-center"
                    >
                      <div className="col-span-3 text-xs text-white truncate font-medium">{log.jobName}</div>
                      <div className="col-span-3 text-xs text-slate-400 truncate">{log.primaryDeviceName}</div>
                      <div className="col-span-3 text-xs text-slate-400 truncate">{log.verifierDeviceName}</div>
                      <div className="col-span-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          log.status === 'verified'  ? 'bg-green-500/15 text-green-400'
                          : log.status === 'mismatch' ? 'bg-red-500/15 text-red-400'
                          : log.status === 'pending'  ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-slate-800 text-slate-400'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="col-span-1 text-[10px] text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Verification Policy Note */}
              <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-300 flex items-start gap-2">
                  <Eye className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>
                    Result verification cross-checks job outputs between the primary node and a high-trust verifier.
                    Mismatches automatically flag the primary node and reduce its trust score by 15 points.
                    Only nodes with trust score ≥ 60 are eligible as verifiers.
                  </span>
                </p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
