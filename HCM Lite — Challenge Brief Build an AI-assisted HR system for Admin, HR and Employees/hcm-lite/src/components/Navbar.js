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
    admin: 'bg-rose-100 text-rose-700 border-rose-200',
    hr: 'bg-violet-100 text-violet-700 border-violet-200',
    employee: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Role */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-bold shadow-xs">
            H
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-zinc-900 tracking-tight">HCM Lite</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider border ${
                  roleBadgeColors[user?.role] || 'bg-zinc-100 text-zinc-700 border-zinc-200'
                }`}
              >
                {user?.role}
              </span>
            </div>
            <p className="text-xs text-zinc-500 hidden sm:block">AI-Assisted HR Management</p>
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
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-2xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-zinc-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* AI Assistant Button */}
          <button
            onClick={onOpenAI}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:from-indigo-700 hover:to-violet-700 transition"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) markAllRead();
              }}
              className="relative rounded-xl border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-50 transition"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl z-50">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <h4 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                    Notifications
                  </h4>
                  <span className="text-[11px] text-zinc-400">Recent</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-zinc-50 mt-1">
                  {notifications.length === 0 ? (
                    <p className="py-4 text-center text-xs text-zinc-400">No notifications yet</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n._id} className="py-2 text-xs">
                        <p className="font-medium text-zinc-900">{n.title}</p>
                        <p className="text-zinc-500 mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile & Dropdown */}
          <div className="relative pl-2 border-l border-zinc-200">
            <button
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifs(false);
              }}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-zinc-100 transition focus:outline-hidden"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-xs uppercase shadow-xs">
                {user?.email ? user.email[0] : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-zinc-900 truncate max-w-[120px]">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-zinc-400 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-zinc-400 hidden sm:block" />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl z-50">
                <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                  <p className="text-xs font-semibold text-zinc-900 truncate">{user?.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        roleBadgeColors[user?.role] || 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {user?.role}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden rounded-xl border border-zinc-200 p-2 text-zinc-600"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-1">
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
          <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-500 truncate">{user?.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-rose-600 font-medium"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
