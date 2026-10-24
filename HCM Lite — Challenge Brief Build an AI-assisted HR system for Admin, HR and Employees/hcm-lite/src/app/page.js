'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
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

import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [setupRequired, setSetupRequired] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAI, setShowAI] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-lg">
            H
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <p className="text-xs text-zinc-500 font-medium">Loading HCM Lite...</p>
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
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAI={() => setShowAI(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
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
  );
}
