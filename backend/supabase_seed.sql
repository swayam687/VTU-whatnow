-- =============================================
-- VTU WhatNow: Supabase Schema & Seed Script
-- Paste this directly into Supabase SQL Editor
-- =============================================


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
    password_hash VARCHAR DEFAULT '',
    is_claimed BOOLEAN DEFAULT FALSE,
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP WITHOUT TIME ZONE,
    avatar_pixel_art VARCHAR DEFAULT ''
);

-- Safe migrations for pre-existing tables
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash VARCHAR DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_pixel_art VARCHAR DEFAULT '';

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


-- 1. Insert Subjects
INSERT INTO subjects (code, name) VALUES ('1BMATS201', 'NUMERICAL METHODS: CSE STREAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BCHES202', 'APPLIED CHEMISTRY FOR SMART SYSTEMS (CSE)') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BAIA203', 'INTRODUCTION TO AI AND APPLICATIONS') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BENG206', 'COMMUNICATION SKILLS') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BICO207', 'INDIAN CONSTITUTION & ENGINEERING ETHICS') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BPRJ258', 'INTERDISCIPLINARY PROJECT BASED LEARNING') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BPLC205B', 'PYTHON PROGRAMMING (FOR CSE AND ALLIED PROGRAMMES)') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BESC204C', 'INTRODUCTION TO ELECTRONICS & COMMUNICATION ENGINEERING') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BMATS101', 'CALCULUS AND LINEAR ALGEBRA: CSE STREAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BPHYS102', 'QUANTUM PHYSICS AND APPLICATIONS (CSE STREAM)') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BCEDS103', 'COMPUTER-AIDED ENGINEERING DRAWING FOR CSE STREAM') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BEIT105', 'PROGRAMMING IN C') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BSKS106', 'SOFT SKILLS') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BPOPL107', 'C PROGRAMMING LAB') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BIDTL158', 'INNOVATION AND DESIGN THINKING LAB') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BKBK109', 'BALAKE KANNADA') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BESC104E', 'ESSENTIALS OF INFORMATION TECHNOLOGY') ON CONFLICT (code) DO NOTHING;
INSERT INTO subjects (code, name) VALUES ('1BKSK109', 'SAMSKRUTIKA KANNADA') ON CONFLICT (code) DO NOTHING;

