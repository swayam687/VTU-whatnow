import re
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional

def infer_semester_from_code(code: str) -> Optional[str]:
    """
    Infers the semester digit from standard VTU CBCS subject codes.
    Examples:
      - 1BMATS201, 1BPHYS102, 1BCEDS103, 1BESC104E -> group 1 matches '2' or '1'
      - 21MAT21, 22MATS21, 21PHY12 -> matches '2' or '1'
      - BCS301, BCS401 -> matches '3' or '4'
    """
    clean = code.strip().upper()
    # Pattern 1: e.g. 1BMATS201 -> semester 2; 1BMATS101 -> semester 1; BCS301 -> semester 3
    m = re.search(r"([1-8])\d{2}[A-Z]?$", clean)
    if m:
        return m.group(1)
    # Pattern 2: e.g. 21MAT21, 22MATS11 -> 4th/5th char semester digit
    m = re.search(r"\d{2}[A-Z]+([1-8])\d", clean)
    if m:
        return m.group(1)
    # Pattern 3: e.g. MAT21, CS31
    m = re.search(r"^[A-Z]{2,}([1-8])\d{1,2}", clean)
    if m:
        return m.group(1)
    return None

def parse_vtu_html(html: str) -> Dict[str, Any]:
    """
    Parses VTU CBCS Result HTML page and extracts:
    - student info: USN, name
    - marks list: subject_code, subject_name, semester, internal, external, total, max_marks, status
    - aggregate stats: total_marks, max_marks, percentage, backlogs
    Supports multi-semester results (Summer/Makeup examinations like SME26cbcs and Revaluation).
    """
    soup = BeautifulSoup(html, "html.parser")
    student: Dict[str, Any] = {"usn": "", "name": ""}
    marks = []

    # VTU uses CSS div tables (.divTableRow, .divTableCell) as well as traditional HTML tables
    all_rows = soup.find_all(
        lambda tag: tag.name in ["tr"] or (
            tag.has_attr("class") and any("divtablerow" in c.lower() for c in tag["class"])
        )
    )

    current_semester = None

    for row in all_rows:
        cells = [
            re.sub(r"[\s\xa0]+", " ", c.get_text()).strip() for c in row.find_all(
                lambda tag: tag.name in ["td", "th"] or (
                    tag.has_attr("class") and any("divtablecell" in c.lower() for c in tag["class"])
                )
            )
        ]
        if not cells:
            continue

        row_str = " ".join(cells)

        # 1. Track Semester section header if present in row text
        sem_match = re.search(r"Semester\s*:\s*([1-8])", row_str, re.I) or re.search(r"\bSem(?:ester)?\s+([1-8])\b", row_str, re.I)
        if sem_match:
            current_semester = sem_match.group(1)

        # Also check preceding DOM nodes if not yet set in this row
        if not sem_match:
            prev_sem_node = row.find_previous(string=re.compile(r"Semester\s*:\s*([1-8])", re.I))
            if prev_sem_node:
                pm = re.search(r"Semester\s*:\s*([1-8])", str(prev_sem_node), re.I)
                if pm:
                    current_semester = pm.group(1)

        # 2. Extract Student Info
        if "University Seat Number" in row_str or "USN" in row_str:
            for cell in cells:
                m = re.search(r"([0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3})", cell, re.I)
                if m:
                    student["usn"] = m.group(1).upper()
                    break

        if "Student Name" in row_str:
            for cell in cells:
                clean = cell.replace(":", "").strip()
                if clean and clean.upper() not in ["STUDENT NAME", "NAME", ""]:
                    student["name"] = clean
                    break

        # 3. Extract Marks row
        # Layout 1: [Code, Name, Int, Ext, Total, Result, Date...]
        # Layout 2: [Sl No, Code, Name, Int, Ext, Total, Result, Date...]
        if len(cells) >= 5:
            subj_idx = -1
            clean_c0 = re.sub(r"[\s\xa0\.\-]+", "", cells[0].upper())
            clean_c1 = re.sub(r"[\s\xa0\.\-]+", "", cells[1].upper()) if len(cells) > 1 else ""

            if re.match(r"^[0-9A-Z]{4,12}$", clean_c0) and not clean_c0.isdigit():
                subj_idx = 0
            elif clean_c1 and re.match(r"^[0-9A-Z]{4,12}$", clean_c1) and not clean_c1.isdigit():
                subj_idx = 1

            if subj_idx != -1:
                code = re.sub(r"[\s\xa0]+", "", cells[subj_idx].upper())
                if not any(h in code for h in ["CODE", "SUB", "SL", "SI", "SUBJECT"]):
                    name = cells[subj_idx + 1].strip() if len(cells) > subj_idx + 1 else code
                    
                    rem = cells[subj_idx + 2:]
                    nums = [int(x) for x in rem if x.strip().isdigit()]
                    status = "P"
                    for x in rem:
                        cu = x.strip().upper()
                        if cu in ["P", "F", "A", "W", "PASS", "FAIL", "ABSENT", "WITHHELD"]:
                            if "PASS" in cu or cu == "P":
                                status = "P"
                            elif "FAIL" in cu or cu == "F":
                                status = "F"
                            elif "ABS" in cu or cu == "A":
                                status = "A"
                            else:
                                status = "W"
                            break

                    if len(nums) >= 3:
                        internal, external, total = nums[-3], nums[-2], nums[-1]
                    elif len(nums) == 2:
                        internal, external, total = nums[0], nums[1], nums[0] + nums[1]
                    elif len(nums) == 1:
                        internal, external, total = 0, 0, nums[0]
                    else:
                        internal, external, total = 0, 0, 0

                    # Semester resolution: DOM header > subject code pattern > default '1'
                    inferred_sem = infer_semester_from_code(code)
                    mark_semester = current_semester or inferred_sem or "1"

                    marks.append({
                        "subject_code": code,
                        "subject_name": name,
                        "semester": mark_semester,
                        "internal_marks": internal,
                        "external_marks": external,
                        "total": total,
                        "max_marks": 100,
                        "status": status,
                    })

    # Fallback for USN if not in header row
    if not student["usn"]:
        m = re.search(r"\b([0-9][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3})\b", soup.get_text())
        if m:
            student["usn"] = m.group(1).upper()

    total_marks = sum(m["total"] for m in marks)
    max_marks = len(marks) * 100 if marks else 0
    percentage = round((total_marks / max_marks) * 100, 2) if max_marks > 0 else 0.0
    backlogs = sum(1 for m in marks if m["status"] in ["F", "A", "W"])

    return {
        "student": student,
        "marks": marks,
        "total_marks": total_marks,
        "max_marks": max_marks,
        "percentage": percentage,
        "total_backlogs": backlogs,
    }
