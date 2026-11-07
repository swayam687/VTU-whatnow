import re
from bs4 import BeautifulSoup
from typing import Dict, Any

def parse_vtu_html(html: str) -> Dict[str, Any]:
    """
    Parses VTU CBCS Result HTML page and extracts:
    - student info: USN, name
    - marks list: subject_code, subject_name, internal, external, total, max_marks, status
    - aggregate stats: total_marks, max_marks, percentage, backlogs
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

    for row in all_rows:
        cells = [
            c.get_text(strip=True) for c in row.find_all(
                lambda tag: tag.name in ["td", "th"] or (
                    tag.has_attr("class") and any("divtablecell" in c.lower() for c in tag["class"])
                )
            )
        ]
        if not cells:
            continue

        row_str = " ".join(cells)

        # 1. Extract Student Info
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

        # 2. Extract Marks row
        # Layout 1: [Code, Name, Int, Ext, Total, Result, Date...]
        # Layout 2: [Sl No, Code, Name, Int, Ext, Total, Result, Date...]
        if len(cells) >= 6:
            subj_idx = -1
            if re.match(r"^[0-9A-Z]{5,10}$", cells[0].upper()) and not cells[0].isdigit():
                subj_idx = 0
            elif len(cells) > 1 and re.match(r"^[0-9A-Z]{5,10}$", cells[1].upper()) and not cells[1].isdigit():
                subj_idx = 1

            if subj_idx != -1:
                code = cells[subj_idx].strip().upper()
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

                    marks.append({
                        "subject_code": code,
                        "subject_name": name,
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
