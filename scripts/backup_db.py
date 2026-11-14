#!/usr/bin/env python3
"""
Field Shift Persistent Database Backup Utility
Safely backups the active SQLite database using SQLite's online backup API,
verifies integrity of the destination backup file, and prints stats.
"""

import os
import shutil
import sqlite3
import sys
from datetime import datetime, timezone

DB_PATH = os.getenv("SENSOR_STORE_PATH", "backend/sensor_readings.db")
BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")

def backup():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}; nothing to back up.")
        return 0

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(BACKUP_DIR, f"sensor_readings_backup_{timestamp}.db")

    print(f"Initiating online backup of {DB_PATH} -> {backup_file}...")
    source_conn = sqlite3.connect(DB_PATH)
    dest_conn = sqlite3.connect(backup_file)
    try:
        source_conn.backup(dest_conn)
        dest_conn.commit()
    finally:
        source_conn.close()
        dest_conn.close()

    # Integrity verification
    verify_conn = sqlite3.connect(backup_file)
    try:
        cur = verify_conn.cursor()
        cur.execute("PRAGMA integrity_check")
        status = cur.fetchone()[0]
        if status != "ok":
            print(f"Error: Backup integrity check failed: {status}")
            return 1
        
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cur.fetchall()]
        print(f"✓ Backup successful and verified intact! Size: {os.path.getsize(backup_file)} bytes. Tables: {tables}")
    finally:
        verify_conn.close()

    return 0

if __name__ == "__main__":
    sys.exit(backup())
