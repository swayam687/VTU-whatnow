# VTU WhatNow • Departmental Results Intelligence 🎓

> **An institutional-grade academic analytics portal, peer comparison engine, and campus network visualizer for engineering departments.**

[![Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![React Bits](https://img.shields.io/badge/UI%20Craft-React%20Bits-6366F1?style=flat-square)](https://reactbits.dev)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20SQLite-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20All%20Rights%20Reserved-red.svg?style=flat-square)](#-intellectual-property--license)

---

## 📑 Overview

**VTU WhatNow** bridges the gap between raw, fragmented university marks lists and actionable academic intelligence. Built with an editorial aesthetic inspired by modern productivity suites, it provides students and departments with instant transparency over semester results, departmental benchmarks, and individual coursework performance.

Rather than looking up individual scorecards in isolation, the platform structures academic records into a centralized, searchable intelligence ledger with interactive graph topology, real-time comparisons, and student verification.

---

## ✨ Core Capabilities

### 1. Departmental Performance & Analytics
- **Live Branch Aggregations**: Instant metric calculation across academic departments (`CSE`, `AIML`, `DS`, `ISE`, `ECE`, etc.).
- **Class Benchmark Metrics**: Real-time evaluation of total students registered, overall class averages, highest batch percentages, and all-clear ratios.
- **Departmental Leaderboard Podiums**: Ranked top performers across branches with distinction indicators and degree aggregates.

### 2. Verified Student Profiles & Identity
- **Account Verification & Token Authentication**: Secure student sign-in ensuring verified USN holders possess exclusive rights to manage their records.
- **Custom 10×10 Pixel Art Avatars**: Algorithmic procedural identicons with an integrated in-browser pixel editor for student personalization.
- **Developer Showcase**: Seamless integration with verified GitHub and LinkedIn profiles directly on student profiles.

### 3. Head-to-Head Peer Comparison Matrix
- **Subject-by-Subject Differential Breakdown**: Side-by-side evaluation of internal assessments, external theory marks, and total scores between any two students.
- **Visual Delta Indicators**: Instant differential tracking (`+A Lead`, `+B Lead`, or `Tie`) across all common subjects in a semester curriculum.
- **Floating Compare Dock**: Persistent bottom dock allowing quick selection and comparison across different departments.

### 4. Interactive Campus Student Network (Force-Directed Graph)
- **Topological Physics Visualization**: High-performance HTML5 Canvas simulation where academic branches serve as gravity anchors and student nodes orbit based on academic standing.
- **Dynamic Dossier Inspection**: Clicking or hovering over any student node reveals their academic stats, branch cluster benchmarks, and standing without page reloads.

### 5. Multi-Semester Ledger & Grade Reconciliation
- **Subject-Level Deduplication**: Mathematically sound reconciliation across multiple semesters (Sem 1, Sem 2, and beyond).
- **Revaluation & Supplementary Resolution**: Automatically applies the highest earned passing score for cleared backlogs while strictly preserving total degree maximum marks.
- **Student Update Request Workflow**: Verified account holders can submit structured marksheet reconciliation requests (revaluations, supplementary exam passes, or missing semesters) directly to administrators.

### 6. High-Craft Editorial UI & Tactile Micro-Interactions
- **React Bits Integration**: 
  - `CountUp`: Smooth tabular number tickers with ease-out physics for class averages and metrics.
  - `BlurText`: Soft-focus editorial entrance for launch headers.
  - `FadeContent`: Cascading progressive section reveals on branch switches.
  - `DecryptedText`: Cybernetic matrix scramble effects on USN badges and marksheet modal headers.
  - `CursorGrid`: Ambient dark-mode tech grid with subtle spotlight physics.
- **Dual Themes**: Handcrafted **Paper White** (editorial clean) and **Obsidian Dark** (terminal tech aesthetic).
- **Responsive Architecture**: Optimized for both high-density laptop data grids and single-column mobile viewports.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Next.js 14 Frontend                           │
│  ┌───────────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │ Campus Analytics Hub  │  │ Peer Comparison   │  │ Student Portal │  │
│  │ (React Bits Physics)  │  │ & Network Graph   │  │ & Identicon UI │  │
│  └───────────────────────┘  └───────────────────┘  └────────────────┘  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP / JSON API
                                    │ (Protected Endpoints & Student Auth)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         FastAPI Application Core                       │
│  ┌───────────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │ Student Auth & Claims │  │ Cumulative Ledger │  │ Admin Audit    │  │
│  │ Token Engine          │  │ Deduplication     │  │ & Governance   │  │
│  └───────────────────────┘  └───────────────────┘  └────────────────┘  │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
                    │ SQLAlchemy ORM                 │ Secure Ingestion
┌───────────────────▼───────────────┐     ┌──────────┴───────────────────┐
│         Relational Storage        │     │  Academic Ingestion Pipeline │
│  (PostgreSQL / SQLite Storage)    │     │  (Verified Ledger Sync &     │
│  Students, Marks, Audits, Logs    │     │   Multi-Sem Data Normalizer) │
└───────────────────────────────────┘     └──────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling & Design** | Tailwind CSS, Custom SVG Iconography, Obsidian / Paper Design Tokens |
| **Animation & Micro-UI** | React Bits (`CountUp`, `BlurText`, `FadeContent`, `DecryptedText`, `CursorGrid`), Motion, GSAP |
| **Backend Services** | Python 3.10+, FastAPI, Pydantic v2, Starlette |
| **Database & ORM** | PostgreSQL / SQLite via SQLAlchemy 2.0 ORM |
| **Audio Synthesis** | Web Audio API Synthetic Sound FX (Mechanical Clicks, Sonar Chimes) |

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js `18.x` or higher
- Python `3.10` or higher
- `npm` or `pnpm`

### 1. Backend Configuration

```bash
# Navigate to the backend directory
cd vtuwhatnow/backend

# Initialize virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start local API service
uvicorn app.main:app --reload --port 8000
```
* Backend API: `http://localhost:8000`
* Interactive API Documentation: `http://localhost:8000/docs`

### 2. Frontend Configuration

```bash
# Open a new terminal and navigate to frontend
cd vtuwhatnow/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
* Dashboard Application: `http://localhost:3000`

---

## 🔒 Security & Privacy Practices

- **Strict Access Control**: Public visitors operate under read-only permissions; record modifications and administrative actions require authenticated session authorization.
- **Owner-Only Modifications**: Social links and marksheet reconciliation requests can only be initiated by the verified owner of the corresponding USN.
- **Zero Exposure of Internal Secrets**: Sensitive environment parameters, database credentials, and operational tokens are strictly managed via decoupled server environment variables and never exposed to the client bundle.

---

## ⚖️ Intellectual Property & License

**Copyright © 2026. All Rights Reserved.**

This software, its design architecture, user interface patterns, data normalization logic, and associated branding are proprietary. 

- **No Unauthorized Duplication**: You may not copy, reproduce, distribute, publish, display, perform, modify, create derivative works from, transmit, or in any way exploit any part of this project or its underlying concepts without prior written permission from the copyright owner.
- **Portfolio Showcase**: This repository is published strictly for viewing, portfolio review, and evaluation purposes.
