/**
 * POST /api/ai/chat
 *
 * AI Assistant powered by xAI Grok (OpenAI-compatible API).
 * Falls back to rule-based responses if AI_API_KEY is not set.
 *
 * Features:
 *  - Role-scoped tool calling (Admin/HR/Employee data gates)
 *  - Dashboard summarizer (mode: 'summarize_dashboard')
 *  - Smart leave extraction (mode: 'smart_leave')
 *  - General HR Q&A with tool calling
 *  - 15-second timeout + friendly fallback
 *  - Rate limit: 20 requests/user/hour
 *  - Every call logged to AILog collection
 */
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
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

// ─── tool definitions (OpenAI function-calling format) ────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_headcount',
      description: 'Get company active employee headcount and status breakdown',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: "Get today's attendance summary (present, late, half-day, on-leave, absent)",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_late_comers',
      description: "Get today's late arrivals with delay minutes (HR/Admin only)",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_leave_summary',
      description: 'Get count of employees on leave today and pending leave approvals',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_leave_balance',
      description: "Get the logged-in employee's remaining leave quotas for each leave type",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payroll_summary',
      description: 'Get monthly payroll cost summary – gross, net, tax (HR/Admin only)',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Month in YYYY-MM format, e.g. 2026-10' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_employees',
      description: 'Search employees by name or employee code',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' },
        },
        required: ['query'],
      },
    },
  },
];

// ─── Grok API call (OpenAI-compatible) ───────────────────────────────────────
async function callGrok(messages, tools, apiKey) {
  const model   = process.env.AI_MODEL || 'grok-3-mini';
  const baseURL = process.env.AI_BASE_URL || 'https://api.x.ai/v1';

  const body = {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1024,
  };
  if (tools && tools.length) body.tools = tools;

  const res = await fetch(`${baseURL}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000), // 15s hard timeout
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Grok API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── fallback (no API key) ────────────────────────────────────────────────────
async function fallbackResponse(lowerMsg, user) {
  const toolsCalled = [];
  let reply = '';

  if (lowerMsg.includes('leave balance') || lowerMsg.includes('my leave')) {
    const res = await executeTool('get_my_leave_balance', {}, user);
    toolsCalled.push('get_my_leave_balance');
    reply = `Your current leave balances:\n${(res.balances || []).map((b) => `• ${b.name}: ${b.remaining} remaining (used ${b.used} of ${b.quota})`).join('\n')}`;
  } else if (lowerMsg.includes('headcount') || lowerMsg.includes('how many employee')) {
    const res = await executeTool('get_headcount', {}, user);
    toolsCalled.push('get_headcount');
    reply = `The company currently has ${res.totalActive ?? res.totalActiveHeadcount} active employees.`;
  } else if (lowerMsg.includes('attendance') || lowerMsg.includes('present today')) {
    const res = await executeTool('get_attendance_summary', {}, user);
    toolsCalled.push('get_attendance_summary');
    reply = `Today's attendance: ${res.present} present, ${res.late} late, out of ${res.totalHeadcount} total.`;
  } else if (lowerMsg.includes('late') || lowerMsg.includes('who came late')) {
    const res = await executeTool('get_late_comers', {}, user);
    toolsCalled.push('get_late_comers');
    reply = res.error ?? `${res.count} late arrivals today.`;
  } else if (lowerMsg.includes('on leave') || lowerMsg.includes('who is on leave')) {
    const res = await executeTool('get_leave_summary', {}, user);
    toolsCalled.push('get_leave_summary');
    reply = `${res.onLeaveToday} employee(s) on leave today. ${res.pendingApprovals} leave request(s) pending approval.`;
  } else {
    reply = 'I\'m your HCM Lite AI Assistant. Ask me about attendance, leave balances, headcount, payroll policies, or office rules. (Set AI_API_KEY in .env.local for full AI capabilities.)';
  }

  return { reply, toolsCalled };
}