-- 2. Insert Students
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD051', 'SWATHI', 'DS', 2025, 562, 900, 62.44, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD053', 'SYED HASAN', 'DS', 2025, 386, 900, 42.89, 0.0, 5, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS051', 'TARUN KUMAR REDDY MOPURI', 'CSE', 2025, 650, 900, 72.22, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD002', 'AKASH NAGARAJ HADAPAD', 'DS', 2025, 599, 900, 66.56, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD003', 'AMULYA KR', 'DS', 2025, 537, 900, 59.67, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD004', 'ANUSHA R', 'DS', 2025, 651, 900, 72.33, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD005', 'BABUL KUMAR', 'DS', 2025, 679, 900, 75.44, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD006', 'CHAKALA THARUN', 'DS', 2025, 591, 900, 65.67, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD007', 'CHENNARAPU RAMCHARAN', 'DS', 2025, 660, 900, 73.33, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD008', 'CHILAKALAPUDI VIRAAT ACHARI', 'DS', 2025, 692, 900, 76.89, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD009', 'DEEPA SRI R', 'DS', 2025, 784, 900, 87.11, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD010', 'DUDEKULA VANNURVALI', 'DS', 2025, 706, 900, 78.44, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD011', 'G KEERTHANA', 'DS', 2025, 654, 900, 72.67, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD012', 'HEMANTH M', 'DS', 2025, 612, 900, 68.0, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD013', 'JAYASHREE E', 'DS', 2025, 591, 900, 65.67, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD014', 'JOSHWA RENOLD F', 'DS', 2025, 613, 900, 68.11, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD015', 'K CHAITANYA', 'DS', 2025, 593, 900, 65.89, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD016', 'K PRANAVI', 'DS', 2025, 658, 900, 73.11, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD017', 'KARAN M RAJUR', 'DS', 2025, 728, 900, 80.89, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD018', 'KEERTHANA S PRAGNA', 'DS', 2025, 574, 900, 63.78, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD019', 'KONALA APPA REDDY', 'DS', 2025, 706, 900, 78.44, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD020', 'M SUPRIYA', 'DS', 2025, 648, 900, 72.0, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD021', 'MAHESH S', 'DS', 2025, 724, 900, 80.44, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD022', 'MANDA LOKESH SRI SURYA', 'DS', 2025, 714, 900, 79.33, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD023', 'MOHAMMED AINAN', 'DS', 2025, 414, 900, 46.0, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD024', 'MOHAN KRISHNA', 'DS', 2025, 628, 900, 69.78, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD025', 'MOPURI THANEESHA', 'DS', 2025, 703, 900, 78.11, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD026', 'MUMMIDAVARAPU JYOSHNA RATNA SRI', 'DS', 2025, 646, 900, 71.78, 0.0, 1, 'https://github.com/testdev', 'https://linkedin.com/in/testdev') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CD052', 'SWAYAM', 'DS', 2025, 738, 900, 82.0, 0.0, 0, 'https://github.com/SWAYAM687', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS001', 'ABHIJITH BIJU', 'CSE', 2025, 527, 900, 58.56, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS002', 'ABHISHEK', 'CSE', 2025, 595, 900, 66.11, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS003', 'AKASH P SHETTY', 'CSE', 2025, 476, 900, 52.89, 0.0, 5, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS004', 'ALLU KEERTHANA SAI', 'CSE', 2025, 652, 900, 72.44, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS005', 'AMAN ZAID KHAN', 'CSE', 2025, 517, 900, 57.44, 0.0, 6, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS006', 'ANGAD KUMAR', 'CSE', 2025, 446, 900, 49.56, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS007', 'ARCHANA', 'CSE', 2025, 524, 900, 58.22, 0.0, 5, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS008', 'BHARATH N', 'CSE', 2025, 553, 900, 61.44, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS009', 'CHETHAN G', 'CSE', 2025, 699, 900, 77.67, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS010', 'DARSHAN L', 'CSE', 2025, 571, 900, 63.44, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS011', 'DHANUSHREE D G', 'CSE', 2025, 549, 900, 61.0, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS012', 'DIVYABHARATHI H M', 'CSE', 2025, 660, 900, 73.33, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS013', 'ENNAM DILLI KUMAR', 'CSE', 2025, 768, 900, 85.33, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS014', 'GAGANBHUSHAN DINESH SHINGANNANAVAR', 'CSE', 2025, 533, 900, 59.22, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS015', 'HAIMA S', 'CSE', 2025, 509, 900, 56.56, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS016', 'HANAMANTH PUJAR', 'CSE', 2025, 559, 900, 62.11, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS017', 'HARIHARA SUDHAN G', 'CSE', 2025, 499, 900, 55.44, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS018', 'HUZAIFA FARHAN', 'CSE', 2025, 579, 900, 64.33, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS019', 'KARNATI TEJASWINI', 'CSE', 2025, 713, 900, 79.22, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS020', 'KARTHIK B', 'CSE', 2025, 669, 900, 74.33, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS021', 'KARTHIK SHRIKANT BINGI', 'CSE', 2025, 467, 900, 51.89, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS022', 'KEERTHANA K', 'CSE', 2025, 507, 900, 56.33, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS023', 'KRUSHATH M', 'CSE', 2025, 561, 900, 62.33, 0.0, 3, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS024', 'LAKSHANA S', 'CSE', 2025, 750, 900, 83.33, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS025', 'LAKSHMI BAI V', 'CSE', 2025, 571, 900, 63.44, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS026', 'M A BHAGYALAKSHMI', 'CSE', 2025, 533, 900, 59.22, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS027', 'MADHUPRIYA M', 'CSE', 2025, 618, 900, 68.67, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS028', 'MAHAMMAD TOUSIF', 'CSE', 2025, 623, 900, 69.22, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS029', 'MAZEN ZULQHARNAIN', 'CSE', 2025, 361, 900, 40.11, 0.0, 7, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS030', 'MEGHARAJ N', 'CSE', 2025, 455, 900, 50.56, 0.0, 5, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS031', 'MERCY SPOORTHI C', 'CSE', 2025, 761, 900, 84.56, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS032', 'MOHAMMED ABDULLAH', 'CSE', 2025, 503, 900, 55.89, 0.0, 2, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS033', 'MOUNIKA M', 'CSE', 2025, 611, 900, 67.89, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS034', 'MURALI', 'CSE', 2025, 701, 900, 77.89, 0.0, 1, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS035', 'N GUNASRI', 'CSE', 2025, 688, 900, 76.44, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS036', 'NAVNEETH B S', 'CSE', 2025, 544, 900, 60.44, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS037', 'NIKHEETA SAVALABHAVIMATH', 'CSE', 2025, 646, 900, 71.78, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS038', 'P SAHANA SREE', 'CSE', 2025, 761, 900, 84.56, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS039', 'PALINI SHYAMA KALYANI', 'CSE', 2025, 669, 900, 74.33, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS040', 'PAPPALA ROHITH', 'CSE', 2025, 738, 900, 82.0, 0.0, 0, '', '') ON CONFLICT (usn) DO NOTHING;
INSERT INTO students (usn, name, branch, batch, total_marks, max_marks, percentage, cgpa, total_backlogs, github_url, linkedin_url) VALUES ('1RM25CS041', 'PRATEEK DEEP DAS', 'CSE', 2025, 563, 900, 62.56, 0.0, 4, '', '') ON CONFLICT (usn) DO NOTHING;

