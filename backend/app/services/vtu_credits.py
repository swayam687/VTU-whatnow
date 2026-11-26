"""
Central VTU 2025 Scheme Credit & CGPA/SGPA Calculation Engine
Implements official VTU credit-weighted formulas:
- SGPA = Σ(Credit × Grade Point) ÷ Σ(Credits)
- CGPA = Σ(Semester Credits × SGPA) ÷ Σ(Semester Credits) = Σ_all(Credit × Grade Point) ÷ Σ_all(Credits)
- Excludes Non-Credit Mandatory Courses (NCMC: 1BICO107, 1BICO207, 21CIP27, etc.) from GPA calculations.
"""

from typing import Dict, Any, List, Tuple, Optional

# Exact credit lookup table for 2025 and 2022 NEP Schemes
EXACT_SUBJECT_CREDITS: Dict[str, Tuple[int, bool, str]] = {
    # format: code -> (credits, is_ncmc, category_label)
    # --- Mathematics (4 Credits) ---
    "1BMATS101": (4, False, "Applied Mathematics-I"),
    "BMATS101": (4, False, "Applied Mathematics-I"),
    "1BMATS201": (4, False, "Applied Mathematics-II"),
    "BMATS201": (4, False, "Applied Mathematics-II"),
    "BMATE101": (4, False, "Applied Mathematics-I"),
    "BMATE201": (4, False, "Applied Mathematics-II"),
    "BMATM101": (4, False, "Applied Mathematics-I"),
    "BMATM201": (4, False, "Applied Mathematics-II"),
    "BMATC101": (4, False, "Applied Mathematics-I"),
    "BMATC201": (4, False, "Applied Mathematics-II"),
    "21MAT11": (4, False, "Applied Mathematics-I"),
    "21MAT21": (4, False, "Applied Mathematics-II"),

    # --- Physics & Chemistry (4 Credits with Integrated Lab) ---
    "1BPHYS102": (4, False, "Applied Physics"),
    "BPHYS102": (4, False, "Applied Physics"),
    "BPHYS202": (4, False, "Applied Physics"),
    "21PHY12": (4, False, "Applied Physics"),
    "21PHY22": (4, False, "Applied Physics"),
    "1BCHES202": (4, False, "Applied Chemistry"),
    "BCHES202": (4, False, "Applied Chemistry"),
    "BCHES102": (4, False, "Applied Chemistry"),
    "21CHE12": (4, False, "Applied Chemistry"),
    "21CHE22": (4, False, "Applied Chemistry"),

    # --- Engineering Sciences (3 Credits) ---
    "1BCEDS103": (3, False, "CAED / Engineering Drawing"),
    "BCEDS103": (3, False, "CAED / Engineering Drawing"),
    "BCEDK103": (3, False, "CAED / Engineering Drawing"),
    "BCEDK203": (3, False, "CAED / Engineering Drawing"),
    "21EDG13": (3, False, "CAED / Engineering Drawing"),
    "1BAIA103": (3, False, "Introduction to AI"),
    "1BAIA203": (3, False, "Introduction to AI"),
    "BAIA203": (3, False, "Introduction to AI"),
    "1BESC104E": (3, False, "Engineering Science Course"),
    "BESC104E": (3, False, "Engineering Science Course"),
    "1BESC204C": (3, False, "Engineering Science Course"),
    "BESC204C": (3, False, "Engineering Science Course"),
    "BESCK104A": (3, False, "Engineering Science Course"),
    "BESCK204A": (3, False, "Engineering Science Course"),
    "BESCK104B": (3, False, "Engineering Science Course"),
    "BESCK204B": (3, False, "Engineering Science Course"),
    "BESCK104C": (3, False, "Engineering Science Course"),
    "BESCK204C": (3, False, "Engineering Science Course"),
    "BESCK104D": (3, False, "Engineering Science Course"),
    "BESCK204D": (3, False, "Engineering Science Course"),

    # --- Programme Specific Courses (PSC) & PLCs (4 Credits integrated, or 3+1) ---
    "1BEIT105": (3, False, "Programme Specific Course"),
    "BEIT105": (3, False, "Programme Specific Course"),
    "1BPOPL107": (1, False, "PSC Laboratory"),
    "BPOPL107": (1, False, "PSC Laboratory"),
    "1BPLC205B": (4, False, "Programming Language Course"),
    "BPLC205B": (4, False, "Programming Language Course"),
    "1BPLC205A": (4, False, "Programming Language Course"),
    "BPLC205A": (4, False, "Programming Language Course"),
    "1BPLC205C": (4, False, "Programming Language Course"),
    "BPLC205C": (4, False, "Programming Language Course"),
    "1BPLC205D": (4, False, "Programming Language Course"),
    "BPLC205D": (4, False, "Programming Language Course"),
    "BPLCK105A": (4, False, "Programming Language Course"),
    "BPLCK105B": (4, False, "Programming Language Course"),
    "BPLCK105C": (4, False, "Programming Language Course"),
    "BPLCK105D": (4, False, "Programming Language Course"),
    "BPLCK205A": (4, False, "Programming Language Course"),
    "BPLCK205B": (4, False, "Programming Language Course"),
    "BPLCK205C": (4, False, "Programming Language Course"),
    "BPLCK205D": (4, False, "Programming Language Course"),

    # --- 1-Credit Labs, Life Skills, English & Kannada ---
    "1BENG106": (1, False, "Communication Skills"),
    "1BENG206": (1, False, "Communication Skills"),
    "BENG206": (1, False, "Communication Skills"),
    "21ENG15": (1, False, "Communicative English"),
    "21ENG25": (1, False, "Professional Writing Skills"),
    "1BIDTL158": (1, False, "Innovation & Design Thinking"),
    "BIDTK158": (1, False, "Innovation & Design Thinking"),
    "BIDTK258": (1, False, "Innovation & Design Thinking"),
    "21IDT18": (1, False, "Innovation & Design Thinking"),
    "21IDT28": (1, False, "Innovation & Design Thinking"),
    "1BSKS106": (1, False, "Soft Skills"),
    "BSKS106": (1, False, "Soft Skills"),
    "1BKBK109": (1, False, "Balake Kannada"),
    "BKBK109": (1, False, "Balake Kannada"),
    "BKBK209": (1, False, "Balake Kannada"),
    "21KBK17": (1, False, "Balake Kannada"),
    "21KBK27": (1, False, "Balake Kannada"),
    "1BKSK109": (1, False, "Samskrutika Kannada"),
    "BKSK109": (1, False, "Samskrutika Kannada"),
    "BKSK209": (1, False, "Samskrutika Kannada"),
    "21KSK17": (1, False, "Samskrutika Kannada"),
    "21KSK27": (1, False, "Samskrutika Kannada"),
    "1BPRJ258": (1, False, "Interdisciplinary Project"),
    "BPRJ258": (1, False, "Interdisciplinary Project"),
    "BSFHK158": (1, False, "Scientific Foundations of Health"),
    "BSFHK258": (1, False, "Scientific Foundations of Health"),

    # --- Non-Credit Mandatory Courses (NCMC) - 0 Credits, Pass/Fail Only ---
    "1BICO107": (0, True, "NCMC (Non-credit)"),
    "1BICO207": (0, True, "NCMC (Non-credit)"),
    "BICO207": (0, True, "NCMC (Non-credit)"),
    "21CIP27": (0, True, "NCMC (Non-credit)"),
    "21CIP37": (0, True, "NCMC (Non-credit)"),
}


