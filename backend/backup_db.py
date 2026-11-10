"""
VTU WhatNow Database Backup Utility
Exports all database tables (PostgreSQL / SQLite) into a versioned, portable JSON backup.
Run:
    python backup_db.py
    python backup_db.py --stats
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import app modules
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from app.database import engine
from sqlalchemy import text


TABLES_TO_BACKUP = [
    "students",
    "subjects",
    "marks",
    "semester_links",
    "login_logs",
    "usn_disputes",
    "comparison_logs",
    "missing_usn_reports"
]


def serialize_val(v):
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def perform_backup(output_dir: Path = None):
    if output_dir is None:
        output_dir = CURRENT_DIR / "backups"
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_file = output_dir / f"vtuwhatnow_backup_{timestamp}.json"

    print(f"📦 Starting database backup...")
    print(f"Connecting to database engine: {engine.url.drivername}...")

    backup_payload = {
        "metadata": {
            "version": "1.0",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "engine": engine.url.drivername,
            "table_counts": {}
        },
        "tables": {}
    }

    with engine.connect() as conn:
        for table in TABLES_TO_BACKUP:
            try:
                result = conn.execute(text(f"SELECT * FROM {table}"))
                keys = list(result.keys())
                rows = []
                for row in result.fetchall():
                    row_dict = {k: serialize_val(v) for k, v in zip(keys, row)}
                    rows.append(row_dict)

                backup_payload["tables"][table] = rows
                backup_payload["metadata"]["table_counts"][table] = len(rows)
                print(f"  ✓ {table}: {len(rows)} records exported")
            except Exception as e:
                print(f"  ⚠️ Table '{table}' skipped or does not exist: {e}")
                backup_payload["tables"][table] = []
                backup_payload["metadata"]["table_counts"][table] = 0

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(backup_payload, f, indent=2)

    file_size_kb = os.path.getsize(backup_file) / 1024
    print(f"\n🎉 Backup completed successfully!")
    print(f"📁 Destination: {backup_file}")
    print(f"📊 Size: {file_size_kb:.1f} KB")
    return backup_file


def show_stats():
    print(f"📊 VTU WhatNow Database Health & Table Counts:")
    print(f"Engine: {engine.url.drivername}\n")
    with engine.connect() as conn:
        for table in TABLES_TO_BACKUP:
            try:
                cnt = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"  • {table.ljust(22)} : {cnt:,} rows")
            except Exception as e:
                print(f"  • {table.ljust(22)} : (table not found or empty)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VTU WhatNow Database Backup Tool")
    parser.add_argument("--stats", action="store_true", help="Print table counts without running a backup")
    parser.add_argument("--out", type=str, default=None, help="Custom output directory")
    args = parser.parse_args()

    if args.stats:
        show_stats()
    else:
        out_path = Path(args.out) if args.out else None
        perform_backup(out_path)