-- 3. Insert Marks
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BMATS101', '1', 35, 10, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BPHYS102', '1', 27, 15, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BEIT105', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BSKS106', '1', 78, 0, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BPOPL107', '1', 35, 36, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BIDTL158', '1', 40, 35, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BKBK109', '1', 45, 49, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD051', '1BESC104E', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BMATS101', '1', 20, 1, 21, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BPHYS102', '1', 22, 7, 29, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BEIT105', '1', 20, 2, 22, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BSKS106', '1', 55, 0, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BPOPL107', '1', 20, 0, 20, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BIDTL158', '1', 37, 46, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BKBK109', '1', 22, 48, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD053', '1BESC104E', '1', 20, 12, 32, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BMATS101', '1', 48, 39, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BPHYS102', '1', 36, 29, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BCEDS103', '1', 38, 24, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BEIT105', '1', 42, 24, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BPOPL107', '1', 40, 40, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BIDTL158', '1', 45, 45, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BKBK109', '1', 35, 40, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS051', '1BESC104E', '1', 47, 18, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BMATS101', '1', 45, 18, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BPHYS102', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BCEDS103', '1', 36, 22, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BEIT105', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BSKS106', '1', 83, 0, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BPOPL107', '1', 41, 43, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BIDTL158', '1', 47, 39, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BKSK109', '1', 40, 28, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD002', '1BESC104E', '1', 40, 13, 53, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BMATS101', '1', 43, 10, 53, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BPHYS102', '1', 31, 9, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BEIT105', '1', 30, 5, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BSKS106', '1', 83, 0, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BPOPL107', '1', 35, 39, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BIDTL158', '1', 45, 40, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BKSK109', '1', 43, 22, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD003', '1BESC104E', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BMATS101', '1', 48, 26, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BPHYS102', '1', 34, 22, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BEIT105', '1', 40, 30, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BSKS106', '1', 75, 0, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BPOPL107', '1', 34, 45, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BIDTL158', '1', 47, 37, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BKSK109', '1', 46, 38, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD004', '1BESC104E', '1', 49, 25, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BMATS101', '1', 48, 18, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BPHYS102', '1', 30, 20, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BCEDS103', '1', 35, 8, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BEIT105', '1', 48, 36, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BSKS106', '1', 94, 0, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BPOPL107', '1', 42, 48, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BIDTL158', '1', 48, 49, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BKBK109', '1', 48, 33, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD005', '1BESC104E', '1', 40, 34, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BMATS101', '1', 48, 9, 57, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BPHYS102', '1', 31, 18, 49, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BCEDS103', '1', 37, 19, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BEIT105', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BSKS106', '1', 79, 0, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BPOPL107', '1', 38, 46, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BIDTL158', '1', 38, 40, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BKBK109', '1', 48, 37, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD006', '1BESC104E', '1', 35, 20, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BMATS101', '1', 49, 23, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BPHYS102', '1', 30, 20, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BCEDS103', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BEIT105', '1', 40, 21, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BSKS106', '1', 79, 0, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BPOPL107', '1', 39, 42, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BIDTL158', '1', 49, 40, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BKBK109', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD007', '1BESC104E', '1', 49, 32, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BMATS101', '1', 49, 33, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BPHYS102', '1', 31, 37, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BCEDS103', '1', 32, 18, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BEIT105', '1', 40, 25, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BSKS106', '1', 81, 0, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BPOPL107', '1', 40, 48, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BIDTL158', '1', 48, 40, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BKBK109', '1', 49, 47, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD008', '1BESC104E', '1', 49, 25, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BMATS101', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BPHYS102', '1', 47, 45, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BCEDS103', '1', 33, 23, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BEIT105', '1', 49, 33, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BSKS106', '1', 94, 0, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BPOPL107', '1', 49, 49, 98, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BIDTL158', '1', 49, 38, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BKBK109', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD009', '1BESC104E', '1', 49, 38, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BMATS101', '1', 49, 43, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BPHYS102', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BCEDS103', '1', 33, 20, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BEIT105', '1', 45, 38, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BSKS106', '1', 75, 0, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BPOPL107', '1', 43, 42, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BIDTL158', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BKBK109', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD010', '1BESC104E', '1', 49, 31, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BMATS101', '1', 49, 18, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BPHYS102', '1', 32, 20, 52, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BCEDS103', '1', 35, 20, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BEIT105', '1', 32, 30, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BPOPL107', '1', 38, 43, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BIDTL158', '1', 47, 43, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BKBK109', '1', 49, 47, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD011', '1BESC104E', '1', 38, 28, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BMATS101', '1', 47, 18, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BPHYS102', '1', 27, 16, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BCEDS103', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BEIT105', '1', 39, 15, 54, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BSKS106', '1', 80, 0, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BPOPL107', '1', 35, 37, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BIDTL158', '1', 45, 45, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BKBK109', '1', 49, 49, 98, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD012', '1BESC104E', '1', 28, 29, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BMATS101', '1', 45, 12, 57, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BPHYS102', '1', 23, 19, 42, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BCEDS103', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BEIT105', '1', 30, 23, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BSKS106', '1', 78, 0, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BPOPL107', '1', 37, 46, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BIDTL158', '1', 46, 40, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BKSK109', '1', 47, 34, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD013', '1BESC104E', '1', 37, 21, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BMATS101', '1', 47, 10, 57, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BPHYS102', '1', 23, 11, 34, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BCEDS103', '1', 37, 23, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BEIT105', '1', 32, 25, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BSKS106', '1', 82, 0, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BPOPL107', '1', 38, 41, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BIDTL158', '1', 48, 38, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BKBK109', '1', 49, 49, 98, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD014', '1BESC104E', '1', 40, 20, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BMATS101', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BPHYS102', '1', 22, 9, 31, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BCEDS103', '1', 32, 18, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BEIT105', '1', 30, 20, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BSKS106', '1', 80, 0, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BPOPL107', '1', 40, 43, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BIDTL158', '1', 49, 40, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BKBK109', '1', 48, 45, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD015', '1BESC104E', '1', 28, 36, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BMATS101', '1', 48, 19, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BPHYS102', '1', 25, 36, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BCEDS103', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BEIT105', '1', 32, 18, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BPOPL107', '1', 38, 42, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BIDTL158', '1', 48, 38, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BKBK109', '1', 49, 46, 95, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD016', '1BESC104E', '1', 42, 39, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BMATS101', '1', 49, 27, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BPHYS102', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BCEDS103', '1', 35, 20, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BEIT105', '1', 48, 25, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BSKS106', '1', 93, 0, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BPOPL107', '1', 48, 48, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BIDTL158', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BKBK109', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD017', '1BESC104E', '1', 49, 34, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BMATS101', '1', 37, 10, 47, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BPHYS102', '1', 24, 14, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BCEDS103', '1', 36, 19, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BEIT105', '1', 30, 8, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BSKS106', '1', 84, 0, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BPOPL107', '1', 35, 44, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BIDTL158', '1', 40, 38, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BKSK109', '1', 45, 39, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD018', '1BESC104E', '1', 49, 22, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BMATS101', '1', 49, 30, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BPHYS102', '1', 38, 32, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BEIT105', '1', 46, 26, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BSKS106', '1', 82, 0, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BPOPL107', '1', 40, 45, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BIDTL158', '1', 48, 40, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BKBK109', '1', 47, 44, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD019', '1BESC104E', '1', 46, 39, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BMATS101', '1', 48, 23, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BPHYS102', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BCEDS103', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BEIT105', '1', 40, 21, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BSKS106', '1', 90, 0, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BPOPL107', '1', 38, 41, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BIDTL158', '1', 46, 38, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BKSK109', '1', 45, 35, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD020', '1BESC104E', '1', 48, 25, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BMATS101', '1', 49, 36, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BPHYS102', '1', 43, 25, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BCEDS103', '1', 36, 19, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BEIT105', '1', 47, 31, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BSKS106', '1', 92, 0, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BPOPL107', '1', 43, 49, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BIDTL158', '1', 48, 45, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BKSK109', '1', 45, 39, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD021', '1BESC104E', '1', 49, 28, 77, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BMATS101', '1', 49, 30, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BPHYS102', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BCEDS103', '1', 39, 18, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BEIT105', '1', 47, 40, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BPOPL107', '1', 44, 49, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BIDTL158', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BKBK109', '1', 42, 39, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD022', '1BESC104E', '1', 49, 36, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BMATS101', '1', 21, 19, 40, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BPHYS102', '1', 22, 21, 43, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BEIT105', '1', 20, 9, 29, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BSKS106', '1', 55, 0, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BPOPL107', '1', 20, 38, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BIDTL158', '1', 30, 0, 30, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BKBK109', '1', 21, 48, 69, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD023', '1BESC104E', '1', 20, 15, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BMATS101', '1', 38, 22, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BPHYS102', '1', 32, 20, 52, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BCEDS103', '1', 35, 19, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BEIT105', '1', 32, 24, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BSKS106', '1', 80, 0, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BPOPL107', '1', 38, 48, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BIDTL158', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BKBK109', '1', 47, 40, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD024', '1BESC104E', '1', 38, 24, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BMATS101', '1', 49, 28, 77, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BPHYS102', '1', 41, 19, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BEIT105', '1', 42, 20, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BSKS106', '1', 90, 0, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BPOPL107', '1', 48, 44, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BIDTL158', '1', 49, 40, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BKBK109', '1', 49, 47, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD025', '1BESC104E', '1', 49, 34, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BMATS101', '1', 46, 32, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BPHYS102', '1', 29, 14, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BEIT105', '1', 30, 23, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BSKS106', '1', 78, 0, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BPOPL107', '1', 38, 45, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BIDTL158', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BKBK109', '1', 46, 43, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD026', '1BESC104E', '1', 46, 27, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BMATS101', '1', 49, 35, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BPHYS102', '1', 32, 35, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BCEDS103', '1', 36, 23, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BEIT105', '1', 42, 23, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BSKS106', '1', 93, 0, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BPOPL107', '1', 48, 49, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BIDTL158', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BKBK109', '1', 49, 44, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CD052', '1BESC104E', '1', 49, 34, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BMATS101', '1', 46, 9, 55, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BPHYS102', '1', 28, 18, 46, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BCEDS103', '1', 35, 26, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BEIT105', '1', 40, 9, 49, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BSKS106', '1', 75, 0, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BPOPL107', '1', 35, 26, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BIDTL158', '1', 40, 40, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BKSK109', '1', 45, 13, 58, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS001', '1BESC104E', '1', 24, 18, 42, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BMATS101', '1', 48, 15, 63, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BPHYS102', '1', 42, 24, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BCEDS103', '1', 36, 9, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BEIT105', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BSKS106', '1', 64, 0, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BPOPL107', '1', 38, 42, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BIDTL158', '1', 38, 43, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BKBK109', '1', 45, 47, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS002', '1BESC104E', '1', 28, 18, 46, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BMATS101', '1', 44, 7, 51, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BPHYS102', '1', 35, 5, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BCEDS103', '1', 35, 11, 46, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BEIT105', '1', 37, 3, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BSKS106', '1', 70, 0, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BPOPL107', '1', 36, 40, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BIDTL158', '1', 35, 0, 35, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BKSK109', '1', 46, 18, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS003', '1BESC104E', '1', 35, 19, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BMATS101', '1', 49, 22, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BPHYS102', '1', 48, 12, 60, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BCEDS103', '1', 36, 23, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BEIT105', '1', 43, 29, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BSKS106', '1', 80, 0, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BPOPL107', '1', 42, 40, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BIDTL158', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BKSK109', '1', 49, 9, 58, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS004', '1BESC104E', '1', 49, 30, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BMATS101', '1', 43, 2, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BPHYS102', '1', 40, 1, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BCEDS103', '1', 36, 8, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BEIT105', '1', 36, 13, 49, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BSKS106', '1', 82, 0, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BPOPL107', '1', 35, 0, 35, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BIDTL158', '1', 39, 45, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BKBK109', '1', 40, 46, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS005', '1BESC104E', '1', 40, 11, 51, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BMATS101', '1', 25, 1, 26, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BPHYS102', '1', 23, 1, 24, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BEIT105', '1', 30, 3, 33, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BPOPL107', '1', 28, 26, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BIDTL158', '1', 40, 38, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BKBK109', '1', 30, 41, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS006', '1BESC104E', '1', 28, 18, 46, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BMATS101', '1', 37, 1, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BPHYS102', '1', 48, 15, 63, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BCEDS103', '1', 36, 8, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BEIT105', '1', 33, 9, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BSKS106', '1', 68, 0, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BPOPL107', '1', 30, 27, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BIDTL158', '1', 38, 45, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BKBK109', '1', 47, 16, 63, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS007', '1BESC104E', '1', 45, 21, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BMATS101', '1', 43, 18, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BPHYS102', '1', 40, 22, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BCEDS103', '1', 37, 19, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BEIT105', '1', 32, 12, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BPOPL107', '1', 30, 40, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BIDTL158', '1', 34, 43, 77, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BKSK109', '1', 48, 34, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS008', '1BESC104E', '1', 23, 18, 41, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BMATS101', '1', 49, 22, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BPHYS102', '1', 49, 18, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BCEDS103', '1', 39, 19, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BEIT105', '1', 43, 33, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BSKS106', '1', 86, 0, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BPOPL107', '1', 45, 45, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BIDTL158', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BKSK109', '1', 46, 39, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS009', '1BESC104E', '1', 48, 24, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BMATS101', '1', 40, 11, 51, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BPHYS102', '1', 40, 29, 69, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BCEDS103', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BEIT105', '1', 32, 10, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BPOPL107', '1', 30, 42, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BIDTL158', '1', 33, 40, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BKSK109', '1', 47, 39, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS010', '1BESC104E', '1', 45, 20, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BMATS101', '1', 33, 8, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BPHYS102', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BEIT105', '1', 33, 12, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BPOPL107', '1', 40, 40, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BIDTL158', '1', 47, 40, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BKSK109', '1', 42, 44, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS011', '1BESC104E', '1', 40, 7, 47, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BMATS101', '1', 49, 13, 62, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BPHYS102', '1', 46, 18, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BCEDS103', '1', 39, 18, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BEIT105', '1', 34, 21, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BSKS106', '1', 90, 0, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BPOPL107', '1', 40, 39, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BIDTL158', '1', 41, 48, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BKSK109', '1', 49, 43, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS012', '1BESC104E', '1', 46, 26, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BMATS101', '1', 49, 42, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BPHYS102', '1', 47, 39, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BCEDS103', '1', 38, 10, 48, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BEIT105', '1', 49, 39, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BSKS106', '1', 94, 0, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BPOPL107', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BIDTL158', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BKBK109', '1', 49, 49, 98, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS013', '1BESC104E', '1', 47, 25, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BMATS101', '1', 45, 3, 48, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BPHYS102', '1', 25, 2, 27, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BEIT105', '1', 34, 3, 37, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BPOPL107', '1', 30, 38, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BIDTL158', '1', 48, 48, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BKSK109', '1', 46, 31, 77, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS014', '1BESC104E', '1', 30, 11, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BMATS101', '1', 40, 25, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BPHYS102', '1', 22, 6, 28, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BCEDS103', '1', 36, 6, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BEIT105', '1', 33, 9, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BPOPL107', '1', 32, 37, 69, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BIDTL158', '1', 40, 48, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BKSK109', '1', 46, 42, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS015', '1BESC104E', '1', 23, 4, 27, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BMATS101', '1', 45, 6, 51, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BPHYS102', '1', 27, 13, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BCEDS103', '1', 37, 11, 48, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BEIT105', '1', 33, 26, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BSKS106', '1', 78, 0, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BPOPL107', '1', 38, 35, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BIDTL158', '1', 36, 45, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BKSK109', '1', 46, 30, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS016', '1BESC104E', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BMATS101', '1', 44, 8, 52, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BPHYS102', '1', 27, 11, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BCEDS103', '1', 32, 5, 37, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BEIT105', '1', 30, 5, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BSKS106', '1', 64, 0, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BPOPL107', '1', 30, 34, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BIDTL158', '1', 37, 45, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BKBK109', '1', 48, 38, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS017', '1BESC104E', '1', 22, 19, 41, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BMATS101', '1', 35, 3, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BPHYS102', '1', 36, 11, 47, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BCEDS103', '1', 36, 19, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BEIT105', '1', 31, 18, 49, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BSKS106', '1', 90, 0, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BPOPL107', '1', 25, 38, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BIDTL158', '1', 39, 43, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BKBK109', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS018', '1BESC104E', '1', 32, 29, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BMATS101', '1', 48, 37, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BPHYS102', '1', 41, 27, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BCEDS103', '1', 37, 6, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BEIT105', '1', 47, 23, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BSKS106', '1', 93, 0, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BPOPL107', '1', 48, 46, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BIDTL158', '1', 44, 43, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BKBK109', '1', 49, 42, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS019', '1BESC104E', '1', 49, 33, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BMATS101', '1', 44, 23, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BPHYS102', '1', 35, 18, 53, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BCEDS103', '1', 37, 4, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BEIT105', '1', 47, 24, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BPOPL107', '1', 47, 46, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BIDTL158', '1', 49, 40, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BKBK109', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS020', '1BESC104E', '1', 49, 24, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BMATS101', '1', 28, 2, 30, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BPHYS102', '1', 25, 10, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BCEDS103', '1', 37, 22, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BEIT105', '1', 38, 3, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BSKS106', '1', 65, 0, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BPOPL107', '1', 32, 37, 69, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BIDTL158', '1', 30, 40, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BKSK109', '1', 45, 20, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS021', '1BESC104E', '1', 24, 9, 33, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BMATS101', '1', 25, 0, 25, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BPHYS102', '1', 28, 16, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BCEDS103', '1', 38, 5, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BEIT105', '1', 35, 5, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BSKS106', '1', 74, 0, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BPOPL107', '1', 32, 27, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BIDTL158', '1', 48, 48, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BKSK109', '1', 49, 31, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS022', '1BESC104E', '1', 28, 18, 46, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BMATS101', '1', 30, 12, 42, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BPHYS102', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BCEDS103', '1', 38, 7, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BEIT105', '1', 34, 6, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BPOPL107', '1', 35, 40, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BIDTL158', '1', 48, 43, 91, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BKBK109', '1', 49, 43, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS023', '1BESC104E', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BMATS101', '1', 49, 43, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BPHYS102', '1', 45, 35, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BCEDS103', '1', 36, 27, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BEIT105', '1', 40, 28, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BSKS106', '1', 90, 0, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BPOPL107', '1', 48, 49, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BIDTL158', '1', 45, 50, 95, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BKBK109', '1', 45, 44, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS024', '1BESC104E', '1', 48, 28, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BMATS101', '1', 49, 13, 62, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BPHYS102', '1', 29, 8, 37, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BCEDS103', '1', 37, 7, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BEIT105', '1', 31, 19, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BSKS106', '1', 64, 0, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BPOPL107', '1', 35, 39, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BIDTL158', '1', 48, 48, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BKSK109', '1', 48, 39, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS025', '1BESC104E', '1', 46, 11, 57, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BMATS101', '1', 45, 1, 46, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BPHYS102', '1', 28, 7, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BCEDS103', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BEIT105', '1', 34, 7, 41, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BSKS106', '1', 85, 0, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BPOPL107', '1', 35, 36, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BIDTL158', '1', 47, 48, 95, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BKSK109', '1', 38, 28, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS026', '1BESC104E', '1', 24, 14, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BMATS101', '1', 47, 19, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BPHYS102', '1', 36, 22, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BCEDS103', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BEIT105', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BSKS106', '1', 65, 0, 65, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BPOPL107', '1', 38, 40, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BIDTL158', '1', 48, 48, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BKSK109', '1', 46, 36, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS027', '1BESC104E', '1', 41, 18, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BMATS101', '1', 40, 21, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BPHYS102', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BCEDS103', '1', 38, 20, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BEIT105', '1', 37, 25, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BSKS106', '1', 74, 0, 74, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BPOPL107', '1', 40, 46, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BIDTL158', '1', 41, 43, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BKSK109', '1', 37, 35, 72, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS028', '1BESC104E', '1', 39, 29, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BMATS101', '1', 24, 4, 28, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BPHYS102', '1', 25, 6, 31, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BCEDS103', '1', 35, 0, 35, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BEIT105', '1', 25, 4, 29, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BSKS106', '1', 46, 0, 46, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BPOPL107', '1', 30, 0, 30, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BIDTL158', '1', 30, 0, 30, 100, 'A');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BKBK109', '1', 48, 47, 95, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS029', '1BESC104E', '1', 22, 15, 37, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BMATS101', '1', 30, 5, 35, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BPHYS102', '1', 40, 3, 43, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BCEDS103', '1', 38, 2, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BEIT105', '1', 25, 8, 33, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BSKS106', '1', 55, 0, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BPOPL107', '1', 30, 36, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BIDTL158', '1', 41, 45, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BKSK109', '1', 28, 31, 59, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS030', '1BESC104E', '1', 28, 10, 38, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BMATS101', '1', 49, 34, 83, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BPHYS102', '1', 49, 32, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BCEDS103', '1', 38, 23, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BEIT105', '1', 43, 33, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BSKS106', '1', 88, 0, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BPOPL107', '1', 47, 49, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BIDTL158', '1', 49, 50, 99, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BKBK109', '1', 49, 46, 95, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS031', '1BESC104E', '1', 45, 37, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BMATS101', '1', 25, 3, 28, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BPHYS102', '1', 30, 18, 48, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BEIT105', '1', 28, 5, 33, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BSKS106', '1', 60, 0, 60, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BPOPL107', '1', 26, 35, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BIDTL158', '1', 30, 40, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BKBK109', '1', 46, 48, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS032', '1BESC104E', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BMATS101', '1', 48, 18, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BPHYS102', '1', 36, 20, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BCEDS103', '1', 37, 18, 55, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BEIT105', '1', 32, 18, 50, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BSKS106', '1', 68, 0, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BPOPL107', '1', 38, 37, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BIDTL158', '1', 40, 48, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BKSK109', '1', 47, 37, 84, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS033', '1BESC104E', '1', 49, 20, 69, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BMATS101', '1', 49, 37, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BPHYS102', '1', 37, 16, 53, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BCEDS103', '1', 40, 18, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BEIT105', '1', 49, 36, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BSKS106', '1', 70, 0, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BPOPL107', '1', 49, 47, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BIDTL158', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BKSK109', '1', 47, 41, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS034', '1BESC104E', '1', 49, 19, 68, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BMATS101', '1', 48, 18, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BPHYS102', '1', 40, 24, 64, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BCEDS103', '1', 43, 18, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BEIT105', '1', 42, 31, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BSKS106', '1', 87, 0, 87, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BPOPL107', '1', 46, 48, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BIDTL158', '1', 40, 48, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BKSK109', '1', 46, 27, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS035', '1BESC104E', '1', 49, 33, 82, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BMATS101', '1', 43, 4, 47, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BPHYS102', '1', 36, 4, 40, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BCEDS103', '1', 37, 8, 45, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BEIT105', '1', 38, 6, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BSKS106', '1', 78, 0, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BPOPL107', '1', 40, 31, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BIDTL158', '1', 45, 45, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BKSK109', '1', 40, 26, 66, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS036', '1BESC104E', '1', 32, 31, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BMATS101', '1', 35, 28, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BPHYS102', '1', 36, 21, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BCEDS103', '1', 39, 18, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BEIT105', '1', 42, 19, 61, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BSKS106', '1', 94, 0, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BPOPL107', '1', 43, 36, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BIDTL158', '1', 49, 48, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BKSK109', '1', 30, 41, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS037', '1BESC104E', '1', 48, 19, 67, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BMATS101', '1', 49, 30, 79, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BPHYS102', '1', 36, 39, 75, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BCEDS103', '1', 45, 26, 71, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BEIT105', '1', 48, 32, 80, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BSKS106', '1', 93, 0, 93, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BPOPL107', '1', 49, 45, 94, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BIDTL158', '1', 41, 48, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BKSK109', '1', 47, 45, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS038', '1BESC104E', '1', 49, 39, 88, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BMATS101', '1', 49, 21, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BPHYS102', '1', 36, 21, 57, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BCEDS103', '1', 38, 18, 56, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BEIT105', '1', 39, 23, 62, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BSKS106', '1', 92, 0, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BPOPL107', '1', 38, 35, 73, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BIDTL158', '1', 43, 43, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BKBK109', '1', 49, 47, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS039', '1BESC104E', '1', 49, 28, 77, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BMATS101', '1', 49, 27, 76, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BPHYS102', '1', 40, 41, 81, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BCEDS103', '1', 39, 19, 58, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BEIT105', '1', 48, 22, 70, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BSKS106', '1', 92, 0, 92, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BPOPL107', '1', 48, 49, 97, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BIDTL158', '1', 47, 43, 90, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BKBK109', '1', 48, 41, 89, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS040', '1BESC104E', '1', 48, 37, 85, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BMATS101', '1', 35, 9, 44, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BPHYS102', '1', 45, 5, 50, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BCEDS103', '1', 36, 18, 54, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BEIT105', '1', 43, 6, 49, 100, 'F');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BSKS106', '1', 63, 0, 63, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BPOPL107', '1', 46, 40, 86, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BIDTL158', '1', 46, 50, 96, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BKBK109', '1', 48, 30, 78, 100, 'P');
INSERT INTO marks (usn, subject_code, semester, internal_marks, external_marks, total, max_marks, status) VALUES ('1RM25CS041', '1BESC104E', '1', 35, 8, 43, 100, 'F');


