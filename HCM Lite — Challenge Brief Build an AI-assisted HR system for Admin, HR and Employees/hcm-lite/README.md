# HCM Lite — AI-Assisted Human Capital Management

A complete, production-grade, hackathon-ready Human Capital Management (HCM) web application built for the **Saylani Hackathon HCM Lite Challenge**.

It provides a modern, responsive user experience for three roles (**Admin**, **HR**, **Employee**), an **AI Assistant with server-side Tool Calling**, and a **seed-free first-run setup architecture**.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS, Recharts, Lucide React, React Hook Form, Zod |
| **Backend** | Node.js + Express API Server & Next.js Route Handlers (`src/app/api/...`), Mongoose (MongoDB) |
| **Authentication** | JWT in secure HTTP-only cookies, bcryptjs password hashing, server-side RBAC |
| **AI Assistant** | Google Gemini (`@google/generative-ai`) with server-side tool calling & policy Q&A |
| **Document Engine** | jsPDF & jsPDF-AutoTable for confidential payslips |
| **Date Handling** | date-fns & zero-dependency ISO calendar utilities |
| **Testing** | Node.js native assert test runner (`node tests/business-rules.test.js`) |

---

## 🎯 Main Modules & Completed Functionality

### 1. Module 1 — Authentication & Access Control
- **Seed-Free Setup**: Starts empty with no fake employees, attendance, or payroll data. Detects whether an Admin exists (`GET /api/setup/status`).
- **First-Run Setup Screen**: Creates the organization name and initial Admin account (`POST /api/setup/init`).
- **JWT & Role-based Authorization**: Enforced on every backend route.
- **Forced Password Reset**: Accounts created with temporary passwords must update their password on first sign-in before accessing the dashboard (`POST /api/auth/change-password`).
- **Data Scoping**: Employees can **only** access their own attendance, leave, and finalized payslips.

### 2. Module 2 — Organization Setup (Admin)
- Configure office start time (`09:00`), grace period (`15 minutes`), half-day threshold (`5 hours`), weekend days, and geofence coordinates (`GET /api/admin/settings`, `PUT /api/admin/settings`).
- Configure Departments and Designations.
- Configure Leave Types and Annual Quotas (Default: Annual 14, Sick 8, Casual 10, Unpaid unlimited).
- Configure Public Holidays.
- Create and manage HR User Logins (`POST /api/admin/users/hr`).

### 3. Module 3 — Employee Management (HR & Admin)
- Register employees with basic salary, department, designation, and auto-generated temporary password (`POST /api/employees`).
- Employee 360 profile view (`GET /api/employees/:id`).
- Scoped Editing: Employees can **only** edit their phone and address; salaries and departments are locked to HR/Admin.
- **CSV Bulk Import with Dry-Run**: Validates every row and reports a dry-run error table: `row + field + reason` (`POST /api/employees/import`).
- **CSV Export**: Downloads full company directory in CSV (`GET /api/employees/export`).

### 4. Module 4 — Attendance Management
- **Server Timestamps**: Client time cannot be spoofed.
- **One Record Per Day (HTTP 409)**: Re-attempting check-in on the same day returns **HTTP 409 Conflict**.
- **Late Threshold**: Automatically marked late after `09:15` (09:00 + 15m grace).
- **Half-Day Rule**: Check-out evaluates worked duration; flagged as `half_day` if $< 5$ hours.
- **Daily Attendance Board**: Real-time board for HR and Admin (`GET /api/attendance/board`).
- **Corrections Workflow**: Employees request attendance corrections with a reason; HR approves or rejects with comments (`/api/attendance/corrections`).

### 5. Module 5 — Leave Management
- **Working Days Only**: Automatically skips configured weekends and public holidays.
- **Overlapping Leave Rejection (HTTP 422)**: Rejects any overlapping leave request.
- **Over-Balance Rejection (HTTP 422)**: Rejects requests exceeding remaining quota balance.
- **Approval Inbox**: HR approves or rejects with comment; employees can cancel their own eligible requests.
- **Leave Balances**: Real-time balance calculations (`GET /api/leave/balance`).

### 6. Module 6 — Payroll & Payslips
- **Salary Formula**: Gross is computed as $1.5 \times \text{Basic}$ ($40\%$ HRA + $10\%$ Medical).
- **Per-day Rate**: $\text{Gross} / \text{Working Days in Month}$.
- **Deductions**: Absent days + unpaid leave days + $0.5 \times \text{half-days}$.
- **Annual Tax Brackets (Monthly Share = Annual Tax / 12)**:
  - Up to PKR 600,000: $0\%$
  - PKR 600,001–1,200,000: $5\%$ of amount over 600,000
  - PKR 1,200,001–2,400,000: PKR 30,000 + $15\%$ of amount over 1,200,000
  - PKR 2,400,001–3,600,000: PKR 210,000 + $25\%$ of amount over 2,400,000
  - Above PKR 3,600,000: PKR 510,000 + $35\%$ of amount over 3,600,000
- **Admin Finalize & Lock**: Only Admin can finalize payroll (`POST /api/payroll/finalize`). Once finalized, the monthly payroll is **permanently locked**.
- **PDF Payslip Generation**: Formats and downloads confidential PDF payslips using jsPDF.

### 7. Module 7 — Dashboards & Analytics
- 100% computed from live MongoDB queries and aggregations (never hardcoded!).
- **Admin Dashboard**: Headcount by department, Payroll cost by department, Gender distribution, Attrition YTD, Average salary, AI Executive Insights.
- **HR Dashboard**: Active headcount, Present today, Late today, On leave today, Attendance rate, Late %, Top 5 late-comers, Leave usage by type.
- **Employee Dashboard**: Today's check-in/out widget, hours this week vs 40h target progress bar, late count, leave balances, latest payslip card, and announcement feed.

