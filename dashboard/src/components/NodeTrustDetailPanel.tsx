'use client';

/**
 * NodeTrustDetailPanel — Expanded breakdown of a node's trust score.
 *
 * Shows all 5 sub-scores with animated bars and a radar/breakdown layout.
 * Used inside the Trust & Recovery page as a slide-out detail view.
 */

import { motion } from 'framer-motion';
import {
  ShieldCheck, ShieldAlert, ShieldX, Clock, Activity,
  Zap, Server, Wifi, AlertTriangle, CheckCircle2, X,
  TrendingUp, TrendingDown, BarChart2, RefreshCw
} from 'lucide-react';
import type { NodeTrustScore } from '@/types';
import { getTrustLevel, getTrustColor, getTrustBg, getTrustHexColor } from '@/lib/trust';

// ─── Sub-score bar ────────────────────────────────────────────────────────────

function SubScoreBar({
  label, value, icon: Icon, color, description
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  description: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${color}`} />
          <span className="text-xs text-slate-300 font-medium">{label}</span>
        </div>
        <span className={`text-xs font-mono font-bold ${color}`}>{Math.round(pct)}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${getHexFromTailwind(color)}88, ${getHexFromTailwind(color)})` }}
        />
      </div>
      <p className="text-[10px] text-slate-600">{description}</p>
    </div>
  );
}

function getHexFromTailwind(cls: string): string {
  if (cls.includes('green'))  return '#22c55e';
  if (cls.includes('yellow')) return '#eab308';
  if (cls.includes('blue'))   return '#3b82f6';
  if (cls.includes('purple')) return '#8b5cf6';
  if (cls.includes('orange')) return '#f97316';
  if (cls.includes('red'))    return '#ef4444';
  return '#94a3b8';
}

// ─── Circular gauge ───────────────────────────────────────────────────────────

function CircularGauge({ score, level }: { score: number; level: 'high' | 'medium' | 'low' }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = getTrustHexColor(level);

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        {/* Background track */}
        <circle
          cx="72" cy="72" r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
        />
        {/* Progress arc */}
        <motion.circle
          cx="72" cy="72" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] text-slate-500 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  trust: NodeTrustScore;
  onClose: () => void;
}

export function NodeTrustDetailPanel({ trust, onClose }: Props) {
  const level = getTrustLevel(trust.score);
  const color = getTrustColor(level);
  const hexColor = getTrustHexColor(level);
  const bgClass = getTrustBg(level);

  const subScores = [
    {
      label: 'Uptime',
      value: trust.uptimePercent,
      icon: Clock,
      color: 'text-green-400',
      description: 'Based on consecutive online time. Saturates at 72 h uptime (100 pts).',
    },
    {
      label: 'Job Completion Ratio',
      value: trust.jobCompletionRatio * 100,
      icon: CheckCircle2,
      color: 'text-blue-400',
      description: `${trust.totalJobsCompleted} completed / ${trust.totalJobsCompleted + trust.totalJobsFailed} total jobs.`,
    },
    {
      label: 'Heartbeat Stability',
      value: trust.heartbeatStability,
      icon: Activity,
      color: 'text-purple-400',
      description: 'How consistently the agent publishes heartbeats (degrades after 10s silence).',
    },
    {
      label: 'Response Time',
      value: trust.avgResponseTimeScore,
      icon: Wifi,
      color: 'text-cyan-400',
      description: 'Inverse of average network latency. Perfect at ≤5 ms, zero at ≥300 ms.',
    },
    {
      label: 'System Health',
      value: trust.systemHealthScore,
      icon: Server,
      color: 'text-orange-400',
      description: trust.systemHealthScore >= 90 ? 'Node reports healthy status.' :
                   trust.systemHealthScore >= 40 ? 'Node reports degraded status.' : 'Node reports critical status.',
    },
  ];

  const verifyTotal = trust.successfulVerifications + trust.failedVerifications;
  const verifyRate  = verifyTotal > 0
    ? Math.round((trust.successfulVerifications / verifyTotal) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`glass-card p-6 border ${bgClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {level === 'high'   && <ShieldCheck  className="w-6 h-6 text-green-400" />}
          {level === 'medium' && <ShieldAlert  className="w-6 h-6 text-yellow-400" />}
          {level === 'low'    && <ShieldX      className="w-6 h-6 text-red-400" />}
          <div>
            <div className="text-white font-bold text-lg">{trust.deviceName}</div>
            <div className="text-slate-500 text-xs font-mono mt-0.5">{trust.deviceId}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Score gauge + summary */}
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
        <CircularGauge score={trust.score} level={level} />

        <div className="flex-1 grid grid-cols-2 gap-3 w-full">
          {[
            { label: 'Trust Level',      value: level.toUpperCase(),            color },
            { label: 'Jobs Completed',   value: trust.totalJobsCompleted,       color: 'text-green-400' },
            { label: 'Jobs Failed',      value: trust.totalJobsFailed,          color: trust.totalJobsFailed > 0 ? 'text-red-400' : 'text-slate-400' },
            { label: 'Disconnections',   value: trust.recentDisconnections,     color: trust.recentDisconnections > 0 ? 'text-amber-400' : 'text-slate-400' },
            { label: 'Verifications',    value: verifyRate != null ? `${verifyRate}%` : '—', color: 'text-purple-400' },
            { label: 'Flagged',          value: trust.isFlagged ? 'YES' : 'NO', color: trust.isFlagged ? 'text-red-400' : 'text-green-400' },
          ].map(item => (
            <div key={item.label} className="bg-slate-900/50 rounded-lg p-2.5">
              <div className="text-[10px] text-slate-500 mb-1">{item.label}</div>
              <div className={`text-sm font-bold ${item.color} tabular-nums`}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-score breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <BarChart2 className="w-3.5 h-3.5" />
          Score Breakdown (weighted inputs)
        </h3>
        <div className="space-y-4">
          {subScores.map(s => (
            <SubScoreBar key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Formula note */}
      <div className="mt-5 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
        <p className="text-[10px] text-slate-500 leading-relaxed">
          <span className="text-slate-400 font-semibold">Formula: </span>
          0.25×Uptime + 0.25×Completion + 0.20×Heartbeat + 0.15×ResponseTime + 0.10×Health
          − DisconnectionPenalty − VerificationPenalty
        </p>
      </div>

      {/* Flagged warning */}
      {trust.isFlagged && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">
            This node has been flagged due to a result verification mismatch.
            Trust score was automatically reduced by 15 points. It will recover
            as the node completes more verified jobs successfully.
          </p>
        </div>
      )}
    </motion.div>
  );
}
