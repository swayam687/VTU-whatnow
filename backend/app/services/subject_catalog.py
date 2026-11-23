"""
Central VTU Subject Catalog & Name Resolver
Maps course codes across NEP 2022/2025 and CBCS schemes to authentic human-readable names.
"""

from typing import Optional

VTU_SUBJECT_NAMES = {
    # --- 1st & 2nd Semester (NEP 2022 / 2025 Scheme) ---
    # Mathematics
    "1BMATS101": "Calculus and Linear Algebra: CSE Stream",
    "BMATS101": "Calculus and Linear Algebra: CSE Stream",
    "21MAT11": "Calculus and Linear Algebra",
    "1BMATS201": "Numerical Methods: CSE Stream",
    "BMATS201": "Numerical Methods: CSE Stream",
    "21MAT21": "Advanced Calculus and Numerical Methods",
    "BMATE101": "Mathematics-I for Electrical & Electronics Stream",
    "BMATE201": "Mathematics-II for Electrical & Electronics Stream",
    "BMATM101": "Mathematics-I for Mechanical Stream",
    "BMATM201": "Mathematics-II for Mechanical Stream",
    "BMATC101": "Mathematics-I for Civil Stream",
    "BMATC201": "Mathematics-II for Civil Stream",

    # Physics & Chemistry
    "1BPHYS102": "Quantum Physics and Applications (CSE Stream)",
    "BPHYS102": "Quantum Physics and Applications (CSE Stream)",
    "BPHYS202": "Quantum Physics and Applications",
    "21PHY12": "Engineering Physics",
    "21PHY22": "Engineering Physics",
    "1BCHES202": "Applied Chemistry for Smart Systems (CSE)",
    "BCHES202": "Applied Chemistry for Smart Systems (CSE)",
    "BCHES102": "Applied Chemistry for Smart Systems",
    "21CHE12": "Engineering Chemistry",
    "21CHE22": "Engineering Chemistry",

    # Core Engineering Sciences & Computing
    "1BCEDS103": "Computer-Aided Engineering Drawing for CSE Stream",
    "BCEDS103": "Computer-Aided Engineering Drawing",
    "BCEDK103": "Computer-Aided Engineering Drawing",
    "BCEDK203": "Computer-Aided Engineering Drawing",
    "21EDG13": "Computer-Aided Engineering Drawing",
    "1BAIA203": "Introduction to AI and Applications",
    "BAIA203": "Introduction to AI and Applications",
    "1BEIT105": "Programming in C",
    "BEIT105": "Programming in C",
    "1BPOPL107": "C Programming Lab",
    "BPOPL107": "C Programming Lab",
    "1BESC104E": "Essentials of Information Technology",
    "BESC104E": "Essentials of Information Technology",
    "1BESC204C": "Introduction to Electronics & Communication Engineering",
    "BESC204C": "Introduction to Electronics & Communication Engineering",
    "BESCK104C": "Introduction to Electronics Engineering",
    "BESCK204C": "Introduction to Electronics Engineering",
    "BESCK104A": "Introduction to Civil Engineering",
    "BESCK204A": "Introduction to Civil Engineering",
    "BESCK104B": "Introduction to Electrical Engineering",
    "BESCK204B": "Introduction to Electrical Engineering",
    "BESCK104D": "Introduction to Mechanical Engineering",
    "BESCK204D": "Introduction to Mechanical Engineering",

    # Programming Language Courses (PLCs)
    "1BPLC205B": "Python Programming (for CSE and Allied Streams)",
    "BPLC205B": "Python Programming",
    "BPLCK105B": "Python Programming",
    "BPLCK205B": "Python Programming",
    "1BPLC205A": "C++ Programming",
    "BPLC205A": "C++ Programming",
    "BPLCK105A": "C++ Programming",
    "BPLCK205A": "C++ Programming",
    "1BPLC205C": "Java Programming",
    "BPLC205C": "Java Programming",
    "BPLCK105C": "Java Programming",
    "BPLCK205C": "Java Programming",
    "1BPLC205D": "Web Programming",
    "BPLC205D": "Web Programming",
    "BPLCK105D": "Web Programming",
    "BPLCK205D": "Web Programming",

    # Humanities, Social Sciences & Life Skills
    "1BENG206": "Communication Skills",
    "BENG206": "Communication Skills",
    "21ENG15": "Communicative English",
    "21ENG25": "Professional Writing Skills in English",
    "21EGH18": "Professional Writing Skills in English",
    "BPWOK106": "Professional Writing Skills in English",
    "BPWOK206": "Professional Writing Skills in English",
    "1BSKS106": "Soft Skills",
    "BSKS106": "Soft Skills",
    "1BICO207": "Indian Constitution & Engineering Ethics",
    "BICO207": "Indian Constitution & Engineering Ethics",
    "21CIP27": "Constitution of India and Professional Ethics",
    "21CIP37": "Constitution of India and Professional Ethics",
    "1BKBK109": "Balake Kannada",
    "BKBK109": "Balake Kannada",
    "BKBK209": "Balake Kannada",
    "21KBK17": "Balake Kannada",
    "21KBK27": "Balake Kannada",
    "1BKSK109": "Samskrutika Kannada",
    "BKSK109": "Samskrutika Kannada",
    "BKSK209": "Samskrutika Kannada",
    "21KSK17": "Samskrutika Kannada",
    "21KSK27": "Samskrutika Kannada",

    # Projects & Innovation Labs
    "1BIDTL158": "Innovation and Design Thinking Lab",
    "BIDTK158": "Innovation and Design Thinking",
    "BIDTK258": "Innovation and Design Thinking",
    "21IDT18": "Innovation and Design Thinking",
    "21IDT28": "Innovation and Design Thinking",
    "1BPRJ258": "Interdisciplinary Project Based Learning",
    "BPRJ258": "Interdisciplinary Project Based Learning",
    "BSFHK158": "Scientific Foundations of Health",
    "BSFHK258": "Scientific Foundations of Health",

    # --- 3rd & 4th Semester ---
    "21CS31": "Transform Calculus, Fourier Series & Numerical Techniques",
    "BCS301": "Mathematics for Computer Science",
    "21CS32": "Data Structures and Applications",
    "BCS302": "Digital Design and Computer Organization",
    "21CS33": "Analog and Digital Electronics",
    "BCS303": "Operating Systems",
    "21CS34": "Computer Organization and Architecture",
    "BCS304": "Data Structures and Applications",
    "21CSL35": "Object Oriented Programming with Java Laboratory",
    "BCSL305": "Data Structures Laboratory",
    "21CS41": "Mathematical Foundations for Computing",
    "BCS401": "Analysis & Design of Algorithms",
    "21CS42": "Design and Analysis of Algorithms",
    "BCS402": "Microcontrollers and Embedded Systems",
    "21CS43": "Microcontroller and Embedded Systems",
    "BCS403": "Database Management Systems",
    "21CS44": "Operating Systems",
    "BCS404": "Theory of Computation",
    "21CSL46": "Algorithms Laboratory",
    "BCSL405": "Database Management Systems Laboratory",

    # --- 5th & 6th Semester ---
    "21CS51": "Automata Theory and Compiler Design",
    "BCS501": "Software Engineering & Project Management",
    "21CS52": "Computer Networks",
    "BCS502": "Computer Networks",
    "21CS53": "Database Management Systems",
    "BCS503": "Theory of Computation",
    "21CS54": "Artificial Intelligence and Machine Learning",
    "BCS504": "Web Technology",
}


def get_catalog_subject_name(code: str, fallback_name: Optional[str] = None) -> str:
    """
    Returns authentic human-readable subject name for a given course code.
    If code is unknown, returns fallback_name or the code itself.
    """
    if not code:
        return fallback_name or ""

    clean = code.strip().upper()

    # If fallback name is provided and distinct from the code itself, prefer it
    if fallback_name and fallback_name.strip() and fallback_name.strip().upper() != clean:
        return fallback_name.strip()

    # Exact catalog match
    if clean in VTU_SUBJECT_NAMES:
        return VTU_SUBJECT_NAMES[clean]

    # Strip single leading digit (e.g. '1BMATS201' -> 'BMATS201')
    if len(clean) > 1 and clean[0].isdigit():
        sub_code = clean[1:]
        if sub_code in VTU_SUBJECT_NAMES:
            return VTU_SUBJECT_NAMES[sub_code]

    # Strip 2-digit scheme (e.g. '21CS31' -> 'CS31')
    if len(clean) > 2 and clean[:2].isdigit():
        sub_code = clean[2:]
        if sub_code in VTU_SUBJECT_NAMES:
            return VTU_SUBJECT_NAMES[sub_code]

    return fallback_name.strip() if fallback_name and fallback_name.strip() else clean
