'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import SetupScreen from '@/components/SetupScreen';
import LoginScreen from '@/components/LoginScreen';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import AIChatModal from '@/components/AIChatModal';

// Role Dashboards & Feature Components
import AdminDashboard from '@/components/AdminDashboard';
import HRDashboard from '@/components/HRDashboard';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import EmployeeDirectory from '@/components/EmployeeDirectory';
import AttendanceBoard from '@/components/AttendanceBoard';
import LeaveManagement from '@/components/LeaveManagement';
import PayrollManager from '@/components/PayrollManager';
import SettingsManager from '@/components/SettingsManager';
import AuditLogViewer from '@/components/AuditLogViewer';

import { Loader2, Menu, Bot, Bell } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [setupRequired, setSetupRequired] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAI, setShowAI] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, [user]);

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/setup/status');
      if (res.ok) {
        const data = await res.json();
        setSetupRequired(data.isSetupRequired);
        setCompanyName(data.companyName || '');
      }
    } catch (e) {
      console.error('Failed to check setup status:', e);
      setSetupRequired(false);
    }
  };

  if (authLoading || setupRequired === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg">
            H
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-xs text-slate-500 font-medium">Loading HCM Lite...</p>
        </div>
      </div>
    );
  }

  // First Run: System starts EMPTY (No dummy data rule)
  if (setupRequired) {
    return <SetupScreen onCompleted={() => setSetupRequired(false)} />;
  }

  // Not Logged In
  if (!user) {
    return <LoginScreen companyName={companyName} />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50/80">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAI={() => setShowAI(true)}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Layout Area offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 sm:lg:pl-72 transition-all duration-300">
        {/* Mobile Top App Bar */}
        <header className="lg:hidden sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 active:scale-95 transition"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-xs">
                H
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">HCM Lite</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAI(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>AI</span>
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {/* Force Password Change Modal for temporary employee passwords */}
          <ChangePasswordModal />

          {/* AI Assistant Modal */}
          <AIChatModal isOpen={showAI} onClose={() => setShowAI(false)} />

          {/* Views based on role and activeTab */}
          {user.role === 'admin' && (
            <>
              {activeTab === 'dashboard' && <AdminDashboard onOpenAI={() => setShowAI(true)} />}
              {activeTab === 'employees' && <EmployeeDirectory />}
              {activeTab === 'attendance_board' && <AttendanceBoard />}
              {activeTab === 'leave' && <LeaveManagement />}
              {activeTab === 'payroll' && <PayrollManager />}
              {activeTab === 'settings' && <SettingsManager />}
              {activeTab === 'audit' && <AuditLogViewer />}
            </>
          )}

          {user.role === 'hr' && (
            <>
              {activeTab === 'dashboard' && <HRDashboard />}
              {activeTab === 'employees' && <EmployeeDirectory />}
              {activeTab === 'attendance_board' && <AttendanceBoard />}
              {activeTab === 'leave' && <LeaveManagement />}
              {activeTab === 'payroll' && <PayrollManager />}
            </>
          )}

          {user.role === 'employee' && (
            <>
              {activeTab === 'dashboard' && (
                <EmployeeDashboard
                  onOpenAI={() => setShowAI(true)}
                  onOpenLeaveForm={() => setActiveTab('leave')}
                />
              )}
              {activeTab === 'calendar' && <AttendanceBoard />}
              {activeTab === 'leave' && <LeaveManagement />}
              {activeTab === 'payslips' && <PayrollManager />}
              {activeTab === 'directory' && <EmployeeDirectory />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
