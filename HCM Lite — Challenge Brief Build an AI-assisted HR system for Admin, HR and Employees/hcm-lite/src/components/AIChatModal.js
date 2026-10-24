'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, AlertCircle, CheckCircle2, User, Loader2, Sparkle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AIChatModal({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello ${user?.email?.split('@')[0] || 'there'}! I am your HCM Lite AI Assistant. Ask me anything about company policies, your leave balance, today’s attendance summary, or company headcount.`,
      is_ai_generated: true,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: query }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'Failed to get answer from AI assistant.',
            isError: true,
            is_ai_generated: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            tools_called: data.tools_called || [],
            is_ai_generated: true,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Connection error while communicating with AI service.',
          isError: true,
          is_ai_generated: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts =
    user?.role === 'employee'
      ? [
          'What is my leave balance?',
          'What are the office hours and late arrival rules?',
          'How is gross and net salary calculated?',
        ]
      : [
          "What is today's attendance summary?",
          'Show me late-comers today',
          'What is the current employee headcount?',
          'Summarize leave policy quotas',
        ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex h-[88vh] sm:h-[620px] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header with strictly inline icon and title */}
        <div className="flex items-center justify-between border-b border-indigo-500/20 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-600 px-5 py-3.5 sm:px-6 sm:py-4 text-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md shadow-xs">
              <Bot className="h-5 w-5 text-white shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <h3 className="font-bold text-base sm:text-lg leading-tight truncate">
                  HCM Lite AI Assistant
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                  <Sparkle className="h-2.5 w-2.5 text-amber-300" />
                  Tool-Calling
                </span>
              </div>
              <p className="text-[11px] text-indigo-100/90 font-medium truncate mt-0.5">
                Role scope: <strong className="uppercase tracking-wide text-white">{user?.role}</strong> • Real-time DB Queries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition active:scale-95"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/60">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2.5 sm:gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 font-bold shadow-2xs">
                  <Bot className="h-4 w-4 shrink-0" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-2xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                    : m.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none font-medium'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                {/* Tool calls indicator */}
                {m.tools_called && m.tools_called.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.tools_called.map((tool, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-700 border border-indigo-200/80"
                      >
                        <Sparkles className="h-3 w-3 text-indigo-500" /> Tool: {tool}
                      </span>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.is_ai_generated && (
                  <div className="mt-2 text-[10px] text-slate-400 font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    <span>AI-generated with server-side role scope</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 shadow-2xs">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-white border border-slate-200 px-4 py-3 shadow-2xs flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span>Thinking & querying company data tools...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="border-t border-slate-200/80 bg-white px-4 py-2 sm:px-6">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" /> Suggested queries
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleSend(qp)}
                className="whitespace-nowrap rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 shrink-0"
              >
                {qp}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="border-t border-slate-200 p-3 sm:p-4 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask policies, leave balance, attendance summary..."
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-100 transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:scale-95 transition disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
