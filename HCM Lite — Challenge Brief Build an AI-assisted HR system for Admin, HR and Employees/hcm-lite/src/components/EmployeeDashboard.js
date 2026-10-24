'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  LogIn,
  LogOut,
  Calendar,
  DollarSign,
  Bot,
  AlertCircle,
  Loader2,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function EmployeeDashboard({ onOpenAI, onOpenLeaveForm }) {
  const { user, token } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, todayRes] = await Promise.all([
        fetch('/api/analytics/employee', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/attendance/today', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (analyticsRes.ok) {
        const json = await analyticsRes.json();
        setAnalytics(json.data);
      }
      if (todayRes.ok) {
        const json = await todayRes.json();
        setTodayAttendance(json.attendance);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    setMsg({ text: '', type: '' });

    // Optional browser geolocation for bonus Haversine check
    let lat = null;
    let lng = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        // Geolocation unavailable or denied, server proceeds
      }
    }

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lng }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Check-in failed', type: 'error' });
      } else {
        setMsg({ text: data.message, type: 'success' });
        setTodayAttendance(data.attendance);
        fetchDashboardData();
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || 'Check-out failed', type: 'error' });
      } else {
        setMsg({ text: data.message, type: 'success' });
        setTodayAttendance(data.attendance);
        fetchDashboardData();
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  const hoursProgress = Math.min(
    100,
    Math.round(((analytics?.hoursThisWeek || 0) / 40) * 100)
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {user?.employee?.first_name || user?.email}!
            </h1>
            <p className="mt-1 text-xs text-indigo-100">
              Code: <strong>{user?.employee?.employee_code || 'EMP'}</strong> • Role:{' '}
              <span className="capitalize">{user?.role}</span>
            </p>
          </div>
          <button
            onClick={onOpenAI}
            className="flex items-center gap-2 rounded-2xl bg-white/20 backdrop-blur-xs px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-white/30 transition self-start sm:self-center"
          >
            <Bot className="h-4 w-4" /> Ask My Assistant
          </button>
        </div>
      </div>

      {msg.text && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-4 text-xs font-medium border ${
            msg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {msg.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Main Grid: Check-in widget + Hours Progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Check-in / Check-out Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Today's Attendance
            </span>
            <Clock className="h-5 w-5 text-indigo-600" />
          </div>

          <div className="my-4 text-center">
            <div className="text-3xl font-extrabold text-zinc-900 tracking-tight">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Status Display */}
          {todayAttendance ? (
            <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-200 text-xs space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Check In:</span>
                <span className="font-semibold text-zinc-900">
                  {new Date(todayAttendance.check_in).toLocaleTimeString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Check Out:</span>
                <span className="font-semibold text-zinc-900">
                  {todayAttendance.check_out
                    ? new Date(todayAttendance.check_out).toLocaleTimeString()
                    : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-500">Status:</span>
                <span
                  className={`rounded-full px-2 py-0.5 font-bold uppercase text-[10px] ${
                    todayAttendance.status === 'present'
                      ? 'bg-emerald-100 text-emerald-800'
                      : todayAttendance.status === 'late'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {todayAttendance.status}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-50 p-4 border border-zinc-200 text-xs text-center text-zinc-500 mb-4">
              You haven't checked in for today yet.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCheckIn}
              disabled={actionLoading || Boolean(todayAttendance)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              <LogIn className="h-4 w-4" /> Check In
            </button>
            <button
              onClick={handleCheckOut}
              disabled={
                actionLoading ||
                !todayAttendance ||
                Boolean(todayAttendance?.check_out)
              }
              className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 transition"
            >
              <LogOut className="h-4 w-4" /> Check Out
            </button>
          </div>
        </div>

        {/* Weekly Hours vs 40h Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Weekly Target
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                40 Hours / Week
              </span>
            </div>

            <div className="my-2">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-3xl font-bold text-zinc-900">
                  {analytics?.hoursThisWeek || 0}h
                </span>
                <span className="text-xs text-zinc-500">of 40h</span>
              </div>
              {/* Progress bar */}
              <div className="h-3 w-full rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${hoursProgress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
            <span>Late arrivals this month:</span>
            <span className="font-bold text-zinc-900">
              {analytics?.lateCountMonth || 0} time(s)
            </span>
          </div>
        </div>

        {/* Last Finalized Payslip Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Latest Payslip
              </span>
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>

            {analytics?.lastPayslip ? (
              <div>
                <p className="text-xs text-zinc-400">Month: {analytics.lastPayslip.month}</p>
                <p className="text-3xl font-bold text-zinc-900 mt-1">
                  PKR {analytics.lastPayslip.net_salary.toLocaleString()}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Net Disbursed</p>
                <div className="mt-3 text-[11px] text-zinc-500 space-y-0.5">
                  <p>Gross: PKR {analytics.lastPayslip.gross_salary.toLocaleString()}</p>
                  <p>Tax: PKR {analytics.lastPayslip.tax_deduction.toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-zinc-400">
                No finalized payslips available yet.
              </div>
            )}
          </div>

          <button
            onClick={() => window.open(`/api/payroll/runs`, '_blank')}
            className="w-full mt-4 rounded-2xl border border-zinc-200 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
          >
            View Payslip Details
          </button>
        </div>
      </div>

      {/* Leave Balances Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-zinc-900">Your Leave Quota Balances</h3>
          <button
            onClick={onOpenLeaveForm}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Apply for Leave &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {analytics?.balances?.map((b, i) => (
            <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <span className="text-xs font-semibold text-zinc-500">{b.name}</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-zinc-900">{b.remaining}</span>
                <span className="text-[11px] text-zinc-400">
                  {b.quota >= 999 ? 'Days' : `of ${b.quota}`}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-400">Used: {b.used} day(s)</p>
            </div>
          ))}
        </div>
      </div>

      {/* Announcements */}
      {analytics?.announcements?.length > 0 && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-zinc-900">Company Announcements</h3>
          </div>
          <div className="divide-y divide-zinc-100">
            {analytics.announcements.map((a) => (
              <div key={a._id} className="py-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900">{a.title}</h4>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