def get_course_credit_info(code: str) -> Tuple[int, bool, str]:
    """
    Returns (credits, is_ncmc, category_label) for any course code.
    Fallback pattern matching is applied for unseen course codes.
    """
    if not code:
        return 3, False, "General Academic Course"

    clean = code.strip().upper()

    # Exact match in lookup
    if clean in EXACT_SUBJECT_CREDITS:
        return EXACT_SUBJECT_CREDITS[clean]

    # Without leading digit (e.g. 1BMATS101 -> BMATS101)
    if len(clean) > 1 and clean[0].isdigit():
        sub = clean[1:]
        if sub in EXACT_SUBJECT_CREDITS:
            return EXACT_SUBJECT_CREDITS[sub]

    # Heuristic fallback based on VTU curriculum pattern
    # 1. Non-credit mandatory courses
    if any(k in clean for k in ["ICO", "CIP", "NCMC"]):
        return 0, True, "NCMC (Non-credit)"

    # 2. 4-credit heavy lecture + lab courses
    if any(k in clean for k in ["MAT", "PHY", "CHE", "PLC"]):
        return 4, False, "Core Theory & Integrated Lab"

    # 3. 3-credit engineering sciences / theory
    if any(k in clean for k in ["CED", "AIA", "ESC", "EIT"]):
        return 3, False, "Engineering Sciences"

    # 4. 1-credit labs, projects, humanities
    if any(k in clean for k in ["POPL", "ENG", "IDTL", "SKS", "KSK", "KBK", "PRJ", "SFH", "LAB"]):
        return 1, False, "Practical & Life Skills"

    return 3, False, "Academic Course"


