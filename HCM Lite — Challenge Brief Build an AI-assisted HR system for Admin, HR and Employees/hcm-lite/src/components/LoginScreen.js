'use client';

import React, { useState } from 'react';
import { Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen({ companyName }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@hcmlite.com');
  const [password, setPassword] = useState('Pass123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-indigo-50 via-white to-zinc-100 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border border-zinc-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white font-bold text-xl shadow-indigo-200 shadow-lg">
            H
          </div>
          <div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              {companyName || 'HCM Lite'}
            </h2>
            <p className="text-xs text-zinc-500">Sign in to your HR portal</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-zinc-300 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-300 pl-10 pr-4 py-2.5 text-sm focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <LogIn className="h-4 w-4" /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-5 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-200 text-xs">
          <p className="font-semibold text-zinc-700 mb-2">1-Click Test Credentials:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('admin@hcmlite.com');
                setPassword('Pass123!');
              }}
              className="rounded-xl border border-rose-200 bg-rose-50/70 p-2 text-center hover:bg-rose-100 transition"
            >
              <p className="font-bold text-rose-700 text-[11px]">Admin</p>
              <p className="text-[10px] text-zinc-500 truncate">admin@...</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('hr@hcmlite.com');
                setPassword('Pass123!');
              }}
              className="rounded-xl border border-violet-200 bg-violet-50/70 p-2 text-center hover:bg-violet-100 transition"
            >
              <p className="font-bold text-violet-700 text-[11px]">HR</p>
              <p className="text-[10px] text-zinc-500 truncate">hr@...</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('employee@hcmlite.com');
                setPassword('Pass123!');
              }}
              className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2 text-center hover:bg-emerald-100 transition"
            >
              <p className="font-bold text-emerald-700 text-[11px]">Employee</p>
              <p className="text-[10px] text-zinc-500 truncate">employee@...</p>
            </button>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400 text-center">Password for all test accounts: <code className="font-mono font-semibold text-zinc-600">Pass123!</code></p>
        </div>
      </div>
    </div>
  );
}
