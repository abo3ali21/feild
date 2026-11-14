#!/usr/bin/env python3
"""
Field Shift Database Restoration Utility
Restores SQLite database from a specified backup file after verifying integrity.
"""

import os
import sqlite3
import sys

TARGET_DB = os.getenv("SENSOR_STORE_PATH", "backend/sensor_readings.db")

def restore(backup_path: str):
    if not os.path.exists(backup_path):
        print(f"Error: Backup file {backup_path} does not exist.")
        return 1

    print(f"Verifying integrity of backup file: {backup_path}...")
    backup_conn = sqlite3.connect(backup_path)
    try:
        cur = backup_conn.cursor()
        cur.execute("PRAGMA integrity_check")
        status = cur.fetchone()[0]
        if status != "ok":
            print(f"Error: Source backup integrity check failed: {status}")
            return 1
    finally:
        backup_conn.close()

    print(f"Restoring backup to target {TARGET_DB}...")
    source_conn = sqlite3.connect(backup_path)
    dest_conn = sqlite3.connect(TARGET_DB)
    try:
        source_conn.backup(dest_conn)
        dest_conn.commit()
    finally:
        source_conn.close()
        dest_conn.close()

    # Final verification on target
    target_conn = sqlite3.connect(TARGET_DB)
    try:
        cur = target_conn.cursor()
        cur.execute("PRAGMA integrity_check")
        status = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM evaluations")
        eval_count = cur.fetchone()[0]
        print(f"✓ Restore completed successfully! Target integrity: {status}. Saved evaluations: {eval_count}")
    finally:
        target_conn.close()

    return 0

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/restore_db.py <path_to_backup.db>")
        sys.exit(1)
    sys.exit(restore(sys.argv[1]))
