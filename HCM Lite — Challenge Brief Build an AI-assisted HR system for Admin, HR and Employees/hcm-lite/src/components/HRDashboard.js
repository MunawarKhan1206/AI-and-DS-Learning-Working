'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  PlaneTakeoff,
  Clock,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';

export default function HRDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    fetchHRAnalytics();
  }, []);

  const fetchHRAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/hr', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAiSummarize = async () => {
    if (!data) return;
    setSummarizing(true);
    setAiSummary('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'summarize_dashboard',
          kpiData: {
            headcount: data.headcount,
            presentToday: data.presentToday,
            lateToday: data.lateToday,
            onLeaveToday: data.onLeaveToday,
            pendingApprovals: data.pendingApprovals,
            attendanceRate: data.attendanceRate,
            latePercent: data.latePercent,
          },
        }),
      });

      const json = await res.json();
      setAiSummary(json.reply);
    } catch (err) {
      setAiSummary('Failed to generate AI summary.');
    } finally {
      setSummarizing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100">
            <Users className="h-6 w-6 shrink-0" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight leading-snug">
              HR Operations Dashboard
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Daily workforce attendance, approvals & leave utilization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleAiSummarize}
            disabled={summarizing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition disabled:opacity-50"
          >
            {summarizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>AI Summarize</span>
          </button>

          <button
            onClick={fetchHRAnalytics}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 active:scale-95 transition shadow-2xs"
            aria-label="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AI Summary Box */}
      {aiSummary && (
        <div className="rounded-3xl bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-violet-50/80 p-5 sm:p-6 border border-indigo-100 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b border-indigo-100/70">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs">
                <Sparkles className="h-4 w-4 shrink-0 text-white" />
              </div>
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-indigo-950">
                AI Operational Insights
              </h3>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full border border-indigo-200/60">
              ✨ Generated from live MongoDB metrics
            </span>
          </div>
          <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-normal">
            {aiSummary}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Headcount
            </span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.headcount || 0}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Total active workforce</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Present Today
            </span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.presentToday || 0}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-medium">
            Rate: {data?.attendanceRate || 0}%
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Late Today
            </span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.lateToday || 0}</p>
          <p className="mt-1 text-[11px] text-amber-600 font-medium">
            Late %: {data?.latePercent || 0}%
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              On Leave Today
            </span>
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
              <PlaneTakeoff className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.onLeaveToday || 0}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Approved leaves</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.pendingApprovals || 0}</p>
          <p className="mt-1 text-[11px] text-rose-600 font-medium">Action needed</p>
        </div>
      </div>

      {/* Charts & Late-comers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leave by Type Chart */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Leave Utilization by Type (Days)</h3>
          <div className="h-64 w-full">
            {data?.leaveByType?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.leaveByType}>
                  <XAxis dataKey="type" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="days" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No leave records utilized this year.
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Late Comers */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Top 5 Late-Comers (Last 30 Days)</h3>
          {data?.top5LateComers?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-400">
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium text-right">Late Incidents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.top5LateComers.map((item, i) => (
                    <tr key={i} className="py-2.5">
                      <td className="py-2 font-medium text-zinc-800">{item.name}</td>
                      <td className="py-2 text-right">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                          {item.count} times
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-52 items-center justify-center text-xs text-zinc-400">
              No late arrivals recorded in the last 30 days! 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
