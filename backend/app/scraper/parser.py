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
    Supports regular semester results, multi-semester makeup exams (SME), and Revaluation results (rvcbcs).
    """
    soup = BeautifulSoup(html, "html.parser")
    student: Dict[str, Any] = {"usn": "", "name": ""}
    marks = []

    page_text_lower = soup.get_text().lower()
    page_is_reval = "revaluation" in page_text_lower or "rvcbcs" in page_text_lower or "reval" in page_text_lower

    # VTU uses CSS div tables (.divTableRow, .divTableCell) as well as traditional HTML tables
    all_rows = soup.find_all(
        lambda tag: tag.name in ["tr"] or (
            tag.has_attr("class") and any("divtablerow" in c.lower() for c in tag["class"])
        )
    )

    current_semester = None
    active_col_map = {}
    table_is_reval = False

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
        row_str_lower = row_str.lower()

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
                if "Student Name" in cell:
                    after = re.sub(r"^.*?Student\s+Name\s*[:\s]*", "", cell, flags=re.I).strip()
                    if after and after.upper() not in ["STUDENT NAME", "NAME"]:
                        student["name"] = after
                        break
                clean = cell.replace(":", "").strip()
                if clean and clean.upper() not in ["STUDENT NAME", "NAME", ""]:
                    student["name"] = clean
                    break

        # 3. Detect Table Headers (Revaluation vs Regular)
        is_reval_hdr = any(h in row_str_lower for h in ["old marks", "rv marks", "rv result", "reval marks", "final marks", "old result"])
        is_regular_hdr = any(h in row_str_lower for h in ["subject code", "sub code"]) and any(h in row_str_lower for h in ["total", "result"])

        if is_reval_hdr:
            table_is_reval = True
            active_col_map = {}
            for i, cell in enumerate(cells):
                cl = cell.lower().strip()
                if "sub" in cl and "code" in cl:
                    active_col_map["code"] = i
                elif "sub" in cl and "name" in cl:
                    active_col_map["name"] = i
                elif "internal" in cl or "cie" in cl:
                    active_col_map["internal"] = i
                elif "old" in cl and "mark" in cl:
                    active_col_map["old_marks"] = i
                elif "old" in cl and ("res" in cl or "grade" in cl):
                    active_col_map["old_result"] = i
                elif ("rv" in cl or "reval" in cl) and "mark" in cl:
                    active_col_map["rv_marks"] = i
                elif ("rv" in cl or "reval" in cl) and ("res" in cl or "grade" in cl):
                    active_col_map["rv_result"] = i
                elif "final" in cl and "mark" in cl:
                    active_col_map["final_marks"] = i
                elif "final" in cl and ("res" in cl or "grade" in cl):
                    active_col_map["final_result"] = i
                elif "external" in cl or "see" in cl:
                    active_col_map["external"] = i
                elif "total" in cl:
                    active_col_map["total"] = i
                elif "result" in cl and not any(k in cl for k in ["old", "rv", "reval", "final"]):
                    active_col_map["result"] = i
            continue

        if is_regular_hdr and not is_reval_hdr:
            table_is_reval = False
            active_col_map = {}
            for i, cell in enumerate(cells):
                cl = cell.lower().strip()
                if "sub" in cl and "code" in cl:
                    active_col_map["code"] = i
                elif "sub" in cl and "name" in cl:
                    active_col_map["name"] = i
                elif "internal" in cl or "cie" in cl:
                    active_col_map["internal"] = i
                elif "external" in cl or "see" in cl:
                    active_col_map["external"] = i
                elif "total" in cl:
                    active_col_map["total"] = i
                elif "result" in cl:
                    active_col_map["result"] = i
            continue

        # 4. Extract Marks row
        # Layout 1: [Code, Name, Int, Ext, Total, Result, Date...]
        # Layout 2: [Sl No, Code, Name, Int, Ext, Total, Result, Date...]
        # Layout 3 (Reval): [Code, Name, Int, Old Marks, Old Res, RV Marks, RV Res, Final Marks]
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
                    res_tokens = [
                        x.strip().upper() for x in rem
                        if x.strip().upper() in ["P", "F", "A", "W", "PASS", "FAIL", "ABSENT", "WITHHELD"]
                    ]

                    # Check if this row is a Revaluation result
                    row_is_reval = (
                        table_is_reval
                        or page_is_reval
                        or len(res_tokens) >= 2
                        or ("rv_result" in active_col_map)
                        or (len(nums) >= 4 and len(res_tokens) >= 1)
                    )

                    if row_is_reval:
                        def get_num_by_col(col_name: str, fallback_idx: int) -> Optional[int]:
                            if col_name in active_col_map and len(cells) > active_col_map[col_name]:
                                val = cells[active_col_map[col_name]].strip()
                                if val.isdigit():
                                    return int(val)
                            if 0 <= fallback_idx < len(nums):
                                return nums[fallback_idx]
                            return None

                        def get_str_by_col(col_name: str, fallback_idx: int) -> str:
                            if col_name in active_col_map and len(cells) > active_col_map[col_name]:
                                return cells[active_col_map[col_name]].strip().upper()
                            if 0 <= fallback_idx < len(res_tokens):
                                return res_tokens[fallback_idx]
                            return ""

                        internal = get_num_by_col("internal", 0) or 0
                        old_marks = get_num_by_col("old_marks", 1 if len(nums) >= 4 else -1)
                        rv_marks = get_num_by_col("rv_marks", 2 if len(nums) >= 4 else -1)
                        final_marks = get_num_by_col("final_marks", -1 if len(nums) >= 3 else -1)

                        old_res = get_str_by_col("old_result", 0)
                        rv_res = get_str_by_col("rv_result", 1 if len(res_tokens) >= 2 else 0)
                        final_res = get_str_by_col("final_result", -1)

                        # Determine final pass/fail status:
                        # Priority 1: RV Result or Final Result is P -> Candidate passed in revaluation!
                        # Priority 2: Old Result was P -> Candidate was already passed
                        # Priority 3: RV Result / Final Result is F -> Failed in revaluation
                        # Priority 4: Old Result is F
                        status = "P"
                        if any(r in ["P", "PASS"] for r in [rv_res, final_res]):
                            status = "P"
                        elif any(r in ["P", "PASS"] for r in [old_res]):
                            status = "P"
                        elif any(r in ["F", "FAIL"] for r in [rv_res, final_res]):
                            status = "F"
                        elif any(r in ["A", "ABSENT"] for r in [rv_res, final_res]):
                            status = "A"
                        elif any(r in ["W", "WITHHELD"] for r in [rv_res, final_res]):
                            status = "W"
                        elif old_res in ["F", "FAIL"]:
                            status = "F"
                        elif old_res in ["A", "ABSENT"]:
                            status = "A"
                        elif old_res in ["W", "WITHHELD"]:
                            status = "W"
                        else:
                            status = "P"

                        # In VTU reval tables, Final Marks represents the accepted external SEE marks
                        if final_marks is not None:
                            external = final_marks
                        elif rv_marks is not None:
                            external = rv_marks
                        elif old_marks is not None:
                            external = old_marks
                        elif nums:
                            external = nums[-1]
                        else:
                            external = 0

                        # Total marks: Internal (CIE) + External (SEE)
                        # Avoid double-counting only in the rare case where Final Marks was already CIE+SEE
                        if final_marks is not None and internal > 0 and final_marks == internal + (rv_marks or 0):
                            total = final_marks
                        else:
                            total = internal + external

                    else:
                        # Regular Exam Extraction
                        status = "P"
                        if res_tokens:
                            cu = res_tokens[0]
                            if "PASS" in cu or cu == "P":
                                status = "P"
                            elif "FAIL" in cu or cu == "F":
                                status = "F"
                            elif "ABS" in cu or cu == "A":
                                status = "A"
                            else:
                                status = "W"

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
