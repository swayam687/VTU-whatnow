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
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
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

CREATE INDEX IF NOT EXISTS ix_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS ix_students_name ON students(name);
CREATE INDEX IF NOT EXISTS ix_students_branch ON students(branch);
CREATE INDEX IF NOT EXISTS ix_students_batch ON students(batch);
CREATE INDEX IF NOT EXISTS ix_subjects_code ON subjects(code);
CREATE INDEX IF NOT EXISTS ix_marks_usn ON marks(usn);
CREATE INDEX IF NOT EXISTS ix_marks_subject_code ON marks(subject_code);
""")

# Export Subjects
cur.execute("SELECT code, name FROM subjects")
subjects = cur.fetchall()
if subjects:
    lines.append("\n-- 1. Insert Subjects")
    for s in subjects:
        lines.append(f"INSERT INTO subjects (code, name) VALUES ({sql_val(s['code'])}, {sql_val(s['name'])}) ON CONFLICT (code) DO NOTHING;")

# Export Students
cur.execute("SELECT usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url FROM students")
students = cur.fetchall()
if students:
    lines.append("\n-- 2. Insert Students")
    for st in students:
        lines.append(
            f"INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) "
            f"VALUES ({sql_val(st['usn'])}, {sql_val(st['name'])}, {sql_val(st['branch'])}, {sql_val(st['batch'])}, {sql_val(st['total_marks'])}, {sql_val(st['max_marks'])}, {sql_val(st['percentage'])}, {sql_val(st['cgpa'])}, {sql_val(st['total_backlogs'])}, {sql_val(st['github_url'])}, {sql_val(st['linkedin_url'])}) "
            f"ON CONFLICT (usn) DO NOTHING;"
        )

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

