# VTU WhatNow 🎓

> **A high-performance campus results analytics portal, automated batch scraper, and peer comparison engine for Visvesvaraya Technological University (VTU) engineering students.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Playwright](https://img.shields.io/badge/Scraper-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy%202.0-D71F00?style=flat-square&logo=python&logoColor=white)](https://www.sqlalchemy.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

## 📑 Table of Contents

- [The Problem Statement](#-the-problem-statement)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Engineering Decisions & Rationale](#-engineering-decisions--rationale)
  - [1. Human-in-the-Loop (HITL) Captcha Architecture](#1-human-in-the-loop-hitl-captcha-architecture)
  - [2. Strict Public vs. Admin RBAC](#2-strict-public-vs-admin-rbac)
  - [3. Dedicated Thread + ProactorEventLoop for Playwright on Windows](#3-dedicated-thread--proactoreventloop-for-playwright-on-windows)
  - [4. Resilient Polymorphic HTML & CSS Div-Table Parser](#4-resilient-polymorphic-html--css-div-table-parser)
  - [5. Head-to-Head Per-Subject Comparison Engine](#5-head-to-head-per-subject-comparison-engine)
  - [6. Zero-Config Local SQLite to PostgreSQL Portability](#6-zero-config-local-sqlite-to-postgresql-portability)
  - [7. Mobile-First & Emoji-Free Production Aesthetic](#7-mobile-first--emoji-free-production-aesthetic)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Quickstart & Local Setup](#-quickstart--local-setup)
- [Database Schema](#-database-schema)
- [Future Roadmap](#-future-roadmap)

---

## 🎯 The Problem Statement

Accessing academic marks on the official VTU results portal presents significant operational frictions:

1. **No Batch Lookups**: Every student's results must be manually looked up one USN at a time, entering a new CAPTCHA each time.
2. **Zero Aggregation or Analytics**: There is no way to calculate class averages, compare branch performance (`CSE`, `DS`, `AIML`, `ISE`, `ECE`), or identify top performers across a college.
3. **No Peer Subject Comparison**: Students cannot compare their performance in specific technical subjects (e.g., *Data Structures*, *Mathematics*, *Operating Systems*) against peers.
4. **Fragile Portals**: Results portals change layouts and frequently suffer high latency during release windows.

**VTU WhatNow** solves these issues by automating result aggregation via an intelligent, resilient headless scraping pipeline, providing an interactive Human-in-the-Loop (HITL) captcha verification room for administrators, and presenting students with a sleek, read-only analytics dashboard with side-by-side subject comparisons.

---

## 🏗️ System Architecture

```
                                  ┌─────────────────────────────┐
                                  │      Official VTU Portal     │
                                  │  (results.vtu.ac.in/MJ26...) │
                                  └──────────────▲──────────────┘
                                                 │ HTTP / Form Submit
                                                 │ Base64 Captcha
                                  ┌──────────────┴──────────────┐
                                  │   Playwright Scraper Engine │
                                  │  (Async Chromium / Thread)  │
                                  └──────────────▲──────────────┘
                                                 │ Events / Control
                                  ┌──────────────┴──────────────┐
                                  │    FastAPI Backend Server   │
                                  │  (REST API / Auth / Parser) │
                                  └──────▲───────────────▲──────┘
                     SQLAlchemy ORM      │               │ HTTP / JSON
          ┌──────────────────────────────┘               │ (X-Admin-Key Protected)
          ▼                                              ▼
┌──────────────────┐                     ┌───────────────────────────────┐
│ Database Storage │                     │       Next.js 14 Frontend     │
│  (SQLite/Postgres│                     │  ┌─────────────────────────┐  │
│  Students/Marks) │                     │  │ Public Dashboard        │  │
└──────────────────┘                     │  │ (Search, Filter,Compare)│  │
                                         │  └─────────────────────────┘  │
                                         │  ┌─────────────────────────┐  │
                                         │  │ Admin Control Room      │  │
                                         │  │ (Scraper, Captcha, DB)  │  │
                                         │  └─────────────────────────┘  │
                                         └───────────────────────────────┘
```

---

## ✨ Key Features

- **Automated USN Range Batch Scraping**: Scrapes single USNs or ranges (e.g., `1RM25CS001` → `1RM25CS060`) with randomized human-like delays to prevent rate-limiting.
- **Interactive HITL Captcha Solving**: Delivers live VTU captcha images directly to the admin interface. Supports 1x/2x/3x image zoom, high-contrast inversion, and instant keyboard submission.
- **Live Character Breakdown Indicator**: Differentiates ambiguous characters (`c/C`, `v/V`, `w/W`, `s/S`, `o/O`, `x/X`, `z/Z`) with real-time badges (`[s] small`, `[B] CAPS`, `[4] digit`).
- **Head-to-Head Per-Subject Comparison**: Side-by-side comparison matrix evaluating internal, external, and total marks with visual delta leads (`+6 A`, `+2 B`, or `Tie`).
- **Branch-Wise Analytics**: Instant filtering and aggregate metrics for `CSE`, `DS`, `CY`, `ISE`, `AIML`, and `ECE`.
- **College & Branch Leaderboards**: Top student podium rankings calculated by total aggregate marks and percentage.
- **Accurate Backlog Tracking**: Automatically classifies any subject with status in `F` (Fail), `A` (Absent), or `W` (Withheld) as an active backlog.
- **Developer Profile Integration**: Connects students' public GitHub and LinkedIn profiles directly to their student record.
- **Role-Based Access Control**: Public visitors have strictly read-only and compare-only access; scraping, student deletion, and profile management are protected by password authentication.

---

## 🧠 Engineering Decisions & Rationale

### 1. Human-in-the-Loop (HITL) Captcha Architecture
* **The Challenge**: VTU captchas use varied character rotation, noise backgrounds, and distorted intersecting lines. Automated OCR engines (like basic Tesseract) suffer high error rates, leading to failed submissions, blocked sessions, and repeated queries.
* **The Solution**: An event-driven Human-in-the-Loop queue using Python's `threading.Event`. When the headless browser encounters a captcha, it captures the raw element snapshot as a Base64 PNG and waits. The admin interface streams this image, provides zoom and contrast controls, and sends the verified answer back through `POST /api/scrape/captcha`.
* **Case-Sensitivity Breakthrough**: VTU captchas are strictly case-sensitive. By removing CSS `uppercase` masking and introducing an active character decomposition pill bar, ambiguous letters are labeled in real time, achieving 100% submission accuracy without recurring third-party API costs.

### 2. Strict Public vs. Admin RBAC
* **The Challenge**: A student results portal must be tamper-proof. Unauthorized users must never be allowed to delete peers' marks, trigger spam scrapers against VTU servers, or alter classmates' socials.
* **The Solution**: The public dashboard is 100% read-only and compare-only. Administrative operations (`/api/scrape/start`, `/api/scrape/stop`, `/api/scrape/captcha`, `DELETE /api/students/{usn}`, and `PATCH /api/students/{usn}`) are protected by a FastAPI dependency verifying `X-Admin-Key`. Session keys are maintained in `sessionStorage` and verified via `POST /api/admin/verify`.

### 3. Dedicated Thread + ProactorEventLoop for Playwright on Windows
* **The Challenge**: On Windows, Uvicorn initializes `WindowsSelectorEventLoopPolicy` by default. When Playwright invokes asynchronous subprocesses to control Chromium, `asyncio.create_subprocess_exec` raises an empty `NotImplementedError()`.
* **The Solution**: The scraper worker is decoupled into an independent `threading.Thread`. Inside the thread runner, a dedicated `asyncio.ProactorEventLoop` is explicitly instantiated on Windows (`asyncio.new_event_loop()` on POSIX). This completely resolves event loop conflicts and allows the Uvicorn web server and Playwright browser to run concurrently without blocking.

### 4. Resilient Polymorphic HTML & CSS Div-Table Parser
* **The Challenge**: VTU CBCS portals frequently alter their DOM structure. The 2026 examination results portals departed from standard HTML `<table>`/`<tr>`/`<td>` structures in favor of CSS grid/flex div tables (`.divTable`, `.divTableRow`, `.divTableCell`).
* **The Solution**: A multi-format BeautifulSoup parser ([`parser.py`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/backend/app/scraper/parser.py)) that seamlessly parses both modern div-based tables and traditional tables. It dynamically resolves column offsets (whether an optional `Sl. No.` column is present) and automatically detects subject codes using regex patterns (`^[0-9A-Z]{5,10}$`).

### 5. Head-to-Head Per-Subject Comparison Engine
* **The Challenge**: Traditional aggregators only display flat student lists. Students primarily care about comparing specific coursework performance against friends.
* **The Solution**: An interactive modal ([`CompareModal.tsx`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/components/CompareModal.tsx)) coupled with a persistent floating bottom dock. When any two students are selected, the engine constructs a union map of all subjects taken by either student, aligning internals, externals, and totals, and computing point differentials for each subject.

### 6. Zero-Config Local SQLite to PostgreSQL Portability
* **The Challenge**: New developers and evaluators should not need a running PostgreSQL container just to run and test the project locally, yet production deployments require enterprise SQL databases.
* **The Solution**: Pinned absolute path resolution in [`database.py`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/backend/app/database.py). If `sqlite:///./vtuwhatnow.db` is configured, it resolves relative to the `backend` folder regardless of the working directory where Uvicorn is launched. To switch to PostgreSQL or Supabase, simply change `DATABASE_URL` in `.env` without modifying any application code.

### 7. Mobile-First & Emoji-Free Production Aesthetic
* **The Challenge**: Many student-built prototypes suffer from tacky emoji clutter (`🏆`, `🚀`, `🔥`, `⚙️`) and broken horizontal layouts on mobile screens.
* **The Solution**: Replaced all emojis with custom, lightweight inline SVGs ([`Icons.tsx`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/components/Icons.tsx)) and unified typography using slate/indigo color palettes. Branch tabs transform into a swipeable pill strip on small screens, and modal dialogs adapt as full-width mobile viewports.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **Backend** | Python 3.10+, FastAPI, Starlette, Pydantic v2 |
| **Scraper** | Playwright (Async Python), Chromium Headless, BeautifulSoup4 |
| **Database** | SQLite (Zero-config local) / PostgreSQL via SQLAlchemy 2.0 ORM |
| **Security** | Header-based Admin Token Verification (`X-Admin-Key`), CORS validation |

---

## 📡 API Reference

### Public Endpoints (Read-Only)

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/students` | `branch`, `search`, `sort`, `limit` | Query student list with filters & sorting |
| `GET` | `/api/students/{usn}` | — | Get detailed student record with subject marks |
| `GET` | `/api/branches` | — | Aggregate statistics per engineering branch |
| `GET` | `/api/leaderboard` | `branch`, `limit` | Ranked list of college/branch top performers |

### Admin Endpoints (Protected by `X-Admin-Key`)

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| `POST` | `/api/admin/verify` | `{"password": "..."}` | Verify admin credentials |
| `POST` | `/api/scrape/start` | `ScrapeRequest` JSON | Trigger automated scraping task |
| `POST` | `/api/scrape/stop` | — | Terminate active scraping task |
| `GET` | `/api/scrape/status` | — | Poll real-time scraper progress & captcha image |
| `POST` | `/api/scrape/captcha` | `{"text": "..."}` | Submit solved captcha to resume worker |
| `PATCH` | `/api/students/{usn}` | `{"github_url", "linkedin_url"}` | Link/update student social profiles |
| `DELETE` | `/api/students/{usn}` | — | Permanently delete student and marks |

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Python 3.10 or higher
- Node.js 18.x or higher
- npm or pnpm

### 1. Backend Setup

```powershell
# Navigate to backend directory
cd vtuwhatnow/backend

# Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\activate      # Windows
# source venv/bin/activate  # macOS/Linux

# Install required packages
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium

# Copy environment configuration
cp .env.example .env

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
- API will run at: **`http://localhost:8000`**
- Interactive Swagger docs: **`http://localhost:8000/docs`**

---

### 2. Frontend Setup

```powershell
# Open a second terminal and navigate to frontend directory
cd vtuwhatnow/frontend

# Install dependencies
npm install

# Start Next.js development server
npm run dev
```
- Web Application: **`http://localhost:3000`**
- Admin Scraper Room: **`http://localhost:3000/admin`**
  - **Default Admin Password**: `admin123` (configurable in `backend/.env`)

---

## 🗄️ Database Schema

```
┌──────────────────────────────────────┐
│               students               │
├──────────────────────────────────────┤
│ usn (PK, String)                     │
│ name (String)                        │
│ branch (String)                      │
│ batch (Integer, Nullable)            │
│ total_marks (Integer)                │
│ max_marks (Integer)                  │
│ percentage (Float)                   │
│ cgpa (Float)                         │
│ total_backlogs (Integer)             │
│ github_url (String, Nullable)        │
│ linkedin_url (String, Nullable)      │
│ updated_at (DateTime)                │
└──────────────────┬───────────────────┘
                   │ 1
                   │
                   │ N
┌──────────────────▼───────────────────┐       ┌────────────────────────────────┐
│                marks                 │       │            subjects            │
├──────────────────────────────────────┤       ├────────────────────────────────┤
│ id (PK, Integer)                     │       │ code (PK, String)              │
│ usn (FK -> students.usn)             │──────▶│ name (String)                  │
│ subject_code (FK -> subjects.code)   │       └────────────────────────────────┘
│ semester (String)                    │
│ internal_marks (Integer)             │
│ external_marks (Integer)             │
│ total (Integer)                      │
│ max_marks (Integer)                  │
│ status (String: P/F/A/W)             │
└──────────────────────────────────────┘
```

---

## 🔮 Future Roadmap

- [ ] **Multi-Semester CGPA Accumulator**: Automatic SGPA to CGPA calculation across multiple semesters.
- [ ] **Class PDF & CSV Export**: Export branch rank lists and subject performance matrices as formatted PDFs.
- [ ] **Telegram/Discord Webhook Notifications**: Push instant alerts when results for a targeted USN batch are officially published.
- [ ] **Class Attendance & Internals Tracker**: Expand portal to track continuous internal evaluation (CIE) test marks.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
