'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building,
  Briefcase,
  PlaneTakeoff,
  Calendar,
  UserPlus,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  KeyRound,
  UserCheck,
  UserX,
  Lock,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function SettingsManager() {
  const { token, user: activeUser } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('company');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Company Settings
  const [companySettings, setCompanySettings] = useState({
    company_name: '',
    office_start: '09:00',
    grace_minutes: 15,
    half_day_hours: 5,
    weekend_days: [0, 6],
    office_lat: '',
    office_lng: '',
    office_radius_meters: 150,
  });

  // Lists
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [userList, setUserList] = useState([]);

  // Form inputs
  const [newDept, setNewDept] = useState({ name: '', code: '' });
  const [newDesig, setNewDesig] = useState({ title: '', department_id: '' });
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '' });
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'hr' });
  const [resetPwdModal, setResetPwdModal] = useState({ isOpen: false, userId: null, newPassword: '' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [setRes, deptRes, desigRes, ltRes, holRes, usersRes] = await Promise.all([
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/designations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/leave-types', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/holidays', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (setRes.ok) {
        const s = await setRes.json();
        if (s.settings) setCompanySettings(s.settings);
      }
      if (deptRes.ok) {
        const d = await deptRes.json();
        setDepartments(d.departments || []);
      }
      if (desigRes.ok) {
        const des = await desigRes.json();
        setDesignations(des.designations || []);
      }
      if (ltRes.ok) {
        const lt = await ltRes.json();
        setLeaveTypes(lt.leaveTypes || []);
      }
      if (holRes.ok) {
        const h = await holRes.json();
        setHolidays(h.holidays || []);
      }
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUserList(u.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(companySettings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ text: 'Company settings updated successfully', type: 'success' });
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newDept),
      });
      if (res.ok) {
        setNewDept({ name: '', code: '' });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDesig = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/designations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newDesig),
      });
      if (res.ok) {
        setNewDesig({ title: '', department_id: '' });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/holidays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newHoliday),
      });
      if (res.ok) {
        setNewHoliday({ name: '', date: '' });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error, type: 'error' });
      } else {
        setMsg({ text: `${newUser.role.toUpperCase()} account (${newUser.email}) created successfully`, type: 'success' });
        setNewUser({ email: '', password: '', role: 'hr' });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleUserStatus = async (userId, action) => {
    try {
      const res = await fetch('/api/admin/users/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: userId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error, type: 'error' });
      } else {
        setMsg({ text: data.message, type: 'success' });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target_user_id: resetPwdModal.userId,
          action: 'reset_password',
          new_password: resetPwdModal.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error, type: 'error' });
      } else {
        setMsg({ text: 'User password reset. User will be forced to change it on login.', type: 'success' });
        setResetPwdModal({ isOpen: false, userId: null, newPassword: '' });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const tabs = [
    { id: 'company', label: 'Office Hours & Policies', icon: Settings },
    { id: 'users', label: 'User & Access Accounts', icon: Shield },
    { id: 'departments', label: 'Departments', icon: Building },
    { id: 'designations', label: 'Designations', icon: Briefcase },
    { id: 'leaves', label: 'Leave Quotas', icon: PlaneTakeoff },
    { id: 'holidays', label: 'Public Holidays', icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header: Icon with Heading and Below Description */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">System & Organization Settings</h1>
          <p className="text-xs text-zinc-500">Configure business rules, office timings, leave quotas, and internal user logins</p>
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

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Company Policies & Timings */}
      {activeSubTab === 'company' && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs max-w-2xl">
          <div className="flex items-center gap-2.5 mb-1">
            <Clock className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-zinc-900">Office Timings & Geofencing Parameters</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-5">
            Configure standard office operating hours, grace period threshold, and GPS geofence radius.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Company Name</label>
              <input
                type="text"
                required
                value={companySettings.company_name}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, company_name: e.target.value })
                }
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Office Start Time</label>
                <input
                  type="time"
                  required
                  value={companySettings.office_start}
                  onChange={(e) =>
                    setCompanySettings({ ...companySettings, office_start: e.target.value })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={companySettings.grace_minutes}
                  onChange={(e) =>
                    setCompanySettings({ ...companySettings, grace_minutes: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
                />
                <span className="text-[10px] text-zinc-400">Arrivals after 09:15 are marked Late</span>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Half-Day Threshold (Hours)</label>
              <input
                type="number"
                required
                min={1}
                value={companySettings.half_day_hours}
                onChange={(e) =>
                  setCompanySettings({ ...companySettings, half_day_hours: Number(e.target.value) })
                }
                className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs focus:border-indigo-600 focus:outline-hidden"
              />
              <span className="text-[10px] text-zinc-400">Total duration under 5 hours triggers half-day status</span>
            </div>

            <div className="pt-2 border-t border-zinc-100">
              <h4 className="font-semibold text-zinc-800 mb-1">Office Geofence Radius (Haversine Check)</h4>
              <p className="text-[11px] text-zinc-400 mb-2">Optional location boundary to restrict employee check-ins within premises</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={companySettings.office_lat || ''}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, office_lat: Number(e.target.value) })
                    }
                    placeholder="24.8607"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={companySettings.office_lng || ''}
                    onChange={(e) =>
                      setCompanySettings({ ...companySettings, office_lng: Number(e.target.value) })
                    }
                    placeholder="67.0011"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Radius (Meters)</label>
                  <input
                    type="number"
                    value={companySettings.office_radius_meters || 150}
                    onChange={(e) =>
                      setCompanySettings({
                        ...companySettings,
                        office_radius_meters: Number(e.target.value),
                      })
                    }
                    placeholder="150"
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
            >
              <Save className="h-4 w-4" /> Save Company Settings
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: User & Access Management (No signup needed; Admin creates all users) */}
      {activeSubTab === 'users' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Create User Form */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-zinc-900">Provision Internal User Login</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Admin privilege: Create verified login accounts for Admin, HR or Employees without public sign-up.
            </p>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">User Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-medium"
                >
                  <option value="hr">HR (Human Resources Manager)</option>
                  <option value="admin">Admin (System Administrator)</option>
                  <option value="employee">Employee (Staff Member)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="user@company.com"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
                <span className="text-[10px] text-zinc-400">User will be forced to reset on first login</span>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Create User Login
              </button>
            </form>
          </div>

          {/* User Accounts List & Status Toggle */}
          <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-zinc-900">Active User Accounts Directory</h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">{userList.length} total</span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Manage login permissions, activate/deactivate accounts, or issue temporary password resets.
            </p>

            <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
              {userList.map((u) => {
                const isSelf = String(u._id) === String(activeUser?.id || activeUser?._id);
                return (
                  <div key={u._id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{u.email}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-rose-100 text-rose-700'
                              : u.role === 'hr'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        {!u.is_active && (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            Deactivated
                          </span>
                        )}
                        {u.must_change_password && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            Must Change Pwd
                          </span>
                        )}
                      </div>
                      {u.employee_id && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Linked Employee: {u.employee_id.first_name} {u.employee_id.last_name} ({u.employee_id.employee_code})
                        </p>
                      )}
                    </div>

                    {!isSelf && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResetPwdModal({ isOpen: true, userId: u._id, newPassword: 'Welcome@123' })}
                          className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset Pwd
                        </button>

                        {u.is_active ? (
                          <button
                            onClick={() => handleToggleUserStatus(u._id, 'deactivate')}
                            className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                          >
                            <UserX className="h-3.5 w-3.5" /> Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleUserStatus(u._id, 'activate')}
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50"
                          >
                            <UserCheck className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Departments */}
      {activeSubTab === 'departments' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Building className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-zinc-900">Register New Department</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Create organizational units for workforce grouping and payroll reporting.</p>

            <form onSubmit={handleAddDept} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Department Name</label>
                <input
                  type="text"
                  required
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  placeholder="e.g. Engineering"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Code</label>
                <input
                  type="text"
                  required
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                  placeholder="ENG"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add Department
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Building className="h-5 w-5 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900">Current Departments ({departments.length})</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">List of active functional departments across the company.</p>

            <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
              {departments.map((d) => (
                <div key={d._id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-zinc-900">{d.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-zinc-400">({d.code})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Designations */}
      {activeSubTab === 'designations' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-zinc-900">Create Job Designation</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Define titles and rank positions linked to corporate departments.</p>

            <form onSubmit={handleAddDesig} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Designation Title</label>
                <input
                  type="text"
                  required
                  value={newDesig.title}
                  onChange={(e) => setNewDesig({ ...newDesig, title: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Department</label>
                <select
                  value={newDesig.department_id}
                  onChange={(e) => setNewDesig({ ...newDesig, department_id: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                >
                  <option value="">Select Department (Optional)</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add Designation
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="h-5 w-5 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900">Existing Job Titles ({designations.length})</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Configured roles eligible for employee registration.</p>

            <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
              {designations.map((des) => (
                <div key={des._id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">{des.title}</span>
                  <span className="text-zinc-400 text-[11px]">{des.department_id?.name || 'All'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Leave Quotas */}
      {activeSubTab === 'leaves' && (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs max-w-xl">
          <div className="flex items-center gap-2 mb-1">
            <PlaneTakeoff className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-zinc-900">Annual Leave Quota Allocation</h3>
          </div>
          <p className="text-xs text-zinc-500 mb-4">Official policy quotas per employee per calendar year (skipping weekends & holidays).</p>

          <div className="divide-y divide-zinc-100">
            {leaveTypes.map((lt) => (
              <div key={lt._id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-zinc-900">{lt.name}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">Code: {lt.code} • Paid: {lt.is_paid ? 'Yes' : 'No'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-700 bg-zinc-50 px-3 py-1 rounded-xl border border-zinc-200">
                    {lt.quota >= 999 ? 'Unlimited' : `${lt.quota} days/yr`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 6: Public Holidays */}
      {activeSubTab === 'holidays' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h3 className="text-sm font-bold text-zinc-900">Declare Public Holiday</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Exempt calendar dates from attendance and leave working-day calculations.</p>

            <form onSubmit={handleAddHoliday} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  placeholder="e.g. Independence Day"
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" /> Add Holiday
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-5 w-5 text-zinc-400" />
              <h3 className="text-sm font-bold text-zinc-900">Declared Company Holidays ({holidays.length})</h3>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Dates exempted from monthly payroll working-day deductions.</p>

            <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto">
              {holidays.map((h) => (
                <div key={h._id} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-900">{h.name}</span>
                  <span className="font-mono text-zinc-500">{h.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resetPwdModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-zinc-200">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="h-5 w-5 text-amber-600" />
              <h4 className="font-bold text-sm text-zinc-900">Reset User Password</h4>
            </div>
            <p className="text-xs text-zinc-500 mb-4">Set a temporary password. User will be forced to change it on next login.</p>

            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">New Temporary Password</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={resetPwdModal.newPassword}
                  onChange={(e) => setResetPwdModal({ ...resetPwdModal, newPassword: e.target.value })}
                  className="w-full rounded-xl border border-zinc-300 p-2.5 text-xs font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetPwdModal({ isOpen: false, userId: null, newPassword: '' })}
                  className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
