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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Navbar({ activeTab, setActiveTab, onOpenAI }) {
  const { user, logout, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    admin: 'bg-rose-50 text-rose-700 border-rose-200/80 shadow-2xs',
    hr: 'bg-violet-50 text-violet-700 border-violet-200/80 shadow-2xs',
    employee: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
        {/* Brand & Role */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 text-white font-extrabold shadow-sm shadow-indigo-200 tracking-wider">
            H
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                HCM Lite
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                  roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block mt-0.5">
              AI-Assisted HR Management
            </p>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold shadow-2xs ring-1 ring-indigo-200/60'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* AI Assistant Button */}
          <button
            onClick={onOpenAI}
            className="group relative inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 active:scale-95 transition-all"
          >
            <Bot className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-6" />
            <span className="whitespace-nowrap">AI Assistant</span>
            <Sparkles className="h-3 w-3 text-amber-300 hidden sm:inline" />
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) markAllRead();
              }}
              className="relative rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 active:scale-95 transition shadow-2xs"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Notifications
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Recent</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50 mt-1">
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

          {/* User Profile & Logout Dropdown */}
          <div className="relative pl-2 border-l border-slate-200 flex items-center gap-1.5">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifs(false);
              }}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 transition active:scale-95 focus:outline-hidden"
              title="Click for account & logout"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-xs uppercase shadow-2xs">
                {user?.email ? user.email[0] : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[120px]">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 capitalize font-medium">{user?.role}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 hidden sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Direct Prominent Logout Button on Navbar (Visible on all screens) */}
            <button
              onClick={logout}
              title="Logout from system"
              className="flex items-center gap-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold transition active:scale-95 shadow-2xs shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span>Logout</span>
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2.5 bg-slate-50/80 rounded-xl border border-slate-100 mb-2">
                  <p className="text-xs font-bold text-slate-900 truncate">{user?.email}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                        roleBadgeColors[user?.role] || 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {user?.role}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">• Active Session</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-50 hover:bg-rose-100/80 text-rose-700 px-3 py-2 text-xs font-bold transition active:scale-95 border border-rose-200/60"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout from HCM Lite</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 transition"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 truncate">{user?.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-rose-600 font-bold hover:underline"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
