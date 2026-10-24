'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Lock,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/context/AuthContext';

export default function PayrollManager() {
  const { user, token } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchPayroll();
  }, [month]);

  const fetchPayroll = async () => {
    setLoading(true);
    setMsg({ text: '', type: '' });
    try {
      const res = await fetch(`/api/payroll/runs?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDraft = async () => {
    setActionLoading(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ month }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error || 'Failed to generate draft', type: 'error' });
      } else {
        setMsg({ text: json.message, type: 'success' });
        fetchPayroll();
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm(`Are you sure you want to finalize payroll for ${month}? Finalized payroll runs are LOCKED and cannot be edited.`)) {
      return;
    }

    setActionLoading(true);
    setMsg({ text: '', type: '' });

    try {
      const res = await fetch('/api/payroll/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ month }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error || 'Failed to finalize', type: 'error' });
      } else {
        setMsg({ text: json.message, type: 'success' });
        fetchPayroll();
      }
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const downloadPayslipPDF = (rec) => {
    const doc = new jsPDF();
    const emp = rec.employee_id;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text('HCM Lite — Confidential Payslip', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Salary Period: ${rec.month}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

    // Employee Meta Box
    doc.autoTable({
      startY: 40,
      head: [['Employee Code', 'Employee Name', 'Department', 'Status']],
      body: [
        [
          emp?.employee_code || 'EMP',
          `${emp?.first_name} ${emp?.last_name}`,
          emp?.department_id?.name || 'General',
          rec.status.toUpperCase(),
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    // Earnings & Deductions Breakdown
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Earnings Breakdown', 'Amount ($)', 'Deductions Breakdown', 'Amount ($)']],
      body: [
        ['Basic Salary', `$${rec.basic_salary.toLocaleString()}`, 'Absence Deductions', `$${rec.absence_deduction.toLocaleString()}`],
        ['HRA (40% of Basic)', `$${rec.hra.toLocaleString()}`, 'Income Tax (Slab Share)', `$${rec.tax_deduction.toLocaleString()}`],
        ['Medical Allowance (10%)', `$${rec.medical.toLocaleString()}`, 'Unpaid Leave Days', `${rec.unpaid_leave_days || 0} day(s)`],
        ['Total Gross Salary (1.5x)', `$${rec.gross_salary.toLocaleString()}`, 'Total Deductions', `$${(rec.absence_deduction + rec.tax_deduction).toLocaleString()}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
    });

    // Net Payable Banner
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129);
    doc.text(`NET PAYABLE AMOUNT: PKR ${rec.net_salary.toLocaleString()}`, 14, doc.lastAutoTable.finalY + 20);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('This is a computer-generated payslip verified by HCM Lite server-side payroll engine.', 14, doc.lastAutoTable.finalY + 30);

    doc.save(`Payslip_${emp?.employee_code || 'EMP'}_${rec.month}.pdf`);
  };

  const isAdmin = user?.role === 'admin';
  const isFinalized = data?.isFinalized;

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
            <DollarSign className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Payroll Engine & Payslips</h1>
              {isFinalized && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <Lock className="h-3 w-3" /> Locked & Finalized
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500">Tax slabs, working days proration, absence deductions & PDF slips</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 shadow-2xs">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-xs font-semibold text-zinc-800 focus:outline-hidden"
            />
          </div>

          {/* HR/Admin Draft Button */}
          {!isFinalized && (
            <button
              onClick={handleGenerateDraft}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              Generate Draft
            </button>
          )}

          {/* ADMIN ONLY Finalize & Lock Button */}
          {isAdmin && !isFinalized && data?.records?.length > 0 && (
            <button
              onClick={handleFinalize}
              disabled={actionLoading}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              <Lock className="h-3.5 w-3.5" /> Finalize & Lock Payroll
            </button>
          )}
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
          {msg.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Summary Counters */}
      {data?.summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500">Gross Payroll</span>
            <p className="mt-2 text-2xl font-bold text-zinc-900">PKR {data.summary.totalGross.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">1.5x basic sum</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500">Income Tax Deducted</span>
            <p className="mt-2 text-2xl font-bold text-amber-600">PKR {data.summary.totalTax.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Annual tax slabs / 12</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500">Absence Deductions</span>
            <p className="mt-2 text-2xl font-bold text-rose-600">PKR {data.summary.totalDeductions.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Absent + Unpaid + Half days</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
            <span className="text-xs font-semibold text-zinc-500">Net Disbursed</span>
            <p className="mt-2 text-2xl font-bold text-emerald-600">PKR {data.summary.totalNet.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] text-zinc-400">Final employee take-home</p>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : data?.records?.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No payroll draft created for {month}. Click "Generate Draft" to run salary calculations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Basic</th>
                  <th className="px-6 py-3.5">Gross (1.5x)</th>
                  <th className="px-6 py-3.5">Absences</th>
                  <th className="px-6 py-3.5">Tax</th>
                  <th className="px-6 py-3.5">Net Salary</th>
                  <th className="px-6 py-3.5 text-right">Payslip PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.records.map((rec) => {
                  const emp = rec.employee_id;
                  return (
                    <tr key={rec._id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                        {emp?.employee_code}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-900">{emp?.first_name} {emp?.last_name}</p>
                        <p className="text-[11px] text-zinc-400">{emp?.department_id?.name || 'General'}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-700">PKR {rec.basic_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-zinc-900">PKR {rec.gross_salary.toLocaleString()}</td>
                      <td className="px-6 py-4 text-rose-600">-PKR {rec.absence_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 text-amber-600">-PKR {rec.tax_deduction.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600 text-sm">
                        PKR {rec.net_salary.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => downloadPayslipPDF(rec)}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                        >
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