def get_vtu_grade(total_marks: int, status: str, is_ncmc: bool = False) -> Tuple[str, int]:
    """
    Maps total marks and pass/fail status to VTU letter grade and grade point (0-10).
    For NCMC courses, grade is PP (Pass) or NP (Not Passed) with 0 grade points.
    """
    is_passed = (str(status).strip().upper() == "P" and total_marks >= 40)

    if is_ncmc:
        return ("PP" if is_passed else "NP"), 0

    if not is_passed or str(status).strip().upper() in ["F", "A", "W"]:
        return "F", 0

    if total_marks >= 90:
        return "O", 10
    elif total_marks >= 80:
        return "A+", 9
    elif total_marks >= 70:
        return "A", 8
    elif total_marks >= 60:
        return "B+", 7
    elif total_marks >= 55:
        return "B", 6
    elif total_marks >= 50:
        return "C", 5
    else:
        return "P", 4


def calculate_student_credits_and_gpa(marks: List[Any]) -> Dict[str, Any]:
    """
    Calculates SGPA per semester and overall CGPA using official VTU credit weights.
    Strictly excludes NCMC courses from grade point summation and credit denominators.
    """
    if not marks:
        return {
            "sgpa": 0.0,
            "cgpa": 0.0,
            "credits_earned": 0,
            "total_credits": 0,
            "semesters": {},
        }

    sem_groups: Dict[str, List[Any]] = {}
    for m in marks:
        sem = str(getattr(m, "semester", "1") or "1").strip()
        sem_groups.setdefault(sem, []).append(m)

    sem_results: Dict[str, Dict[str, Any]] = {}
    total_weighted_points = 0.0
    total_academic_credits = 0
    total_earned_credits = 0

    for sem, s_marks in sem_groups.items():
        sem_weighted_points = 0.0
        sem_academic_credits = 0
        sem_earned_credits = 0

        for m in s_marks:
            code = getattr(m, "subject_code", "") or ""
            tot = int(getattr(m, "total", 0) or 0)
            status = getattr(m, "status", "P") or "P"

            credits, is_ncmc, _ = get_course_credit_info(code)
            grade_letter, grade_point = get_vtu_grade(tot, status, is_ncmc=is_ncmc)

            if not is_ncmc and credits > 0:
                sem_academic_credits += credits
                sem_weighted_points += (credits * grade_point)
                if status == "P" and tot >= 40:
                    sem_earned_credits += credits

        sem_sgpa = round(sem_weighted_points / sem_academic_credits, 2) if sem_academic_credits > 0 else 0.0
        sem_results[sem] = {
            "sgpa": sem_sgpa,
            "credits_earned": sem_earned_credits,
            "total_credits": sem_academic_credits,
        }

    # Cumulative Degree CGPA & Credits:
    # Deduplicate distinct academic courses across semesters so re-attempts update the course grade
    # rather than inflating the denominator with duplicate credits.
    effective_courses: Dict[str, Tuple[int, int, str, int]] = {}
    for m in marks:
        code = (getattr(m, "subject_code", "") or "").strip().upper()
        if not code:
            continue
        tot = int(getattr(m, "total", 0) or 0)
        status = (getattr(m, "status", "P") or "P").strip().upper()
        credits, is_ncmc, _ = get_course_credit_info(code)
        if is_ncmc or credits <= 0:
            continue
        _, grade_point = get_vtu_grade(tot, status, is_ncmc=is_ncmc)
        if code not in effective_courses:
            effective_courses[code] = (credits, grade_point, status, tot)
        else:
            prev_credits, prev_gp, prev_st, prev_tot = effective_courses[code]
            if status in ("P", "PASS") and prev_st not in ("P", "PASS"):
                effective_courses[code] = (credits, grade_point, status, tot)
            elif status in ("P", "PASS") and prev_st in ("P", "PASS") and tot > prev_tot:
                effective_courses[code] = (credits, grade_point, status, tot)
            elif status not in ("P", "PASS") and prev_st not in ("P", "PASS") and tot > prev_tot:
                effective_courses[code] = (credits, grade_point, status, tot)

    cum_weighted_points = sum(c * gp for c, gp, _, _ in effective_courses.values())
    cum_academic_credits = sum(c for c, _, _, _ in effective_courses.values())
    cum_earned_credits = sum(c for c, _, st, tot in effective_courses.values() if st in ("P", "PASS") and tot >= 40)

    cgpa = round(cum_weighted_points / cum_academic_credits, 2) if cum_academic_credits > 0 else 0.0

    # Get SGPA of most recent semester, or default to cgpa
    latest_sem = max(sem_groups.keys(), key=lambda s: int(s) if s.isdigit() else 1, default="1")
    latest_sgpa = sem_results.get(latest_sem, {}).get("sgpa", cgpa)

    return {
        "sgpa": latest_sgpa,
        "cgpa": cgpa,
        "credits_earned": cum_earned_credits if effective_courses else 0,
        "total_credits": cum_academic_credits if effective_courses else 0,
        "semesters": sem_results,
    }
