"""
VTU WhatNow Database Disaster Recovery & Restore Utility
Restores database tables from a versioned JSON backup snapshot.
Usage:
    python restore_db.py --file backups/vtuwhatnow_backup_XXXX.json --dry-run
    python restore_db.py --file backups/vtuwhatnow_backup_XXXX.json --confirm
"""

import os
import sys
import json
import argparse
from pathlib import Path

# Add parent directory to path to import app modules
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from app.database import engine
from sqlalchemy import text


def restore_backup(backup_file_path: Path, dry_run: bool = True):
    if not backup_file_path.exists():
        print(f"❌ Error: Backup file not found at {backup_file_path}")
        sys.exit(1)

    print(f"🔄 Reading backup file: {backup_file_path}")
    with open(backup_file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    meta = data.get("metadata", {})
    tables = data.get("tables", {})

    print(f"📋 Backup Metadata:")
    print(f"  • Created At : {meta.get('created_at', 'unknown')}")
    print(f"  • Engine     : {meta.get('engine', 'unknown')}")
    print(f"  • Mode       : {'DRY RUN (no changes)' if dry_run else 'LIVE RESTORE'}\n")

    for table_name, rows in tables.items():
        print(f"  Found {len(rows)} records for '{table_name}'")

    if dry_run:
        print("\n✅ Dry run completed successfully. To execute restore, re-run with --confirm.")
        return

    print("\n⚠️ Starting Live Restore...")
    with engine.begin() as conn:
        for table_name, rows in tables.items():
            if not rows:
                continue

            print(f"  Restoring '{table_name}' ({len(rows)} rows)...")
            sample_keys = list(rows[0].keys())
            columns_str = ", ".join(sample_keys)
            placeholders = ", ".join([f":{k}" for k in sample_keys])

            insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"

            # For SQLite or PostgreSQL upsert/ignore
            if engine.url.drivername.startswith("sqlite"):
                insert_sql = f"INSERT OR REPLACE INTO {table_name} ({columns_str}) VALUES ({placeholders})"

            inserted_count = 0
            for row in rows:
                try:
                    conn.execute(text(insert_sql), row)
                    inserted_count += 1
                except Exception as e:
                    # In case of duplicates or missing constraint
                    continue
            print(f"  ✓ '{table_name}': {inserted_count}/{len(rows)} records restored.")

    print("\n🎉 Restore completed successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VTU WhatNow Database Restore Tool")
    parser.add_argument("--file", type=str, required=True, help="Path to backup JSON file")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Perform dry run without database writes")
    parser.add_argument("--confirm", action="store_true", help="Execute live restore into the database")
    args = parser.parse_args()

    file_path = Path(args.file)
    is_dry = not args.confirm

    restore_backup(file_path, dry_run=is_dry)

