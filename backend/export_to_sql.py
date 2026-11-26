import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
db_path = backend_dir / "vtuwhatnow.db"
output_path = backend_dir / "supabase_seed.sql"

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def sql_val(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    s = str(v).replace("'", "''")
    return f"'{s}'"

lines = []
lines.append("-- =============================================")
lines.append("-- VTU WhatNow: Supabase Schema & Seed Script")
lines.append("-- Paste this directly into Supabase SQL Editor")
lines.append("-- =============================================\n")

# DDL for PostgreSQL
lines.append("""
CREATE TABLE IF NOT EXISTS students (
    usn VARCHAR PRIMARY KEY,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    batch INTEGER,
    total_marks INTEGER DEFAULT 0,
    max_marks INTEGER DEFAULT 0,
    percentage DOUBLE PRECISION DEFAULT 0.0,
    cgpa DOUBLE PRECISION DEFAULT 0.0,
    total_backlogs INTEGER DEFAULT 0,
    github_url VARCHAR DEFAULT '',
    linkedin_url VARCHAR DEFAULT '',
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    password_hash VARCHAR,
    is_claimed BOOLEAN DEFAULT FALSE,
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITHOUT TIME ZONE,
    avatar_pixel_art TEXT DEFAULT '',
    comparison_credits INTEGER DEFAULT 2,
    custom_views_offset INTEGER DEFAULT 0,
    custom_comparisons_offset INTEGER DEFAULT 0,
    insights_verified BOOLEAN DEFAULT FALSE,
    insights_verified_at TIMESTAMP WITHOUT TIME ZONE,
    insights_last_ip VARCHAR DEFAULT '',
    show_my_name BOOLEAN DEFAULT TRUE,
    show_my_marks BOOLEAN DEFAULT TRUE,
    show_my_backlogs BOOLEAN DEFAULT TRUE,
    allow_comparison BOOLEAN DEFAULT TRUE,
    is_hidden BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS subjects (
    code VARCHAR PRIMARY KEY,
    name VARCHAR DEFAULT ''
);

CREATE TABLE IF NOT EXISTS marks (
    id SERIAL PRIMARY KEY,
    usn VARCHAR REFERENCES students(usn) ON DELETE CASCADE,
    subject_code VARCHAR REFERENCES subjects(code),
    semester VARCHAR DEFAULT '1',
    internal_marks INTEGER DEFAULT 0,
    external_marks INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    max_marks INTEGER DEFAULT 100,
    status VARCHAR DEFAULT 'P'
);

CREATE TABLE IF NOT EXISTS semester_links (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    url TEXT NOT NULL,
    semester VARCHAR DEFAULT '1',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS faculty (
    id SERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    faculty_id VARCHAR(64) DEFAULT '',
    password_hash VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    department VARCHAR DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE TABLE IF NOT EXISTS student_view_logs (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    viewer_ip VARCHAR DEFAULT '',
    viewer_usn VARCHAR DEFAULT '',
    viewed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS ix_students_name ON students(name);
CREATE INDEX IF NOT EXISTS ix_students_branch ON students(branch);
CREATE INDEX IF NOT EXISTS ix_students_batch ON students(batch);
CREATE INDEX IF NOT EXISTS ix_students_percentage ON students(percentage);
CREATE INDEX IF NOT EXISTS ix_students_cgpa ON students(cgpa);
CREATE INDEX IF NOT EXISTS ix_students_backlogs ON students(total_backlogs);
CREATE INDEX IF NOT EXISTS ix_students_hidden ON students(is_hidden);
CREATE INDEX IF NOT EXISTS ix_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS ix_marks_usn ON marks(usn);
CREATE INDEX IF NOT EXISTS ix_marks_subject_code ON marks(subject_code);
CREATE INDEX IF NOT EXISTS ix_student_view_logs_usn_viewed_at ON student_view_logs(usn, viewed_at);
""")

# Export Subjects
cur.execute("SELECT code, name FROM subjects")
subjects = cur.fetchall()
if subjects:
    lines.append("\n-- 1. Insert Subjects")
    for s in subjects:
        lines.append(f"INSERT INTO subjects (code, name) VALUES ({sql_val(s['code'])}, {sql_val(s['name'])}) ON CONFLICT (code) DO NOTHING;")

# Export Students (all columns present in SQLite)
cur.execute("PRAGMA table_info(students)")
st_cols = [c["name"] for c in cur.fetchall()]
cur.execute(f"SELECT {', '.join(st_cols)} FROM students")
students = cur.fetchall()
if students:
    lines.append("\n-- 2. Insert Students")
    col_str = ", ".join(st_cols)
    for st in students:
        val_str = ", ".join(sql_val(st[col]) for col in st_cols)
        lines.append(f"INSERT INTO students ({col_str}) VALUES ({val_str}) ON CONFLICT (usn) DO NOTHING;")

# Export Marks
cur.execute("SELECT usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status FROM marks")
marks = cur.fetchall()
if marks:
    lines.append("\n-- 3. Insert Marks")
    for m in marks:
        lines.append(
            f"INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) "
            f"VALUES ({sql_val(m['usn'])}, {sql_val(m['subject_code'])}, {sql_val(m['semester'])}, {sql_val(m['internal_marks'])}, {sql_val(m['external_marks'])}, {sql_val(m['total'])}, {sql_val(m['max_marks'])}, {sql_val(m['status'])});"
        )

output_path.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {output_path} with {len(subjects)} subjects, {len(students)} students, and {len(marks)} marks.")
conn.close()