-- =============================================
-- Additional Schema Migrations & Security
-- =============================================

-- Add authentication and tracking columns to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash VARCHAR DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;

-- Semester Links table for multi-semester results portal links
CREATE TABLE IF NOT EXISTS semester_links (
    id SERIAL PRIMARY KEY,
    semester VARCHAR NOT NULL,
    scheme VARCHAR DEFAULT '2022',
    name VARCHAR NOT NULL,
    base_url VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- Seed default semester link if table is empty
INSERT INTO semester_links (semester, scheme, name, base_url, is_active, is_default, display_order)
SELECT '1', '2022', '1st Semester (2022 Scheme)', 'https://results.vtu.ac.in/FMEB24/index.php', TRUE, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM semester_links WHERE semester = '1');

-- Student Login Logs Table
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    login_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_login_logs_usn ON login_logs(usn);
CREATE INDEX IF NOT EXISTS ix_login_logs_login_at ON login_logs(login_at);

-- USN Disputes & Account Claims (Contains Verification Selfie Photo)
CREATE TABLE IF NOT EXISTS usn_disputes (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    selfie_base64 TEXT NOT NULL,
    new_password_hash VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending',
    admin_notes VARCHAR DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    reviewed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS ix_usn_disputes_usn ON usn_disputes(usn);
CREATE INDEX IF NOT EXISTS ix_usn_disputes_status ON usn_disputes(status);

-- Student Peer Comparison Tracker
CREATE TABLE IF NOT EXISTS comparison_logs (
    id SERIAL PRIMARY KEY,
    viewer_usn VARCHAR,
    viewer_name VARCHAR DEFAULT '',
    student1_usn VARCHAR NOT NULL,
    student1_name VARCHAR DEFAULT '',
    student1_branch VARCHAR DEFAULT '',
    student2_usn VARCHAR NOT NULL,
    student2_name VARCHAR DEFAULT '',
    student2_branch VARCHAR DEFAULT '',
    compared_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_comparison_logs_viewer_usn ON comparison_logs(viewer_usn);
CREATE INDEX IF NOT EXISTS ix_comparison_logs_compared_at ON comparison_logs(compared_at);

-- Missing USN Scrape Requests & Notices
CREATE TABLE IF NOT EXISTS missing_usn_reports (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    message VARCHAR DEFAULT '',
    status VARCHAR DEFAULT 'pending',
    reported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_missing_usn_reports_usn ON missing_usn_reports(usn);
CREATE INDEX IF NOT EXISTS ix_missing_usn_reports_status ON missing_usn_reports(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS across all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usn_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_usn_reports ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Tables: students, subjects, marks, semester_links
DROP POLICY IF EXISTS "Public can view students" ON students;
CREATE POLICY "Public can view students" ON students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view subjects" ON subjects;
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view marks" ON marks;
CREATE POLICY "Public can view marks" ON marks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view semester links" ON semester_links;
CREATE POLICY "Public can view semester links" ON semester_links FOR SELECT USING (true);

-- 2. Sensitive Tables Protected from Direct Public Access:
-- Only backend service_role can access usn_disputes (verification selfies),
-- comparison_logs, login_logs, and missing_usn_reports.
DROP POLICY IF EXISTS "Service role full access on disputes" ON usn_disputes;
CREATE POLICY "Service role full access on disputes" ON usn_disputes FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on comparisons" ON comparison_logs;
CREATE POLICY "Service role full access on comparisons" ON comparison_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on login logs" ON login_logs;
CREATE POLICY "Service role full access on login logs" ON login_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on missing reports" ON missing_usn_reports;
CREATE POLICY "Service role full access on missing reports" ON missing_usn_reports FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =============================================
-- Additional Schema Migrations & Security
-- =============================================

-- Add authentication and tracking columns to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS password_hash VARCHAR DEFAULT NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL;

-- Semester Links table for multi-semester results portal links
CREATE TABLE IF NOT EXISTS semester_links (
    id SERIAL PRIMARY KEY,
    semester VARCHAR NOT NULL,
    scheme VARCHAR DEFAULT '2022',
    name VARCHAR NOT NULL,
    base_url VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- Seed default semester link if table is empty
INSERT INTO semester_links (semester, scheme, name, base_url, is_active, is_default, display_order)
SELECT '1', '2022', '1st Semester (2022 Scheme)', 'https://results.vtu.ac.in/FMEB24/index.php', TRUE, TRUE, 1
WHERE NOT EXISTS (SELECT 1 FROM semester_links WHERE semester = '1');

-- Student Login Logs Table
CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    login_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_login_logs_usn ON login_logs(usn);
CREATE INDEX IF NOT EXISTS ix_login_logs_login_at ON login_logs(login_at);

-- USN Disputes & Account Claims (Contains Verification Selfie Photo)
CREATE TABLE IF NOT EXISTS usn_disputes (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    selfie_base64 TEXT NOT NULL,
    new_password_hash VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'pending',
    admin_notes VARCHAR DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    reviewed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS ix_usn_disputes_usn ON usn_disputes(usn);
CREATE INDEX IF NOT EXISTS ix_usn_disputes_status ON usn_disputes(status);

-- Student Peer Comparison Tracker
CREATE TABLE IF NOT EXISTS comparison_logs (
    id SERIAL PRIMARY KEY,
    viewer_usn VARCHAR,
    viewer_name VARCHAR DEFAULT '',
    student1_usn VARCHAR NOT NULL,
    student1_name VARCHAR DEFAULT '',
    student1_branch VARCHAR DEFAULT '',
    student2_usn VARCHAR NOT NULL,
    student2_name VARCHAR DEFAULT '',
    student2_branch VARCHAR DEFAULT '',
    compared_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_comparison_logs_viewer_usn ON comparison_logs(viewer_usn);
CREATE INDEX IF NOT EXISTS ix_comparison_logs_compared_at ON comparison_logs(compared_at);

-- Missing USN Scrape Requests & Notices
CREATE TABLE IF NOT EXISTS missing_usn_reports (
    id SERIAL PRIMARY KEY,
    usn VARCHAR NOT NULL,
    name VARCHAR DEFAULT '',
    branch VARCHAR DEFAULT '',
    message VARCHAR DEFAULT '',
    status VARCHAR DEFAULT 'pending',
    reported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
    ip_address VARCHAR DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_missing_usn_reports_usn ON missing_usn_reports(usn);
CREATE INDEX IF NOT EXISTS ix_missing_usn_reports_status ON missing_usn_reports(status);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS across all tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usn_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE missing_usn_reports ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Tables: students, subjects, marks, semester_links
DROP POLICY IF EXISTS "Public can view students" ON students;
CREATE POLICY "Public can view students" ON students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view subjects" ON subjects;
CREATE POLICY "Public can view subjects" ON subjects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view marks" ON marks;
CREATE POLICY "Public can view marks" ON marks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view semester links" ON semester_links;
CREATE POLICY "Public can view semester links" ON semester_links FOR SELECT USING (true);

-- 2. Sensitive Tables Protected from Direct Public Access:
-- Only backend service_role can access usn_disputes (verification selfies),
-- comparison_logs, login_logs, and missing_usn_reports.
DROP POLICY IF EXISTS "Service role full access on disputes" ON usn_disputes;
CREATE POLICY "Service role full access on disputes" ON usn_disputes FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on comparisons" ON comparison_logs;
CREATE POLICY "Service role full access on comparisons" ON comparison_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on login logs" ON login_logs;
CREATE POLICY "Service role full access on login logs" ON login_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on missing reports" ON missing_usn_reports;
CREATE POLICY "Service role full access on missing reports" ON missing_usn_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
