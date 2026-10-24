'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AttendanceBoard() {
  const { token, user } = useAuth();
  const [boardData, setBoardData] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [reviewComment, setReviewComment] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchBoard();
    fetchCorrections();
  }, [date]);

  const fetchBoard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/board?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setBoardData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCorrections = async () => {
    try {
      const res = await fetch('/api/attendance/corrections', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setCorrections(json.corrections || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewCorrection = async (id, status) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/attendance/corrections/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          review_comment: reviewComment[id] || '',
        }),
      });

      if (res.ok) {
        fetchCorrections();
        fetchBoard();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const isHRorAdmin = user?.role === 'admin' || user?.role === 'hr';

  return (
    <div className="space-y-6">
      {/* Header & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Daily Attendance Board</h1>
            <p className="text-xs text-zinc-500">Live check-in status, late arrivals tracking, and employee corrections</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-zinc-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-2xs focus:border-indigo-600 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Summary Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500">Present</span>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{boardData?.counts?.present || 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500">Late</span>
          <p className="mt-2 text-2xl font-bold text-amber-600">{boardData?.counts?.late || 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500">Half Day (&lt; 5h)</span>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{boardData?.counts?.half_day || 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500">On Leave</span>
          <p className="mt-2 text-2xl font-bold text-sky-600">{boardData?.counts?.on_leave || 0}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <span className="text-xs font-semibold text-zinc-500">Absent</span>
          <p className="mt-2 text-2xl font-bold text-rose-600">{boardData?.counts?.absent || 0}</p>
        </div>
      </div>

      {/* Attendance Board Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : boardData?.board?.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">No active employees to display.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Check In</th>
                  <th className="px-6 py-3.5">Check Out</th>
                  <th className="px-6 py-3.5">Hours</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {boardData?.board?.map((item, i) => {
                  const att = item.attendance;
                  return (
                    <tr key={i} className="hover:bg-zinc-50/60 transition">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                        {item.employee?.employee_code}
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-900">
                        {item.employee?.first_name} {item.employee?.last_name}
                      </td>
                      <td className="px-6 py-4 text-zinc-600">
                        {item.employee?.department?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {att?.check_in ? new Date(att.check_in).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-6 py-4 font-mono">
                        {att?.check_out ? new Date(att.check_out).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-700">
                        {att?.worked_hours ? `${att.worked_hours}h` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            item.status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'late'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'half_day'
                              ? 'bg-indigo-100 text-indigo-800'
                              : item.status === 'on_leave'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance Corrections Inbox (for HR & Admin) */}
      {isHRorAdmin && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-zinc-900">Attendance Correction Requests Inbox</h3>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              {corrections.filter((c) => c.status === 'pending').length} Pending
            </span>
          </div>

          {corrections.length === 0 ? (
            <p className="text-center py-6 text-xs text-zinc-400">No correction requests recorded.</p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {corrections.map((corr) => (
                <div key={corr._id} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-900">
                        {corr.employee_id?.first_name} {corr.employee_id?.last_name}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-400">
                        ({corr.employee_id?.employee_code})
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                        Date: {corr.date}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600">
                      <strong>Reason:</strong> {corr.reason}
                    </p>
                    <p className="mt-0.5 text-zinc-500 font-mono text-[11px]">
                      Proposed: {new Date(corr.proposed_check_in).toLocaleTimeString()}
                      {corr.proposed_check_out &&
                        ` - ${new Date(corr.proposed_check_out).toLocaleTimeString()}`}
                    </p>
                  </div>

                  {corr.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Review comment..."
                        value={reviewComment[corr._id] || ''}
                        onChange={(e) =>
                          setReviewComment({ ...reviewComment, [corr._id]: e.target.value })
                        }
                        className="rounded-xl border border-zinc-300 px-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-hidden"
                      />
                      <button
                        onClick={() => handleReviewCorrection(corr._id, 'approved')}
                        disabled={actionLoading}
                        className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReviewCorrection(corr._id, 'rejected')}
                        disabled={actionLoading}
                        className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold uppercase text-[10px] ${
                        corr.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {corr.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
