/**
 * POST /api/ai/chat
 *
 * AI Assistant powered by Google Gemini (free tier via @google/generative-ai).
 * Falls back to smart rule-based responses if AI_API_KEY is not set or Gemini errors.
 *
 * Features:
 *  - Role-scoped tool calling (Admin/HR/Employee data gates)
 *  - Dashboard summarizer (mode: 'summarize_dashboard')
 *  - Smart leave extraction (mode: 'smart_leave')
 *  - General HR Q&A with Gemini function calling
 *  - Rate limit: 20 requests/user/hour
 *  - Every call logged to AILog collection
 *
 * Get a FREE Gemini key: https://aistudio.google.com/ → "Get API key"
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { executeTool } from '@/services/ai-tools.service';
import AILog from '@/models/AILog';
import { formatDate } from '@/lib/business-rules';

// ─── rate limiting ────────────────────────────────────────────────────────────
const _rateMap = new Map();
function checkRateLimit(userId) {
  const now    = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const max    = 20;
  let ts = (_rateMap.get(String(userId)) || []).filter((t) => now - t < window);
  if (ts.length >= max) { _rateMap.set(String(userId), ts); return false; }
  ts.push(now);
  _rateMap.set(String(userId), ts);
  return true;
}

// ─── safe AILog helper (never lets logging crash the response) ─────────────────
async function safeLog(data) {
  try {
    await AILog.create(data);
  } catch (e) {
    console.warn('[AILog] logging failed (non-fatal):', e.message);
  }
}

// ─── system prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the AI Assistant for "HCM Lite", an enterprise Human Capital Management system.
Today is ${formatDate(new Date())}.

COMPANY POLICIES & BUSINESS RULES:
1. Attendance: Office starts 09:00, grace 15 min → late after 09:15. Half-day if worked < 5 h. One check-in per day (second = 409). Missing checkout if no checkout.
2. Leave: Working days only (skip weekends Sat-Sun and public holidays). Quotas: Annual 14d, Sick 8d, Casual 10d, Unpaid unlimited. Overlap or over-quota = 422.
3. Payroll: Gross = 1.5 × Basic (HRA 40%, Medical 10%). Per-day = Gross ÷ working days. Deductions: absent + unpaid + 0.5 × half-day days. Tax slabs on annual gross: 0–600k: 0%; 600k–1.2M: 5%; 1.2M–2.4M: 30k+15%; 2.4M–3.6M: 210k+25%; above 3.6M: 510k+35%. HR drafts; Admin finalizes; locked once finalized.
4. Security: Employees NEVER see colleagues' salary or company payroll. Politely refuse any such request.
5. If you don't know, say "I don't have enough data to answer that from company records."
Always base answers on tool results or these policy rules.`;

// ─── tool definitions (Gemini functionDeclarations format) ───────────────────
const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_headcount',
        description: 'Get company active employee headcount and status breakdown',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'get_attendance_summary',
        description: "Get today's attendance summary (present, late, half-day, on-leave, absent)",
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'get_late_comers',
        description: "Get today's late arrivals with delay minutes (HR/Admin only)",
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'get_leave_summary',
        description: 'Get count of employees on leave today and pending leave approvals',
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'get_my_leave_balance',
        description: "Get the logged-in employee's remaining leave quotas for each leave type",
        parameters: { type: 'OBJECT', properties: {} },
      },
      {
        name: 'get_payroll_summary',
        description: 'Get monthly payroll cost summary – gross, net, tax (HR/Admin only)',
        parameters: {
          type: 'OBJECT',
          properties: {
            month: { type: 'STRING', description: 'Month in YYYY-MM format, e.g. 2026-10' },
          },
        },
      },
      {
        name: 'search_employees',
        description: 'Search employees by name or employee code',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search term' },
          },
          required: ['query'],
        },
      },
    ],
  },
];

// ─── smart rule-based fallback (no API key needed) ───────────────────────────
async function fallbackResponse(lowerMsg, user) {
  const toolsCalled = [];
  let reply = '';

  if (lowerMsg.includes('leave balance') || lowerMsg.includes('my leave') || lowerMsg.includes('remaining leave')) {
    const res = await executeTool('get_my_leave_balance', {}, user);
    toolsCalled.push('get_my_leave_balance');
    if (res.error) {
      reply = res.error;
    } else {
      const lines = (res.balances || []).map(
        (b) => `• **${b.name}**: ${b.remaining} days remaining (used ${b.used} of ${b.quota >= 999 ? '∞' : b.quota})`
      );
      reply = `📋 **Your Leave Balances (${new Date().getFullYear()}):**\n\n${lines.join('\n')}`;
    }
  } else if (lowerMsg.includes('headcount') || lowerMsg.includes('how many employee') || lowerMsg.includes('total employee')) {
    const res = await executeTool('get_headcount', {}, user);
    toolsCalled.push('get_headcount');
    const total = res.totalActive ?? res.totalActiveHeadcount;
    reply = `👥 The company currently has **${total} active employees**.`;
    if (res.active !== undefined) {
      reply += `\n• Active: ${res.active}\n• On Probation: ${res.probation}\n• Resigned: ${res.resigned}`;
    }
  } else if (lowerMsg.includes('attendance') || lowerMsg.includes('present today') || lowerMsg.includes('who is present')) {
    const res = await executeTool('get_attendance_summary', {}, user);
    toolsCalled.push('get_attendance_summary');
    reply = `📊 **Today's Attendance (${res.date}):**\n• Present: ${res.present}\n• Late: ${res.late}\n• Half-day: ${res.halfDay}\n• Total Headcount: ${res.totalHeadcount}`;
  } else if (lowerMsg.includes('late') || lowerMsg.includes('who came late')) {
    const res = await executeTool('get_late_comers', {}, user);
    toolsCalled.push('get_late_comers');
    if (res.error) {
      reply = res.error;
    } else if (res.count === 0) {
      reply = '✅ No late arrivals today!';
    } else {
      const names = (res.lateComers || []).map((l) => `• ${l.name} (${l.code}) — ${l.lateMinutes} min late`).join('\n');
      reply = `⏰ **${res.count} late arrival(s) today:**\n${names}`;
    }
  } else if (lowerMsg.includes('on leave') || lowerMsg.includes('who is on leave') || lowerMsg.includes('pending leave') || lowerMsg.includes('leave request')) {
    const res = await executeTool('get_leave_summary', {}, user);
    toolsCalled.push('get_leave_summary');
    reply = `🏖️ **Leave Summary:**\n• On Leave Today: ${res.onLeaveToday} employee(s)\n• Pending Approvals: ${res.pendingApprovals} request(s)`;
  } else if (lowerMsg.includes('office hour') || lowerMsg.includes('start time') || lowerMsg.includes('what time') || lowerMsg.includes('late arrival rule') || lowerMsg.includes('working hour')) {
    reply = `🕘 **Office Hours & Attendance Policy:**\n• Office starts at **09:00 AM**\n• Grace period: **15 minutes** (late after 09:15 AM)\n• Half-day: if worked less than **5 hours**\n• Only **one check-in per day** is allowed`;
  } else if (lowerMsg.includes('leave policy') || lowerMsg.includes('leave quota') || lowerMsg.includes('annual leave') || lowerMsg.includes('sick leave') || lowerMsg.includes('casual leave')) {
    reply = `📅 **Leave Policy:**\n• **Annual Leave**: 14 days/year\n• **Sick Leave**: 8 days/year\n• **Casual Leave**: 10 days/year\n• **Unpaid Leave**: Unlimited\n\nLeave is counted in **working days only** (weekends & public holidays excluded).`;
  } else if (lowerMsg.includes('payroll') || lowerMsg.includes('salary policy') || lowerMsg.includes('how is salary calculated') || lowerMsg.includes('tax')) {
    if (user.role === 'employee') {
      reply = '💰 **Salary Calculation:**\nGross Salary = Basic × 1.5 (includes HRA 40% + Medical 10% of basic).\n\nFor your specific payslip, check the **Payslips** section in your dashboard.';
    } else {
      reply = '💰 **Payroll Policy:**\nGross = Basic × 1.5 (HRA 40% + Medical 10%). Per-day rate = Gross ÷ working days.\nDeductions: absent days + unpaid days + 0.5 × half-days.\n\nHR drafts payroll → Admin finalizes → locked once finalized.';
    }
  } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('help')) {
    const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'hr' ? 'HR Manager' : 'Employee';
    reply = `👋 Hello, **${roleLabel}**! I'm your HCM Lite AI Assistant.\n\nI can help you with:\n• 📋 Leave balances & policies\n• 📊 Attendance summaries\n• 👥 Employee headcount\n• 🕘 Office hours & rules\n• 💰 Payroll policies\n\nJust ask me anything!`;
  } else {
    reply = `🤖 I can answer questions about:\n\n• **Leave balances** — "What is my leave balance?"\n• **Attendance** — "Who is present today?"\n• **Headcount** — "How many employees do we have?"\n• **Office rules** — "What are the office hours?"\n• **Leave policy** — "What is the annual leave quota?"`;
  }

  return { reply, toolsCalled };
}

// ─── main handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  const t0 = Date.now();
  try {
    // Always ensure DB is connected first
    await connectDB();

    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    if (!checkRateLimit(user._id)) {
      return NextResponse.json(
        { error: 'Rate limit reached: 20 AI queries per hour. Please wait.' },
        { status: 429 }
      );
    }

    const body                    = await req.json();
    const { message, mode, kpiData } = body;
    const apiKey                  = (process.env.AI_API_KEY || '').trim();
    const hasKey                  = apiKey.length > 10;

    // ── Mode: Dashboard Summarizer ──────────────────────────────────────────
    if (mode === 'summarize_dashboard') {
      const k = kpiData || {};
      if (!hasKey) {
        const bullets = [
          `• **Headcount:** ${k.headcount ?? 'N/A'} active employees`,
          `• **Today:** ${k.presentToday ?? 0} present, ${k.lateToday ?? 0} late, ${k.onLeaveToday ?? 0} on leave`,
          `• **Pending approvals:** ${k.pendingApprovals ?? 0} leave request(s) awaiting HR review`,
          `• **Attendance rate:** ${k.attendanceRate ?? 'N/A'}%`,
        ];
        return NextResponse.json({ reply: bullets.join('\n'), is_ai_generated: true });
      }

      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: process.env.AI_MODEL || 'gemini-1.5-flash',
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        });
        const result = await model.generateContent(
          `Summarize these HCM KPI metrics into 3-5 concise bullet insights:\n${JSON.stringify(k, null, 2)}`
        );
        return NextResponse.json({ reply: result.response.text(), is_ai_generated: true });
      } catch (aiErr) {
        console.warn('[AI summarize] Gemini error, using fallback:', aiErr.message);
        const bullets = [
          `• **Headcount:** ${k.headcount ?? 'N/A'} active employees`,
          `• **Today:** ${k.presentToday ?? 0} present, ${k.lateToday ?? 0} late, ${k.onLeaveToday ?? 0} on leave`,
          `• **Pending approvals:** ${k.pendingApprovals ?? 0} leave request(s) awaiting review`,
          `• **Attendance rate:** ${k.attendanceRate ?? 'N/A'}%`,
        ];
        return NextResponse.json({ reply: bullets.join('\n'), is_ai_generated: true });
      }
    }

    // ── Mode: Smart Leave Extraction ────────────────────────────────────────
    if (mode === 'smart_leave') {
      const today = formatDate(new Date());
      if (!hasKey) {
        return NextResponse.json({
          smart_form:      { type: 'CASUAL', start_date: today, end_date: today, reason: message },
          is_ai_generated: true,
        });
      }

      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: process.env.AI_MODEL || 'gemini-1.5-flash',
          generationConfig: { temperature: 0.1, maxOutputTokens: 256 },
        });
        const result = await model.generateContent(
          `Extract leave details from: "${message}". Today is ${today}.\nReturn ONLY valid JSON (no markdown):\n{"type":"ANNUAL"|"SICK"|"CASUAL"|"UNPAID","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","reason":"string"}`
        );
        const text   = result.response.text() || '';
        const match  = text.match(/\{[\s\S]*\}/);
        const parsed = match
          ? (() => { try { return JSON.parse(match[0]); } catch { return null; } })()
          : null;
        return NextResponse.json({
          smart_form:      parsed ?? { type: 'CASUAL', start_date: today, end_date: today, reason: message },
          is_ai_generated: true,
        });
      } catch (aiErr) {
        console.warn('[AI smart_leave] Gemini error, using fallback:', aiErr.message);
        return NextResponse.json({
          smart_form: { type: 'CASUAL', start_date: today, end_date: today, reason: message },
          is_ai_generated: true,
        });
      }
    }

    // ── Mode: General Chat ──────────────────────────────────────────────────
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const lowerMsg = message.toLowerCase();

    // Hard salary refusal for employees (guardrail)
    if (
      user.role === 'employee' &&
      (lowerMsg.includes('salary') || lowerMsg.includes('payroll') || lowerMsg.includes('earn')) &&
      !lowerMsg.includes('my salary') && !lowerMsg.includes('my payslip') &&
      !lowerMsg.includes('how is salary') && !lowerMsg.includes('salary policy')
    ) {
      const refusal = "⛔ As an employee you are not permitted to view colleagues' salary or company-wide payroll information. You may view your own payslips in your personal dashboard.";
      await safeLog({ user_id: user._id, user_role: user.role, prompt: message, response: refusal, tools_called: [], latency_ms: Date.now() - t0, status: 'refused' });
      return NextResponse.json({ reply: refusal, is_ai_generated: true });
    }

    // No API key → smart rule-based fallback
    if (!hasKey) {
      const { reply, toolsCalled } = await fallbackResponse(lowerMsg, user);
      await safeLog({ user_id: user._id, user_role: user.role, prompt: message, response: reply, tools_called: toolsCalled, latency_ms: Date.now() - t0, status: 'success' });
      return NextResponse.json({ reply, tools_called: toolsCalled, is_ai_generated: true });
    }

    // ── Gemini tool-calling loop ─────────────────────────────────────────────
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: process.env.AI_MODEL || 'gemini-1.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
        tools: GEMINI_TOOLS,
      });

      const chat        = model.startChat({ history: [] });
      const toolsCalled = [];
      let   finalReply  = '';

      let result   = await chat.sendMessage(message);
      let response = result.response;

      for (let round = 0; round < 3; round++) {
        const parts  = response.candidates?.[0]?.content?.parts || [];
        const fnCall = parts.find((p) => p.functionCall);

        if (!fnCall) {
          finalReply = response.text();
          break;
        }

        const { name: fname, args: fargs = {} } = fnCall.functionCall;
        toolsCalled.push(fname);
        const toolResult = await executeTool(fname, fargs, user);

        result = await chat.sendMessage([
          {
            functionResponse: {
              name:     fname,
              response: { content: toolResult },
            },
          },
        ]);
        response = result.response;
      }

      if (!finalReply) {
        finalReply = response.text() || 'I could not generate a response. Please try again.';
      }

      await safeLog({
        user_id: user._id, user_role: user.role,
        prompt: message, response: finalReply,
        tools_called: toolsCalled, latency_ms: Date.now() - t0, status: 'success',
      });

      return NextResponse.json({ reply: finalReply, tools_called: toolsCalled, is_ai_generated: true });

    } catch (aiErr) {
      // Gemini failed → degrade to rule-based, never show error to user
      console.warn('[AI chat] Gemini error, degrading to rule-based:', aiErr.message);
      const { reply, toolsCalled } = await fallbackResponse(lowerMsg, user);
      await safeLog({ user_id: user._id, user_role: user.role, prompt: message, response: reply, tools_called: toolsCalled, latency_ms: Date.now() - t0, status: 'fallback' });
      return NextResponse.json({ reply, tools_called: toolsCalled, is_ai_generated: true });
    }

  } catch (err) {
    console.error('[AI chat] Fatal error:', err.message, err.stack);
    // Use rule-based as absolute last resort
    try {
      const body     = await req.clone().json().catch(() => ({}));
      const lowerMsg = (body.message || '').toLowerCase();
      const { user } = await requireAuth(req).catch(() => ({ user: null }));
      if (user && lowerMsg) {
        const { reply } = await fallbackResponse(lowerMsg, user);
        return NextResponse.json({ reply, is_ai_generated: true }, { status: 200 });
      }
    } catch { /* ignore */ }
    return NextResponse.json(
      { reply: "I'm having trouble connecting right now. Please try asking about your leave balance, attendance, or office hours.", is_ai_generated: true },
      { status: 200 }
    );
  }
}
