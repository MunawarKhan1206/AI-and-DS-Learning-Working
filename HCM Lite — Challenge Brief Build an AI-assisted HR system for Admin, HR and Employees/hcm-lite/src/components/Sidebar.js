'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CalendarCheck,
  PlaneTakeoff,
  DollarSign,
  Settings,
  Shield,
  Bell,
  LogOut,
  Bot,
  UserCheck,
  Menu,
  X,
  FileText,
  ChevronDown,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab, onOpenAI, sidebarOpen, setSidebarOpen }) {
  const { user, logout, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  // Build navigation items according to user role per brief permissions
  const navItems = [];

  if (user?.role === 'admin') {
    navItems.push(
      { id: 'dashboard', label: 'Company Overview', icon: Building2 },
      { id: 'employees', label: 'Employees', icon: Users },
      { id: 'attendance_board', label: 'Attendance Board', icon: CalendarCheck },
      { id: 'leave', label: 'Leave Approvals', icon: PlaneTakeoff },
      { id: 'payroll', label: 'Payroll & Finalize', icon: DollarSign },
      { id: 'settings', label: 'Company Settings', icon: Settings },
      { id: 'audit', label: 'Audit Log', icon: Shield }
    );
  } else if (user?.role === 'hr') {
    navItems.push(
      { id: 'dashboard', label: 'HR Dashboard', icon: Building2 },
      { id: 'employees', label: 'Directory & Import', icon: Users },
      { id: 'attendance_board', label: 'Daily Attendance', icon: CalendarCheck },
      { id: 'leave', label: 'Leave Requests', icon: PlaneTakeoff },
      { id: 'payroll', label: 'Payroll Drafts', icon: DollarSign }
    );
  } else if (user?.role === 'employee') {
    navItems.push(
      { id: 'dashboard', label: 'My Dashboard', icon: UserCheck },
      { id: 'calendar', label: 'My Attendance', icon: CalendarCheck },
      { id: 'leave', label: 'Apply Leave', icon: PlaneTakeoff },
      { id: 'payslips', label: 'My Payslips', icon: FileText },
      { id: 'directory', label: 'Directory', icon: Users }
    );
  }

  const roleBadgeColors = {
    admin: 'bg-rose-50 text-rose-700 border-rose-200/80',
    hr: 'bg-violet-50 text-violet-700 border-violet-200/80',
    employee: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 sm:w-72 flex-col bg-white border-r border-slate-200/80 shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white font-extrabold shadow-sm shadow-indigo-200 text-lg">
              H
            </div>
            <div className="min-w-0">
              <span className="font-bold text-base text-slate-950 tracking-tight block leading-none">
                HCM Lite
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mt-1">
                Saylani HR Suite
              </span>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AI Assistant Quick Launcher */}
        <div className="px-4 py-3">
          <button
            onClick={() => {
              onOpenAI();
              setSidebarOpen(false);
            }}
            className="w-full group flex items-center justify-between rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 px-4 py-3 text-white shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 active:scale-98 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <span className="text-xs font-bold block leading-none">AI Assistant</span>
                <span className="text-[10px] text-indigo-100 font-medium">Tool-calling assistant</span>
              </div>
            </div>
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Main Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold shadow-2xs ring-1 ring-indigo-200/80'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
              </button>
            );
          })}
        </div>

        {/* Notifications Bar */}
        <div className="border-t border-slate-100 px-4 py-2 relative">
          <button
            onClick={() => {
              setShowNotifs(!showNotifs);
              if (!showNotifs && unreadCount > 0) markAllRead();
            }}
            className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="h-4 w-4 text-slate-400" />
              <span>Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-2xs">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute left-4 right-4 bottom-14 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notifications
                </h4>
                <span className="text-[10px] text-slate-400 font-medium">Recent</span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 mt-1">
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">No notifications yet</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n._id} className="py-2 text-xs">
                      <p className="font-semibold text-slate-800">{n.title}</p>
                      <p className="text-slate-500 mt-0.5 text-[11px] leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Card & Logout Bottom Area */}
        <div className="border-t border-slate-200/80 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2 bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-xs uppercase shadow-2xs">
                {user?.email ? user.email[0] : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${
                    roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              title="Logout from HCM Lite"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 transition active:scale-95 shadow-2xs cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
