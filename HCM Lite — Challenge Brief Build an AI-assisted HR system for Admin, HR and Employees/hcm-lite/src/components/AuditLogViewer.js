'use client';

import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Loader2, Search, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuditLogViewer() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = '/api/audit?limit=100';
      if (actionFilter) url += `&action=${actionFilter}`;
      if (entityFilter) url += `&entity=${entityFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100">
            <Shield className="h-6 w-6 shrink-0" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight leading-snug">
                System Audit Log Trail
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200 shadow-2xs whitespace-nowrap">
                Immutable & Append-Only
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cryptographically sealed activity trail of every creation, change, approval, and finalization
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="self-start md:self-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition"
        >
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No audit records matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Actor</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Entity</th>
                  <th className="px-6 py-3.5">State Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-zinc-900">{log.actor_email}</span>
                      <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] uppercase text-zinc-600 font-bold">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-zinc-700">
                      {log.entity} {log.entity_id ? `(#${log.entity_id.slice(-6)})` : ''}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-zinc-500">
                      {log.after ? JSON.stringify(log.after) : log.before ? JSON.stringify(log.before) : '—'}
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
