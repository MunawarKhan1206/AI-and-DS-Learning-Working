'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles, AlertCircle, CheckCircle2, User, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AIChatModal({ isOpen, onClose }) {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        `Hello ${user?.email || 'there'}! I am your HCM Lite AI Assistant. Ask me anything about company policies, your leave balance, today’s attendance summary, or company headcount.`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[600px] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2 backdrop-blur-xs">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">HCM Lite AI Assistant</h3>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                  Tool-Calling
                </span>
              </div>
              <p className="text-xs text-indigo-100">
                Scoped to role: <strong className="uppercase">{user?.role}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-xs ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : m.isError
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-tl-none'
                    : 'bg-white text-zinc-800 border border-zinc-200 rounded-tl-none'
                }`}
              >
                {/* Tool calls indicator */}
                {m.tools_called && m.tools_called.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {m.tools_called.map((tool, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-mono text-indigo-700 border border-indigo-200"
                      >
                        <Sparkles className="h-3 w-3" /> Tool: {tool}
                      </span>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                {m.is_ai_generated && (
                  <div className="mt-2 text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                    <span>✨ AI-generated with tool calling</span>
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-white">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 items-center text-zinc-500 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                <Bot className="h-4 w-4 animate-pulse" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-zinc-200 px-4 py-2.5 shadow-xs">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="text-xs font-medium">Executing tool & generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div className="border-t border-zinc-200 bg-white px-4 py-2 flex flex-wrap gap-1.5">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-indigo-50 hover:text-indigo-600 transition disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-zinc-200 p-4 bg-white flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask a question as ${user?.role || 'user'}...`}
            disabled={loading}
            className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
