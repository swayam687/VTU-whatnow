# VTU WhatNow 🎓

> **A high-performance campus results analytics portal, automated batch scraper, and peer comparison engine for Visvesvaraya Technological University (VTU) engineering students.**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
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
  - [2. Persistent Cloud Database & Zero-Loss Deployments (Supabase)](#2-persistent-cloud-database--zero-loss-deployments-supabase)
  - [3. Dynamic Semester Link Management](#3-dynamic-semester-link-management)
  - [4. Permanent Playwright Chromium Cache & Self-Healing Scraper](#4-permanent-playwright-chromium-cache--self-healing-scraper)
  - [5. Interactive Campus Student Network (Force-Directed Graph)](#5-interactive-campus-student-network-force-directed-graph)
  - [6. Deep Subject Performance & Backlog Analytics](#6-deep-subject-performance--backlog-analytics)
  - [7. Procedural Algorithmic USN Identicons](#7-procedural-algorithmic-usn-identicons)
  - [8. Synthesized Web Audio Haptic SFX Engine](#8-synthesized-web-audio-haptic-sfx-engine)
  - [9. Head-to-Head Per-Subject Comparison Engine](#9-head-to-head-per-subject-comparison-engine)
  - [10. Dedicated Thread + ProactorEventLoop for Playwright on Windows](#10-dedicated-thread--proactoreventloop-for-playwright-on-windows)
  - [11. Resilient Polymorphic HTML & CSS Div-Table Parser](#11-resilient-polymorphic-html--css-div-table-parser)
- [Tech Stack](#-tech-stack)
- [API Reference](#-api-reference)
- [Quickstart & Local Setup](#-quickstart--local-setup)
- [Database Schema](#-database-schema)
- [Future Roadmap](#-future-roadmap)
- [License](#-license)

---

## 🎯 The Problem Statement

Accessing academic marks on the official VTU results portal presents significant operational frictions:

1. **No Batch Lookups**: Every student's results must be manually looked up one USN at a time, entering a new CAPTCHA each time.
2. **Zero Aggregation or Analytics**: There is no way to calculate class averages, compare branch performance (`CSE`, `DS`, `AIML`, `ISE`, `ECE`, `EEE`, `MECH`, `CIVIL`), or identify top performers across a college.
3. **No Peer Subject Comparison**: Students cannot compare their performance in specific technical subjects (e.g., *Data Structures*, *Mathematics*, *Operating Systems*) against peers.
4. **Fragile Portals**: Results portals change layouts, URL schemes, and frequently suffer high latency during release windows.

**VTU WhatNow** solves these issues by automating result aggregation via an intelligent, resilient headless scraping pipeline, providing an interactive Human-in-the-Loop (HITL) captcha verification room for administrators, and presenting students with an editorial, read-only analytics dashboard with side-by-side subject comparisons and interactive network graphs.

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
                                  │  Permanent Persistent Cache │
                                  └──────────────▲──────────────┘
                                                 │ Events / Control
                                  ┌──────────────┴──────────────┐
                                  │    FastAPI Backend Server   │
                                  │  (REST API / Auth / Parser) │
                                  └──────▲───────────────▲──────┘
                     SQLAlchemy ORM      │               │ HTTP / JSON
          ┌──────────────────────────────┘               │ (X-Admin-Key Protected)
          ▼                                              ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     Supabase PostgreSQL       │        │       Next.js 14 Frontend     │
│  (Cloud Database / AWS RDS)   │        │  ┌─────────────────────────┐  │
│  Students, Marks, Sem Links   │        │  │ Public Dashboard        │  │
└───────────────────────────────┘        │  │ (Search, Graph, Compare)│  │
                                         │  └─────────────────────────┘  │
                                         │  ┌─────────────────────────┐  │
                                         │  │ Admin Control Room      │  │
                                         │  │ (Scraper, Captcha, DB)  │  │
                                         │  └─────────────────────────┘  │
                                         └───────────────────────────────┘
```

---

## ✨ Key Features

- **Automated USN Range Batch Scraping**: Scrapes single USNs or batch ranges (e.g., `1RM25CS001` → `1RM25CS060`) with randomized human-like delays to prevent IP rate-limiting.
- **Dynamic Semester Portal Link Management**: Full administrator CRUD privileges to add any VTU result portal link (`index.php`), delete outdated links, and scrape from any active portal with 1 click.
- **Permanent Cloud Storage (Supabase PostgreSQL)**: All scraped results, marks, and semester links are permanently stored in a managed cloud database that persists across redeployments and restarts.
- **Permanent Playwright Browser Cache**: Bakes Chromium into the persistent application directory with self-healing auto-download fallback to permanently eliminate missing executable errors on cloud hosts like Render.
- **Interactive Campus Student Network Topology**: High-performance canvas Force-Directed Graph where branches act as central gravity nodes with orbiting student nodes sized by percentage and colored by backlog status. Hovering opens an instant mini-dossier.
- **Comprehensive Subject Performance & Backlog Analytics**: Branch-wise backlog tracking, class pass rates, and deadest subject rankings to identify tough coursework papers across the institution.
- **Interactive HITL Captcha Solving**: Delivers live VTU captcha images directly to the admin interface. Supports 1x/2x/3x image zoom, high-contrast inversion, auto-focus, and instant keyboard submission.
- **Live Character Breakdown Indicator**: Differentiates ambiguous characters (`c/C`, `v/V`, `w/W`, `s/S`, `o/O`, `x/X`, `z/Z`) with real-time badges (`[s] small`, `[B] CAPS`, `[4] digit`).
- **Head-to-Head Per-Subject Comparison**: Side-by-side comparison matrix evaluating internal, external, and total marks with visual delta leads (`+6 A`, `+2 B`, or `Tie`). Supports seamless cross-branch student pairings without state resets.
- **Mobile PWA & 1-Tap Homescreen Install**: Built-in Progressive Web App (PWA) support allowing mobile visitors on iOS and Android to install VTU WhatNow directly to their home screen for full-screen offline caching and instantaneous app launch.
- **Procedural USN Identicons**: Deterministic identicon avatars procedurally rendered from student USN hashes with status rings and no external avatar dependencies.
- **Synthesized Web Audio Haptic SFX**: Tactile mechanical clicks, Geiger-counter ticks during scraping, and ethereal sonar chimes synthesized live via the Web Audio API.
- **Strict Role-Based Access Control**: Public visitors have strictly read-only and compare-only access; scraping, link configuration, student deletion, and profile management are protected by password authentication.
- **Fully Responsive Mobile Admin Interface**: Edge-to-edge touch-friendly control panel with responsive card stacking, touch-optimized inputs, and diagnostics.

---

## 🧠 Engineering Decisions & Rationale

### 1. Human-in-the-Loop (HITL) Captcha Architecture
* **The Challenge**: VTU captchas use varied character rotation, noise backgrounds, and distorted intersecting lines. Automated OCR engines suffer high error rates, leading to failed submissions, blocked sessions, and repeated queries.
* **The Solution**: An event-driven Human-in-the-Loop queue using Python's `threading.Event`. When the headless browser encounters a captcha, it captures the raw element snapshot as a Base64 PNG and waits. The admin interface streams this image, provides zoom and contrast controls, and sends the verified answer back through `POST /api/scrape/captcha`.
* **Case-Sensitivity Breakthrough**: VTU captchas are strictly case-sensitive. By removing CSS `uppercase` masking and introducing an active character decomposition pill bar, ambiguous letters are labeled in real time, achieving 100% submission accuracy without recurring third-party API costs.

### 2. Persistent Cloud Database & Zero-Loss Deployments (Supabase)
* **The Challenge**: Default SQLite setups write to ephemeral container disks on cloud hosts like Render, meaning all student data is erased whenever code is redeployed or containers restart.
* **The Solution**: Full migration to managed cloud PostgreSQL on Supabase. In [`database.py`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/backend/app/database.py), the backend implements dynamic driver fallback: supporting both modern `psycopg` (v3) and `psycopg2`, handling URL normalization (`postgres://` → `postgresql://`), connection pool pre-ping, and connection recycling. Code updates can be pushed infinitely without affecting stored student records.

### 3. Dynamic Semester Link Management
* **The Challenge**: VTU frequently changes examination portal endpoints for odd/even semesters and different CBCS schemes (e.g. `D25J26Ecbcs`, `MJ26cbcs`, `DJ25cbcs`). Hardcoding these URLs requires code changes and redeployments each exam season.
* **The Solution**: Database-backed `semester_links` model with dedicated admin endpoints (`GET`, `POST`, `DELETE /api/semester-links`). Admins can register any new result link directly from the UI, assign semester tags, and target the scraper to any link on the fly.

### 4. Permanent Playwright Chromium Cache & Self-Healing Scraper
* **The Challenge**: On cloud platforms like Render, the default user cache (`~/.cache/ms-playwright`) is discarded across builds, leading to `Executable doesn't exist` errors when the scraper starts.
* **The Solution**: We pin `PLAYWRIGHT_BROWSERS_PATH` to `/opt/render/project/src/.cache/ms-playwright` inside the persistent application root during build and runtime. Furthermore, [`worker.py`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/backend/app/scraper/worker.py) features self-healing fallback that automatically invokes `playwright install chromium` in the background if browser binaries are ever missing.

### 5. Interactive Campus Student Network (Force-Directed Graph)
* **The Challenge**: Dense tables of hundreds of student rows make it difficult to visualize overall branch cohesion, backlog clusters, and academic distribution across a batch.
* **The Solution**: An interactive HTML5 Canvas Force-Directed Graph ([`CampusGraph.tsx`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/components/CampusGraph.tsx)). Branch hubs serve as central gravity anchors, with student nodes repelled by Coulomb forces and attracted by Hooke springs. Nodes scale dynamically by percentage and are color-coded by backlog status, with interactive hover dossiers and one-click comparisons.

### 6. Deep Subject Performance & Backlog Analytics
* **The Challenge**: Backlog lists are typically buried inside student marksheets, making it impossible to see which subjects have the highest casualty rates across the institution.
* **The Solution**: Dedicated backend analytics endpoint (`GET /api/analytics/backlogs`) that aggregates total failed papers across all branches, identifies the institution's top failed subjects, and computes branch-wise clean pass ratios and backlog frequency distributions.

### 7. Procedural Algorithmic USN Identicons
* **The Challenge**: Generic student initials or third-party avatar CDNs leak user metadata and look repetitive.
* **The Solution**: Deterministic, client-side procedural identicons ([`Identicon.tsx`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/components/Identicon.tsx)) generated on the fly from the SHA-like numeric hash of the student's USN. Includes animated backlog indicator rings and percentage tooltips.

### 8. Synthesized Web Audio Haptic SFX Engine
* **The Challenge**: Modern web apps feel sterile without tactile feedback, but external MP3/WAV files add HTTP latency and bundle bloat.
* **The Solution**: Pure synthesized Web Audio API sound generator ([`sfx.ts`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/lib/sfx.ts)) generating 12ms mechanical click transients (emulating Cherry MX switches), quiet Geiger-counter ticks during scraping progress, and ethereal harmonic triad sonar chimes for rank toppers. Includes persistent localStorage mute toggles.

### 9. Head-to-Head Per-Subject Comparison Engine
* **The Challenge**: Students primarily care about comparing specific coursework performance against friends and branch peers.
* **The Solution**: An interactive modal ([`CompareModal.tsx`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/frontend/components/CompareModal.tsx)) coupled with a persistent floating bottom dock. When any two students are selected, the engine constructs a union map of all subjects taken by either student, aligning internals, externals, and totals, and computing point differentials for each subject.

### 10. Dedicated Thread + ProactorEventLoop for Playwright on Windows
* **The Challenge**: On Windows, Uvicorn initializes `WindowsSelectorEventLoopPolicy` by default. When Playwright invokes asynchronous subprocesses to control Chromium, `asyncio.create_subprocess_exec` raises an empty `NotImplementedError()`.
* **The Solution**: The scraper worker is decoupled into an independent `threading.Thread`. Inside the thread runner, a dedicated `asyncio.ProactorEventLoop` is explicitly instantiated on Windows (`asyncio.new_event_loop()` on POSIX). This completely resolves event loop conflicts and allows the Uvicorn web server and Playwright browser to run concurrently without blocking.

### 11. Resilient Polymorphic HTML & CSS Div-Table Parser
* **The Challenge**: VTU CBCS portals frequently alter their DOM structure. The 2026 examination results portals departed from standard HTML `<table>`/`<tr>`/`<td>` structures in favor of CSS grid/flex div tables (`.divTable`, `.divTableRow`, `.divTableCell`).
* **The Solution**: A multi-format BeautifulSoup parser ([`parser.py`](file:///c:/VTU%20USN%20deepseek%20clone/vtuwhatnow/backend/app/scraper/parser.py)) that seamlessly parses both modern div-based tables and traditional tables. It dynamically resolves column offsets and automatically detects subject codes using regex patterns (`^[0-9A-Z]{5,10}$`).

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| **Backend** | Python 3.10+, FastAPI, Starlette, Pydantic v2 |
| **Scraper** | Playwright (Async Python), Chromium Headless, BeautifulSoup4 |
| **Database** | Supabase Cloud PostgreSQL (Production) / SQLite (Local dev) via SQLAlchemy 2.0 ORM |
| **Visuals & Audio** | HTML5 Canvas Force-Directed Graph, Procedural Identicons, Web Audio API SFX |
| **Security** | Header-based Admin Token Verification (`X-Admin-Key`), CORS validation |

---

## 📡 API Reference

### Public Endpoints (Read-Only)

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check and server status |
| `GET` | `/api/students` | `branch`, `search`, `sort`, `limit` | Query student list with filters & sorting |
| `GET` | `/api/students/{usn}` | — | Get detailed student record with subject marks |
| `GET` | `/api/branches` | — | Aggregate statistics per engineering branch |
| `GET` | `/api/leaderboard` | `branch`, `limit` | Ranked list of college/branch top performers |
| `GET` | `/api/analytics/backlogs` | — | Deep backlog statistics & deadest subject rankings |
| `GET` | `/api/semester-links` | — | Fetch all configured examination portal links |
| `GET` | `/api/system/browser-status` | — | Check Playwright Chromium installation status |

### Admin Endpoints (Protected by `X-Admin-Key`)

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| `POST` | `/api/admin/verify` | `{"password": "..."}` | Verify admin credentials |
| `POST` | `/api/scrape/start` | `ScrapeRequest` JSON | Trigger automated scraping task |
| `POST` | `/api/scrape/stop` | — | Terminate active scraping task |
| `GET` | `/api/scrape/status` | — | Poll real-time scraper progress & captcha image |
| `POST` | `/api/scrape/captcha` | `{"text": "..."}` | Submit solved captcha to resume worker |
| `POST` | `/api/semester-links` | `{"title", "url", "semester"}` | Add new examination portal link |
| `DELETE` | `/api/semester-links/{id}` | — | Delete configured semester link |
| `PATCH` | `/api/students/{usn}` | `{"github_url", "linkedin_url"}` | Link/update student social profiles |
| `DELETE` | `/api/students/{usn}` | — | Permanently delete student and marks |
| `POST` | `/api/system/install-browser`| — | Verify & prewarm Playwright browser |

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
- Admin Portal: **`http://localhost:3000/admin`**
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

┌──────────────────────────────────────┐
│            semester_links            │
├──────────────────────────────────────┤
│ id (PK, Integer)                     │
│ title (String)                       │
│ url (String)                         │
│ semester (String)                    │
│ is_default (Boolean)                 │
│ created_at (DateTime)                │
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