// ─── main handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  const t0 = Date.now();
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    if (!checkRateLimit(user._id)) {
      return NextResponse.json(
        { error: 'Rate limit reached: 20 AI queries per hour. Please wait.' },
        { status: 429 }
      );
    }

    const body               = await req.json();
    const { message, mode, kpiData } = body;
    const apiKey             = process.env.AI_API_KEY;

    // ── Mode: Dashboard Summarizer ──────────────────────────────────────────
    if (mode === 'summarize_dashboard') {
      if (!apiKey) {
        const k = kpiData || {};
        const bullets = [
          `• Headcount: ${k.headcount ?? 'N/A'} active employees.`,
          `• Today: ${k.presentToday ?? 0} present, ${k.lateToday ?? 0} late, ${k.onLeaveToday ?? 0} on leave.`,
          `• Pending approvals: ${k.pendingApprovals ?? 0} leave request(s) awaiting HR review.`,
          `• Attendance rate: ${k.attendanceRate ?? 'N/A'}%.`,
        ];
        return NextResponse.json({ reply: bullets.join('\n'), is_ai_generated: true });
      }

      const data = await callGrok([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Summarize these HCM KPI metrics into 3-5 concise bullet insights using ONLY the numbers provided:\n${JSON.stringify(kpiData || {}, null, 2)}` },
      ], [], apiKey);

      return NextResponse.json({
        reply:           data.choices[0].message.content,
        is_ai_generated: true,
      });
    }

    // ── Mode: Smart Leave Extraction ────────────────────────────────────────
    if (mode === 'smart_leave') {
      const today = formatDate(new Date());
      if (!apiKey) {
        return NextResponse.json({
          smart_form:      { type: 'CASUAL', start_date: today, end_date: today, reason: message },
          is_ai_generated: true,
        });
      }

      const data = await callGrok([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract leave details from: "${message}". Today is ${today}.
Return ONLY valid JSON (no markdown):
{"type":"ANNUAL"|"SICK"|"CASUAL"|"UNPAID","start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","reason":"string"}`,
        },
      ], [], apiKey);

      const text  = data.choices[0].message.content || '';
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? (() => { try { return JSON.parse(match[0]); } catch { return null; } })() : null;

      return NextResponse.json({
        smart_form:      parsed ?? { type: 'CASUAL', start_date: today, end_date: today, reason: message },
        is_ai_generated: true,
      });
    }

    // ── Mode: General Chat ──────────────────────────────────────────────────
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const lowerMsg = message.toLowerCase();

    // Hard salary refusal for employees (guardrail layer 1)
    if (
      user.role === 'employee' &&
      (lowerMsg.includes('salary') || lowerMsg.includes('payroll') || lowerMsg.includes('earn')) &&
      !lowerMsg.includes('my salary') && !lowerMsg.includes('my payslip')
    ) {
      const refusal = "⛔ As an employee you are not permitted to view colleagues' salary or company-wide payroll information. You may view your own payslips in your personal dashboard.";
      await AILog.create({ user_id: user._id, user_role: user.role, prompt: message, response: refusal, tools_called: [], latency_ms: Date.now() - t0, status: 'refused' });
      return NextResponse.json({ reply: refusal, is_ai_generated: true });
    }

    // No API key → rule-based fallback
    if (!apiKey) {
      const { reply, toolsCalled } = await fallbackResponse(lowerMsg, user);
      await AILog.create({ user_id: user._id, user_role: user.role, prompt: message, response: reply, tools_called: toolsCalled, latency_ms: Date.now() - t0, status: 'success' });
      return NextResponse.json({ reply, tools_called: toolsCalled, is_ai_generated: true });
    }

    // ── Grok tool-calling loop (max 3 rounds) ───────────────────────────────
    const messages    = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: message },
    ];
    const toolsCalled = [];
    let   finalReply  = '';

    for (let round = 0; round < 3; round++) {
      const data  = await callGrok(messages, TOOLS, apiKey);
      const msg   = data.choices[0].message;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Push assistant message with tool_calls
        messages.push(msg);

        for (const tc of msg.tool_calls) {
          const fname  = tc.function.name;
          const fargs  = (() => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return {}; } })();
          toolsCalled.push(fname);

          const result = await executeTool(fname, fargs, user);
          messages.push({
            role:         'tool',
            tool_call_id: tc.id,
            content:      JSON.stringify(result),
          });
        }
        // Continue loop to let Grok read tool results
        continue;
      }

      // No more tool calls → we have the final answer
      finalReply = msg.content || 'I could not generate a response. Please try again.';
      break;
    }

    if (!finalReply) finalReply = 'I could not generate a response after tool calls. Please rephrase your question.';

    await AILog.create({
      user_id: user._id, user_role: user.role,
      prompt: message, response: finalReply,
      tools_called: toolsCalled, latency_ms: Date.now() - t0, status: 'success',
    });

    return NextResponse.json({ reply: finalReply, tools_called: toolsCalled, is_ai_generated: true });

  } catch (err) {
    console.error('[AI chat]', err.message);
    return NextResponse.json(
      {
        reply: 'The AI assistant encountered a temporary issue. Please try again in a moment.',
        is_ai_generated: true,
        error: err.message,
      },
      { status: 200 } // friendly fallback
    );
  }
}
