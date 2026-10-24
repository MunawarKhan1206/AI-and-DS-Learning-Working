'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Upload,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Edit2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function EmployeeDirectory() {
  const { user, token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  // Add Employee Form State
  const [formData, setFormData] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    department_id: '',
    designation_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    gender: 'male',
    basic_salary: 50000,
    temporary_password: 'Welcome@123',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // CSV Import State
  const [csvContent, setCsvContent] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    fetchMeta();
    fetchEmployees();
  }, [search, selectedDept]);

  const fetchMeta = async () => {
    try {
      const [deptRes, desigRes, codeRes] = await Promise.all([
        fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/designations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/employees/next-code', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments || []);
      }
      if (desigRes.ok) {
        const des = await desigRes.json();
        setDesignations(des.designations || []);
      }
      if (codeRes.ok) {
        const c = await codeRes.json();
        if (c.nextCode) {
          setFormData((prev) => ({
            ...prev,
            employee_code: prev.employee_code || c.nextCode,
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenAddModal = async () => {
    try {
      const codeRes = await fetch('/api/employees/next-code', { headers: { Authorization: `Bearer ${token}` } });
      if (codeRes.ok) {
        const c = await codeRes.json();
        setFormData((prev) => ({
          ...prev,
          employee_code: c.nextCode || 'EMP0001',
        }));
      }
    } catch (e) {
      console.error(e);
    }
    setShowAddModal(true);
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = `/api/employees?search=${encodeURIComponent(search)}`;
      if (selectedDept) url += `&department=${selectedDept}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setEmployees(json.employees || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError('');

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          basic_salary: Number(formData.basic_salary),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create employee');
      }

      setShowAddModal(false);
      fetchEmployees();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleCSVAction = async (dryRun) => {
    if (!csvContent.trim()) return;
    setImportLoading(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          csv_content: csvContent,
          dry_run: dryRun,
        }),
      });

      const data = await res.json();
      setImportResult(data);
      if (!dryRun && data.success) {
        fetchEmployees();
      }
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImportLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open(`/api/employees/export`, '_blank');
  };

  const isHRorAdmin = user?.role === 'admin' || user?.role === 'hr';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-100">
            <Users className="h-6 w-6 shrink-0" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight leading-snug">
              Employee Directory & Workforce
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage personnel records, onboarding, CSV dry-run imports, and employee 360 profiles
            </p>
          </div>
        </div>

        {isHRorAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => {
                setShowImportModal(true);
                setImportResult(null);
                setCsvContent('');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 shadow-2xs transition"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 transition"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              <span>Add Employee</span>
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, code or email..."
            className="w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-xs text-zinc-800 shadow-2xs focus:border-indigo-600 focus:outline-hidden"
          />
        </div>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-xs font-medium text-zinc-700 shadow-2xs focus:border-indigo-600 focus:outline-hidden"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Directory Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No employees found matching the current search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Code</th>
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Status</th>
                  {isHRorAdmin && <th className="px-6 py-3.5 text-right">Gross Salary</th>}
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {employees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-zinc-50/60 transition">
                    <td className="px-6 py-4 font-mono font-bold text-indigo-600">
                      {emp.employee_code}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-900">
                        {emp.first_name} {emp.last_name}
                      </p>
                      <p className="text-[11px] text-zinc-400">{emp.email}</p>
                    </td>
                    <td className="px-6 py-4 text-zinc-700 font-medium">
                      {emp.department_id?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">
                      {emp.designation_id?.title || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          emp.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : emp.status === 'probation'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    {isHRorAdmin && (
                      <td className="px-6 py-4 text-right font-semibold text-zinc-900">
                        PKR {(emp.gross_salary || 0).toLocaleString()}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedEmp(emp)}
                        className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition"
                      >
                        Profile 360
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100 mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Register New Employee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Employee Code</label>
                  <input
                    type="text"
                    required
                    value={formData.employee_code}
                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                    placeholder="EMP001"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Department</label>
                  <select
                    required
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Designation</label>
                  <select
                    required
                    value={formData.designation_id}
                    onChange={(e) => setFormData({ ...formData, designation_id: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  >
                    <option value="">Select Designation</option>
                    {designations.map((des) => (
                      <option key={des._id} value={des._id}>
                        {des.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Joining Date</label>
                  <input
                    type="date"
                    required
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Basic Salary (PKR)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.basic_salary}
                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-indigo-50/60 p-3 border border-indigo-100 text-[11px] text-indigo-900">
                <strong>Computed Salary Structure (1.5x Basic):</strong>
                <div className="mt-1 flex gap-4">
                  <span>HRA (40%): PKR {Math.round(formData.basic_salary * 0.4).toLocaleString()}</span>
                  <span>Medical (10%): PKR {Math.round(formData.basic_salary * 0.1).toLocaleString()}</span>
                  <span className="font-bold">
                    Gross: PKR {(Number(formData.basic_salary) * 1.5).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Temporary Login Password
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={formData.temporary_password}
                  onChange={(e) => setFormData({ ...formData, temporary_password: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-mono"
                />
                <p className="mt-1 text-[10px] text-zinc-400">
                  Employee will be forced to change this password on their first login.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal with Dry Run Error Report */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-zinc-900">CSV Bulk Import with Dry-Run</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-3">
              Paste CSV contents below. The system checks every row against existing codes, emails,
              departments, and designations before performing changes.
            </p>

            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="employee_code,first_name,last_name,email,department,designation,basic_salary,joining_date&#10;EMP101,John,Doe,john@acme.com,Engineering,Software Engineer,60000,2026-01-15"
              className="w-full rounded-2xl border border-zinc-300 p-3 text-xs font-mono focus:border-indigo-600 focus:outline-hidden"
            />

            {/* Dry Run / Import Results */}
            {importResult && (
              <div className="my-4 space-y-3">
                {importResult.dry_run ? (
                  <div
                    className={`rounded-2xl p-4 border text-xs ${
                      importResult.isValid
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {importResult.isValid ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      )}
                      <span>
                        Dry Run Complete: {importResult.validCount} valid row(s),{' '}
                        {importResult.errorCount} error(s)
                      </span>
                    </div>

                    {importResult.errors?.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-amber-200 font-semibold">
                              <th className="py-1">Row</th>
                              <th className="py-1">Field</th>
                              <th className="py-1">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {importResult.errors.map((err, i) => (
                              <tr key={i}>
                                <td className="py-1 font-mono">{err.row}</td>
                                <td className="py-1 font-semibold">{err.field}</td>
                                <td className="py-1 text-rose-700">{err.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : importResult.success ? (
                  <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>{importResult.message}</span>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-rose-50 p-4 border border-rose-200 text-xs text-rose-800 font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{importResult.error}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCSVAction(true)}
                disabled={importLoading || !csvContent.trim()}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition disabled:opacity-50"
              >
                {importLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Run Dry-Run Check'}
              </button>
              <button
                type="button"
                onClick={() => handleCSVAction(false)}
                disabled={
                  importLoading ||
                  !csvContent.trim() ||
                  (importResult?.dry_run && !importResult?.isValid)
                }
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition disabled:opacity-50"
              >
                Execute Full Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee 360 Drawer / Modal */}
      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Employee 360 View</h3>
              <button onClick={() => setSelectedEmp(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 font-bold text-lg">
                  {selectedEmp.first_name[0]}
                  {selectedEmp.last_name[0]}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-zinc-900">
                    {selectedEmp.first_name} {selectedEmp.last_name}
                  </h4>
                  <p className="text-zinc-500 font-mono">{selectedEmp.employee_code}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                <div>
                  <span className="text-zinc-400 font-medium">Department</span>
                  <p className="font-semibold text-zinc-800 mt-0.5">
                    {selectedEmp.department_id?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Designation</span>
                  <p className="font-semibold text-zinc-800 mt-0.5">
                    {selectedEmp.designation_id?.title || 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Email</span>
                  <p className="font-semibold text-zinc-800 mt-0.5">{selectedEmp.email}</p>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Status</span>
                  <p className="font-bold uppercase text-emerald-700 mt-0.5">
                    {selectedEmp.status}
                  </p>
                </div>
              </div>

              {isHRorAdmin && (
                <div className="rounded-2xl border border-zinc-200 p-4 space-y-2">
                  <h5 className="font-bold text-zinc-900">Salary Structure Breakdown</h5>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="rounded-xl bg-zinc-50 p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-400">Basic</span>
                      <p className="font-bold text-zinc-900">PKR {(selectedEmp.basic_salary || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-zinc-50 p-2 border border-zinc-100">
                      <span className="text-[10px] text-zinc-400">HRA (40%)</span>
                      <p className="font-bold text-zinc-900">PKR {(selectedEmp.hra || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-indigo-50 p-2 border border-indigo-100">
                      <span className="text-[10px] text-indigo-600 font-semibold">Gross (1.5x)</span>
                      <p className="font-bold text-indigo-700">PKR {(selectedEmp.gross_salary || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedEmp(null)}
                className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