### 8. Module 8 — AI Assistant (`POST /api/ai/chat`)
- Hosted LLM integration using Google Gemini 1.5 Flash.
- **Tool Calling Architecture**: Model selects tool &rarr; Backend validates caller's role/scope &rarr; Returns authorized DB data &rarr; Model writes answer.
- **Supported Tools**: `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`.
- **Colleague Salary Refusal Guardrail**: Employees asking for peer salaries are politely refused at the tool layer.
- **Smart Leave Assistant**: Converts natural language requests (*"need next Monday and Tuesday off for wedding"*) into JSON `{ type, start_date, end_date, reason }`, pre-fills the form, and requires user confirmation.
- **Dashboard Summarizer**: Produces 3–5 bullet insights using only current KPI numbers.
- **Guardrails**: 15s timeout with friendly fallback, rate limited to ~20 requests/hr, audit logging in `ai_logs`, and `"AI-generated"` label.

### 9. Module 9 — Communications & Audit Trail
- **Announcements**: Admin/HR post, all employees read (`/api/announcements`).
- **In-App Notifications**: Real-time alerts for leave approvals, payslip availability, and attendance decisions (`/api/notifications`).
- **Immutable Audit Log**: Admin-only audit feed logging actor, action, entity, timestamp, and before/after JSON snapshots (`/api/audit`).

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** v18+ or v20+
- **MongoDB** running locally (`mongodb://127.0.0.1:27017/hcm-lite`) or a MongoDB Atlas connection string.

### 2. Environment Setup
Copy `.env.example` to `.env.local`:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/hcm-lite
JWT_SECRET=super-secret-jwt-key-for-hcm-lite-min32chars
FRONTEND_URL=http://localhost:3000
AI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-1.5-flash
```

### 3. Running the App
You can run the full Next.js application (which includes frontend + server route handlers) or run the dedicated Express API server:

#### Option A: Full Next.js Application (Recommended)
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

#### Option B: Dedicated Express Server
```bash
npm run server
```
Runs the Express API server on `http://localhost:5000`.

---

## 🧪 Running the Business Rules Test Suite

Execute the automated test suite testing all 8 critical hackathon workflows:

```bash
npm test
# or: node tests/business-rules.test.js
```

**Verified Test Output**:
```text
====================================================
   HCM LITE MASTER BUSINESS RULES & RBAC TEST SUITE  
====================================================

Running Test 1: Tax Slabs Verification...
✓ PASS: All 5 Tax Brackets & Monthly Withholdings computed accurately.

Running Test 2: Salary Structure Math (1.5x Basic)...
✓ PASS: Salary Structure formula (Gross = 1.5 * Basic) verified.

Running Test 3: Attendance Check-in Threshold (Office 09:00 + Grace 15m)...
✓ PASS: Attendance late rule evaluated accurately (09:15 threshold).

Running Test 4: Attendance Half-Day Rule (< 5h)...
✓ PASS: Half-day status applies to worked hours under 5 hours.

Running Test 5: Working Days Calculator...
✓ PASS: Working days accurately exclude configured weekends and public holidays.

Running Test 6: Leave Overlap Detection Logic...
✓ PASS: Overlapping leave detection logic triggers HTTP 422.

Running Test 7: Leave Balance Limit Check (HTTP 422)...
✓ PASS: Over-balance check triggers HTTP 422 rejection.

Running Test 8: AI Colleague Salary Security Guardrail...
✓ PASS: AI security layer refuses employee queries for peer salaries.

====================================================
   🎉 ALL 8 CRITICAL ARCHITECTURE TESTS PASSED!      
====================================================
```

---

## 🧑‍⚖️ Hackathon Judge Demo Script (5-Minute Walkthrough)

1. **First-Run Setup**: Open `http://localhost:3000`. Notice that no dummy data exists. Enter company name (e.g. `Saylani Tech`) and Admin account (`admin@saylani.com` / `Admin@123`).
2. **Company Setup**: Navigate to **Company Settings**. Verify default office hours (`09:00`), grace (`15 min`), leave quotas (`Annual 14, Sick 8, Casual 10, Unpaid`). Create an HR login (`hr@saylani.com` / `HR@123`).
3. **HR Employee Registration**: Log in as `hr@saylani.com`. Go to **Directory & Import**. Register a new employee or use **Import CSV**. Try **Run Dry-Run Check** to observe the validation error report.
4. **Attendance Workflow**: Log in as the new employee (prompted to change temporary password). Click **Check In**. Try checking in again to verify the **HTTP 409 Conflict** error.
5. **Smart Leave Workflow**: In **Leave Management**, click **Smart Leave Assistant** and type: *"Need next Monday and Tuesday off for wedding"*. Notice the form pre-fills the dates, calculates working days (excluding weekends), and checks balance before submission.
6. **Payroll & Lock**: Log in as HR and generate the **Payroll Draft** for the current month. Then log in as Admin and click **Finalize & Lock Payroll**. Verify the run is locked and download the confidential **PDF Payslip**.
7. **AI Assistant & Security Refusal**: Open the AI Assistant as an Employee and ask: *"What is the salary of John?"*. Verify that the AI politely refuses per server-side data isolation rules. Then ask: *"What is my leave balance?"* to see live database results.
8. **Audit Trail**: Switch to Admin and inspect the immutable **Audit Log** tracking every action with before/after state snapshots.
