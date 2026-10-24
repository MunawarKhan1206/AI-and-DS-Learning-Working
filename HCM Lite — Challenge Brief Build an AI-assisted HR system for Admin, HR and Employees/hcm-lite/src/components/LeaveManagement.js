'use client';

import React, { useState, useEffect } from 'react';
import {
  PlaneTakeoff,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Send,
  Ban,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LeaveManagement() {
  const { user, token } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formMsg, setFormMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);

  // Smart Leave Prompt State
  const [smartPrompt, setSmartPrompt] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);

  // Review comment state
  const [reviewComment, setReviewComment] = useState({});
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ltRes, balRes, reqRes] = await Promise.all([
        fetch('/api/admin/leave-types', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/leave/balance', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/leave/requests', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (ltRes.ok) {
        const json = await ltRes.json();
        setLeaveTypes(json.leaveTypes || []);
        if (json.leaveTypes?.length > 0 && !leaveTypeId) {
          setLeaveTypeId(json.leaveTypes[0]._id);
        }
      }
      if (balRes.ok) {
        const json = await balRes.json();
        setBalances(json.balances || []);
      }
      if (reqRes.ok) {
        const json = await reqRes.json();
        setRequests(json.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/leave/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leave_type_id: leaveTypeId,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Will catch 422 overlap and 422 over-balance errors cleanly!
        setFormMsg({
          text: `HTTP ${res.status}: ${data.error || 'Failed to submit leave'}`,
          type: 'error',
        });
      } else {
        setFormMsg({ text: data.message, type: 'success' });
        setReason('');
        fetchData();
      }
    } catch (err) {
      setFormMsg({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSmartLeave = async (e) => {
    e.preventDefault();
    if (!smartPrompt.trim()) return;
    setSmartLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'smart_leave',
          message: smartPrompt,
        }),
      });

      const data = await res.json();
      if (data.smart_form) {
        const sf = data.smart_form;
        if (sf.start_date) setStartDate(sf.start_date);
        if (sf.end_date) setEndDate(sf.end_date);
        if (sf.reason) setReason(sf.reason);

        // Find matching leave type by code
        const matched = leaveTypes.find(
          (lt) => lt.code === sf.type || lt.name.toLowerCase().includes((sf.type || '').toLowerCase())
        );
        if (matched) setLeaveTypeId(matched._id);

        setFormMsg({
          text: '✨ Form pre-filled by Smart Leave Assistant! Please review and confirm your submission.',
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSmartLoading(false);
    }
  };

  const handleReview = async (id, action) => {
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/leave/requests/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          review_comment: reviewComment[id] || '',
        }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReviewLoading(false);
    }
  };

  const isHRorAdmin = user?.role === 'admin' || user?.role === 'hr';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
          <PlaneTakeoff className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Leave Management & Approvals</h1>
          <p className="text-xs text-zinc-500">Apply for leaves, check policy quotas, and review team requests</p>
        </div>
      </div>

      {/* Leave Balances Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {balances.map((b, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500">{b.name}</span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-900">{b.remaining}</span>
              <span className="text-[11px] text-zinc-400">
                {b.quota >= 999 ? 'Days' : `of ${b.quota}`}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">Used: {b.used} • Pending: {b.pending}</p>
          </div>
        ))}
      </div>

      {/* Main Grid: Application Form & Smart Assistant */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Leave Apply Form */}
        <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
          <div className="flex items-center gap-2 mb-4">
            <PlaneTakeoff className="h-5 w-5 text-indigo-600" />
            <h3 className="text-base font-bold text-zinc-900">Apply for Leave</h3>
          </div>

          {/* Smart Leave Prompt Box */}
          <div className="rounded-2xl bg-indigo-50/60 p-4 border border-indigo-100 mb-5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 mb-1">
              <Sparkles className="h-4 w-4 text-indigo-600" /> Smart Leave Assistant
            </div>
            <p className="text-[11px] text-indigo-700 mb-2">
              Type naturally (e.g. <em>"need next Monday and Tuesday off for family wedding"</em>) and the AI will auto-fill the form!
            </p>
            <form onSubmit={handleSmartLeave} className="flex gap-2">
              <input
                type="text"
                value={smartPrompt}
                onChange={(e) => setSmartPrompt(e.target.value)}
                placeholder="e.g. Need sick leave tomorrow due to fever..."
                className="flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-xs text-zinc-800 focus:border-indigo-600 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={smartLoading || !smartPrompt.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {smartLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pre-Fill'}
              </button>
            </form>
          </div>

          {formMsg.text && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-2xl p-4 text-xs font-medium border ${
                formMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {formMsg.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span>{formMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Leave Type</label>
              <select
                required
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
              >
                {leaveTypes.map((lt) => (
                  <option key={lt._id} value={lt._id}>
                    {lt.name} ({lt.quota >= 999 ? 'Unlimited' : `${lt.quota} days/yr`})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Reason</label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for taking leave..."
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm & Submit Application'}
            </button>
          </form>
        </div>

        {/* Business Rules Help Guide */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
              Company Leave Policy
            </h4>
            <ul className="text-xs text-zinc-600 space-y-2.5">
              <li>• <strong>Working Days Only</strong>: Weekends and declared public holidays are excluded from leave calculations.</li>
              <li>• <strong>Quotas</strong>: Annual (14), Sick (8), Casual (10), Unpaid (Unlimited).</li>
              <li>• <strong>Overlapping & Over-balance</strong>: Requests that overlap or exceed balance will be rejected (HTTP 422).</li>
              <li>• <strong>Approval</strong>: Handled by HR or Admin. In-app notifications will alert you of decisions.</li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200 text-[11px] text-zinc-500">
            Smart leave assistant resolves relative dates against today's date automatically.
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
        <h3 className="text-sm font-bold text-zinc-900 mb-4">
          {isHRorAdmin ? 'Team Leave Requests' : 'Your Leave History'}
        </h3>

        {requests.length === 0 ? (
          <p className="text-center py-8 text-xs text-zinc-400">No leave requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  {isHRorAdmin && <th className="px-4 py-3">Employee</th>}
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Working Days</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {requests.map((req) => (
                  <tr key={req._id} className="hover:bg-zinc-50/60 transition">
                    {isHRorAdmin && (
                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        {req.employee_id?.first_name} {req.employee_id?.last_name}
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-zinc-800">
                      {req.leave_type_id?.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 font-mono">
                      {req.start_date} &rarr; {req.end_date}
                    </td>
                    <td className="px-4 py-3 font-bold text-zinc-900">
                      {req.working_days} day(s)
                    </td>
                    <td className="px-4 py-3 text-zinc-600 max-w-xs truncate">
                      {req.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isHRorAdmin && req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="text"
                            placeholder="Comment..."
                            value={reviewComment[req._id] || ''}
                            onChange={(e) =>
                              setReviewComment({ ...reviewComment, [req._id]: e.target.value })
                            }
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px]"
                          />
                          <button
                            onClick={() => handleReview(req._id, 'approve')}
                            disabled={reviewLoading}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(req._id, 'reject')}
                            disabled={reviewLoading}
                            className="rounded-lg bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
                          >
                            Reject
                          </button>
                        </div>
                      ) : !isHRorAdmin && ['pending', 'approved'].includes(req.status) ? (
                        <button
                          onClick={() => handleReview(req._id, 'cancel')}
                          disabled={reviewLoading}
                          className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold ml-auto"
                        >
                          <Ban className="h-3.5 w-3.5" /> Cancel
                        </button>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
