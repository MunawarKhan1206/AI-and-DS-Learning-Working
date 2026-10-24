'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  DollarSign,
  TrendingDown,
  Briefcase,
  Sparkles,
  Loader2,
  RefreshCw,
  Building,
  UserCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';

const PIE_COLORS = ['#6366f1', '#ec4899', '#f59e0b'];

export default function AdminDashboard({ onOpenAI }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchAnalytics();
  }, [selectedDept]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/admin/departments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setDepartments(json.departments || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const url = selectedDept
        ? `/api/analytics/admin?department=${selectedDept}`
        : '/api/analytics/admin';
      const res = await fetch(url, {
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
            attritionYTD: data.attritionYTD,
            totalGrossPayroll: data.totalGrossPayroll,
            avgSalary: data.avgSalary,
            headcountByDept: data.headcountByDept,
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

  const genderPieData = data?.genderBreakdown
    ? [
        { name: 'Male', value: data.genderBreakdown.male },
        { name: 'Female', value: data.genderBreakdown.female },
        { name: 'Other', value: data.genderBreakdown.other },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Department Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
            <Building className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Executive Company Dashboard</h1>
            <p className="text-xs text-zinc-500">Live operational & strategic metrics aggregated across the company</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs focus:border-indigo-600 focus:outline-hidden"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleAiSummarize}
            disabled={summarizing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:from-indigo-700 hover:to-violet-700 transition disabled:opacity-50"
          >
            {summarizing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI Summarize
          </button>

          <button
            onClick={fetchAnalytics}
            className="rounded-xl border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* AI Summary Box */}
      {aiSummary && (
        <div className="rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 p-5 border border-indigo-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                AI Executive Insights
              </h3>
            </div>
            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-full">
              ✨ AI-generated from live DB metrics
            </span>
          </div>
          <div className="text-xs text-indigo-950 whitespace-pre-line leading-relaxed">
            {aiSummary}
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Headcount
            </span>
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.headcount || 0}</p>
          <p className="mt-1 text-[11px] text-zinc-400">Active personnel</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Attrition YTD
            </span>
            <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">{data?.attritionYTD || 0}%</p>
          <p className="mt-1 text-[11px] text-zinc-400">Exits / Avg Headcount</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Monthly Payroll Cost
            </span>
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">
            PKR {(data?.totalGrossPayroll || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">Gross across department</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Average Salary
            </span>
            <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
              <Briefcase className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-900">
            PKR {(data?.avgSalary || 0).toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">Mean gross per employee</p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Headcount by Department */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Headcount by Department</h3>
          <div className="h-64 w-full">
            {data?.headcountByDept?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.headcountByDept}>
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No department headcount data available yet.
              </div>
            )}
          </div>
        </div>

        {/* Payroll Cost by Department */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Payroll Cost by Department ($)</h3>
          <div className="h-64 w-full">
            {data?.payrollCostByDept?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.payrollCostByDept}>
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => `$${Number(val).toLocaleString()}`} />
                  <Bar dataKey="totalGross" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No payroll runs generated yet.
              </div>
            )}
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Gender Distribution</h3>
          <div className="h-64 w-full">
            {genderPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genderPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No active employee records.
              </div>
            )}
          </div>
        </div>

        {/* Avg Salary by Department */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs">
          <h3 className="text-sm font-bold text-zinc-900 mb-4">Average Salary by Department ($)</h3>
          <div className="h-64 w-full">
            {data?.avgSalaryByDept?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.avgSalaryByDept} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="department" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip formatter={(val) => `$${Number(val).toLocaleString()}`} />
                  <Bar dataKey="avgGross" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                No salary data available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
