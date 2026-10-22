import os
import sqlite3
import math
import hmac
import hashlib
import time
import json
import base64
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
import certifi
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from werkzeug.security import generate_password_hash, check_password_hash

# Find the main project folder
PROJECT_FOLDER = Path(__file__).resolve().parent.parent

# Load MongoDB credentials
load_dotenv(PROJECT_FOLDER / "atlas-credentials.env")

MONGODB_URI = os.getenv("MONGODB_URI")
LOCAL_DB_PATH = PROJECT_FOLDER / "SmartAttendanceDB.db"

# Initialize MongoDB Client
mongo_client = None
atlas_db = None
students_collection = None
attendance_collection = None
settings_collection = None

if MONGODB_URI:
    try:
        mongo_client = MongoClient(
            MONGODB_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=2000
        )
        atlas_db = mongo_client["SmartAttendanceDB"]
        students_collection = atlas_db["students"]
        attendance_collection = atlas_db["attendance"]
        settings_collection = atlas_db["settings"]
    except Exception as e:
        print(f"Warning: MongoDB initialization error: {e}")


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculates the great-circle distance between two GPS coordinates in meters
    using the Haversine formula.
    """
    try:
        R = 6371000.0  # Earth's mean radius in meters
        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        delta_phi = math.radians(float(lat2) - float(lat1))
        delta_lambda = math.radians(float(lon2) - float(lon1))

        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2.0) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return round(R * c, 1)
    except Exception as e:
        print(f"Distance calculation error: {e}")
        return 999999.0


def _init_sqlite():
    """Initializes SQLite database tables and executes migrations."""
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    
    # Students Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            roll_number TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            email TEXT,
            image_base64 TEXT,
            status TEXT DEFAULT 'Active',
            registered_at TEXT NOT NULL
        )
    """)
    
    # Attendance Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT NOT NULL,
            name TEXT NOT NULL,
            class_name TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            status TEXT NOT NULL,
            confidence REAL,
            verification_method TEXT DEFAULT 'AI Face Match',
            latitude REAL,
            longitude REAL,
            distance_from_campus REAL,
            timestamp TEXT NOT NULL,
            UNIQUE(roll_number, date)
        )
    """)

    # Migration for older attendance schemas
    cursor.execute("PRAGMA table_info(attendance)")
    cols = [col[1] for col in cursor.fetchall()]
    if "latitude" not in cols:
        cursor.execute("ALTER TABLE attendance ADD COLUMN latitude REAL")
    if "longitude" not in cols:
        cursor.execute("ALTER TABLE attendance ADD COLUMN longitude REAL")
    if "distance_from_campus" not in cols:
        cursor.execute("ALTER TABLE attendance ADD COLUMN distance_from_campus REAL")
    
    # Campus Location Geofence Table (Default radius 100 meters)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS campus_location (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            name TEXT DEFAULT 'College Campus / Classroom',
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_meters REAL DEFAULT 100.0,
            enabled INTEGER DEFAULT 1,
            updated_at TEXT NOT NULL
        )
    """)

    # Initialize default campus coordinates (default: 100m radius)
    cursor.execute("""
        INSERT OR IGNORE INTO campus_location (id, name, latitude, longitude, radius_meters, enabled, updated_at)
        VALUES (1, 'College Campus / Classroom', 18.5204, 73.8567, 100.0, 1, datetime('now'))
    """)

    # Admin Users Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    """)

    # Seed default admin user (admin / admin123) if none exists
    cursor.execute("SELECT COUNT(*) FROM admin_users")
    if cursor.fetchone()[0] == 0:
        default_hash = generate_password_hash("admin123")
        cursor.execute("""
            INSERT INTO admin_users (username, password_hash, role, created_at)
            VALUES ('admin', ?, 'admin', datetime('now'))
        """, (default_hash,))

    # App Settings Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            campus_name TEXT DEFAULT 'College Campus / Classroom',
            latitude REAL DEFAULT 18.5204,
            longitude REAL DEFAULT 73.8567,
            radius_meters REAL DEFAULT 100.0,
            geofence_enabled INTEGER DEFAULT 1,
            match_threshold REAL DEFAULT 0.40,
            late_cutoff_time TEXT DEFAULT '09:30',
            prevent_duplicate INTEGER DEFAULT 1,
            allow_manual_entry INTEGER DEFAULT 1,
            updated_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO app_settings (
            id, campus_name, latitude, longitude, radius_meters, geofence_enabled,
            match_threshold, late_cutoff_time, prevent_duplicate, allow_manual_entry, updated_at
        ) VALUES (
            1, 'College Campus / Classroom', 18.5204, 73.8567, 100.0, 1,
            0.40, '09:30', 1, 1, datetime('now')
        )
    """)

    conn.commit()
    conn.close()


_init_sqlite()


_last_mongo_check = 0
_mongo_online = False
CHECK_INTERVAL = 30  # seconds cache


def is_mongo_available(force_refresh=False):
    """Checks if MongoDB Atlas is currently reachable without stalling requests."""
    global _last_mongo_check, _mongo_online
    import time
    now = time.time()

    if not force_refresh and (now - _last_mongo_check < CHECK_INTERVAL):
        return _mongo_online

    _last_mongo_check = now
    if mongo_client is None:
        _mongo_online = False
        return False

    try:
        mongo_client.admin.command("ping")
        _mongo_online = True
    except Exception:
        _mongo_online = False

    return _mongo_online


def get_campus_location():
    """Fetches campus geofence settings."""
    if is_mongo_available() and settings_collection is not None:
        try:
            doc = settings_collection.find_one({"key": "campus_location"}, {"_id": 0})
            if doc:
                return doc.get("value")
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT name, latitude, longitude, radius_meters, enabled, updated_at FROM campus_location WHERE id = 1")
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "name": row[0],
            "latitude": float(row[1]),
            "longitude": float(row[2]),
            "radius_meters": float(row[3]),
            "enabled": bool(row[4]),
            "updated_at": row[5]
        }

    return {
        "name": "College Campus / Classroom",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "radius_meters": 100.0,
        "enabled": True,
        "updated_at": datetime.now().isoformat()
    }


def update_campus_location(latitude, longitude, radius_meters=100.0, name="College Campus / Classroom", enabled=True):
    """Updates campus geofence coordinates and allowed radius."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    loc_data = {
        "name": name,
        "latitude": float(latitude),
        "longitude": float(longitude),
        "radius_meters": float(radius_meters),
        "enabled": bool(enabled),
        "updated_at": now_str
    }

    if is_mongo_available() and settings_collection is not None:
        try:
            settings_collection.update_one(
                {"key": "campus_location"},
                {"$set": {"key": "campus_location", "value": loc_data}},
                upsert=True
            )
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO campus_location (id, name, latitude, longitude, radius_meters, enabled, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            radius_meters = excluded.radius_meters,
            enabled = excluded.enabled,
            updated_at = excluded.updated_at
    """, (name, float(latitude), float(longitude), float(radius_meters), 1 if enabled else 0, now_str))
    conn.commit()
    conn.close()

    return loc_data


SECRET_KEY = os.getenv("APP_SECRET_KEY", "smart_attendance_ai_secret_key_2026_x89a")


def generate_auth_token(username, role="admin", expires_in_seconds=86400):
    """Generates a secure HMAC-SHA256 signed bearer token."""
    payload = {
        "sub": username,
        "role": role,
        "exp": int(time.time()) + expires_in_seconds
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_auth_token(token):
    """Verifies HMAC signature and expiration timestamp of the bearer token."""
    if not token or "." not in token:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        padding = len(payload_b64) % 4
        if padding:
            payload_b64 += "=" * (4 - padding)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def verify_admin_credentials(username, password):
    """Validates admin login credentials against database password hash."""
    if not username or not password:
        return None, "Username and password are required."

    username = username.strip()

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, password_hash, role FROM admin_users WHERE username = ?", (username,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return None, "Invalid username or password."

    admin_id, db_username, db_hash, role = row
    if not check_password_hash(db_hash, password):
        conn.close()
        return None, "Invalid username or password."

    # Update last login
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("UPDATE admin_users SET last_login = ? WHERE id = ?", (now_str, admin_id))
    conn.commit()
    conn.close()

    user_info = {
        "id": admin_id,
        "username": db_username,
        "role": role,
        "last_login": now_str
    }
    return user_info, None


def change_admin_password(username, old_password, new_password):
    """Changes admin password after verifying old password."""
    if not new_password or len(new_password) < 4:
        return False, "New password must be at least 4 characters long."

    user_info, err = verify_admin_credentials(username, old_password)
    if not user_info:
        return False, err or "Current password verification failed."

    new_hash = generate_password_hash(new_password)
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("UPDATE admin_users SET password_hash = ? WHERE username = ?", (new_hash, username))
    conn.commit()
    conn.close()

    return True, "Password updated successfully."


def get_app_settings():
    """Fetches complete application configuration settings."""
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT campus_name, latitude, longitude, radius_meters, geofence_enabled,
               match_threshold, late_cutoff_time, prevent_duplicate, allow_manual_entry, updated_at
        FROM app_settings WHERE id = 1
    """)
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "campus_name": row[0],
            "latitude": float(row[1]),
            "longitude": float(row[2]),
            "radius_meters": float(row[3]),
            "geofence_enabled": bool(row[4]),
            "match_threshold": float(row[5]),
            "late_cutoff_time": row[6] or "09:30",
            "prevent_duplicate": bool(row[7]),
            "allow_manual_entry": bool(row[8]),
            "updated_at": row[9]
        }

    return {
        "campus_name": "College Campus / Classroom",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "radius_meters": 100.0,
        "geofence_enabled": True,
        "match_threshold": 0.40,
        "late_cutoff_time": "09:30",
        "prevent_duplicate": True,
        "allow_manual_entry": True,
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


def update_app_settings(data):
    """Updates application configuration settings and syncs campus_location."""
    current = get_app_settings()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    campus_name = data.get("campus_name", current["campus_name"])
    latitude = float(data.get("latitude", current["latitude"]))
    longitude = float(data.get("longitude", current["longitude"]))
    radius_meters = float(data.get("radius_meters", current["radius_meters"]))
    geofence_enabled = bool(data.get("geofence_enabled", current["geofence_enabled"]))
    match_threshold = float(data.get("match_threshold", current["match_threshold"]))
    late_cutoff_time = str(data.get("late_cutoff_time", current["late_cutoff_time"])).strip()
    prevent_duplicate = bool(data.get("prevent_duplicate", current["prevent_duplicate"]))
    allow_manual_entry = bool(data.get("allow_manual_entry", current["allow_manual_entry"]))

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO app_settings (
            id, campus_name, latitude, longitude, radius_meters, geofence_enabled,
            match_threshold, late_cutoff_time, prevent_duplicate, allow_manual_entry, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            campus_name = excluded.campus_name,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            radius_meters = excluded.radius_meters,
            geofence_enabled = excluded.geofence_enabled,
            match_threshold = excluded.match_threshold,
            late_cutoff_time = excluded.late_cutoff_time,
            prevent_duplicate = excluded.prevent_duplicate,
            allow_manual_entry = excluded.allow_manual_entry,
            updated_at = excluded.updated_at
    """, (
        campus_name, latitude, longitude, radius_meters,
        1 if geofence_enabled else 0, match_threshold, late_cutoff_time,
        1 if prevent_duplicate else 0, 1 if allow_manual_entry else 0, now_str
    ))
    conn.commit()
    conn.close()

    # Also keep campus_location table and MongoDB synchronized
    update_campus_location(
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius_meters,
        name=campus_name,
        enabled=geofence_enabled
    )

    return get_app_settings()


def clear_all_attendance_records():
    """Resets/clears attendance logs in database."""
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendance")
    deleted_count = cursor.rowcount
    conn.commit()
    conn.close()

    if is_mongo_available() and attendance_collection is not None:
        try:
            attendance_collection.delete_many({})
        except PyMongoError:
            pass

    return deleted_count


def get_system_backup():
    """Exports full database dump (students, attendance, settings)."""
    return {
        "exported_at": datetime.now().isoformat(),
        "settings": get_app_settings(),
        "students": get_all_students(),
        "attendance": get_all_attendance()
    }


def get_db_diagnostics():
    """Returns database health, status, and IP whitelist troubleshooting info."""
    mongo_ok = is_mongo_available(force_refresh=True)
    students_count = len(get_all_students())
    attendance_count = len(get_all_attendance())
    campus = get_campus_location()

    status = {
        "mongo_atlas": {
            "connected": mongo_ok,
            "uri_configured": bool(MONGODB_URI),
            "status_text": "Connected & Synchronized" if mongo_ok else "Offline (IP Whitelist Required in Atlas)"
        },
        "local_database": {
            "engine": "SQLite High-Performance Database",
            "file": str(LOCAL_DB_PATH.name),
            "status": "Operational & Healthy"
        },
        "geofence": campus,
        "counts": {
            "total_students": students_count,
            "total_attendance_records": attendance_count
        },
        "ip_whitelist_instruction": (
            "To connect to MongoDB Atlas: 1. Go to cloud.mongodb.com 2. Network Access 3. Add IP Address '0.0.0.0/0' (Allow anywhere for development)."
            if not mongo_ok else "Atlas connection is active!"
        )
    }
    return status


def save_student(roll_number, name, class_name, image_base64=None, email=""):
    """
    Saves or updates a student in the database.
    Stores full metadata including reference Base64 image.
    """
    roll_number = roll_number.strip().upper()
    name = name.strip()
    class_name = class_name.strip()
    email = (email or "").strip().lower()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if is_mongo_available() and students_collection is not None:
        try:
            update_data = {
                "name": name,
                "class_name": class_name,
                "email": email,
                "registered_at": now_str,
                "status": "Active"
            }
            if image_base64:
                update_data["image_base64"] = image_base64

            students_collection.update_one(
                {"roll_number": roll_number},
                {"$set": update_data},
                upsert=True
            )
        except PyMongoError as err:
            print(f"MongoDB write failed: {err}")

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO students (roll_number, name, class_name, email, image_base64, status, registered_at)
        VALUES (?, ?, ?, ?, ?, 'Active', ?)
        ON CONFLICT(roll_number) DO UPDATE SET
            name = excluded.name,
            class_name = excluded.class_name,
            email = excluded.email,
            image_base64 = coalesce(excluded.image_base64, students.image_base64),
            registered_at = excluded.registered_at
    """, (roll_number, name, class_name, email, image_base64, now_str))
    conn.commit()
    conn.close()

    return True


def get_student(roll_number):
    """Fetches a student by roll number."""
    roll_number = roll_number.strip().upper()

    if is_mongo_available() and students_collection is not None:
        try:
            doc = students_collection.find_one({"roll_number": roll_number}, {"_id": 0})
            if doc:
                return doc
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT roll_number, name, class_name, email, image_base64, status, registered_at
        FROM students WHERE roll_number = ?
    """, (roll_number,))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "roll_number": row[0],
            "name": row[1],
            "class_name": row[2],
            "email": row[3] or "",
            "image_base64": row[4],
            "status": row[5] or "Active",
            "registered_at": row[6]
        }
    return None


def get_all_students(search=None, class_filter=None):
    """Fetches all registered students with optional search and class filtering."""
    if is_mongo_available() and students_collection is not None:
        try:
            query = {}
            if class_filter:
                query["class_name"] = class_filter
            if search:
                query["$or"] = [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"roll_number": {"$regex": search, "$options": "i"}}
                ]
            students = list(students_collection.find(query, {"_id": 0}))
            if students:
                return students
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    
    query = "SELECT roll_number, name, class_name, email, image_base64, status, registered_at FROM students WHERE 1=1"
    params = []

    if class_filter:
        query += " AND class_name = ?"
        params.append(class_filter)
    if search:
        query += " AND (name LIKE ? OR roll_number LIKE ?)"
        params.append(f"%{search}%")
        params.append(f"%{search}%")

    query += " ORDER BY roll_number ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "roll_number": r[0],
            "name": r[1],
            "class_name": r[2],
            "email": r[3] or "",
            "image_base64": r[4],
            "status": r[5] or "Active",
            "registered_at": r[6]
        }
        for r in rows
    ]


def delete_student(roll_number):
    """Deletes a student and cleans up related attendance."""
    roll_number = roll_number.strip().upper()

    if is_mongo_available() and students_collection is not None:
        try:
            students_collection.delete_one({"roll_number": roll_number})
            attendance_collection.delete_many({"roll_number": roll_number})
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("DELETE FROM students WHERE roll_number = ?", (roll_number,))
    cursor.execute("DELETE FROM attendance WHERE roll_number = ?", (roll_number,))
    conn.commit()
    conn.close()

    return True


def mark_student_attendance(roll_number, name, class_name, confidence=None, verification_method="AI Face Match", latitude=None, longitude=None, distance_from_campus=None):
    """
    Marks attendance for a student for the current day with GPS location tracking.
    Prevents duplicate entries on the same date.
    """
    roll_number = roll_number.strip().upper()
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    time_str = now.strftime("%I:%M:%S %p")
    now_iso = now.isoformat()

    settings = get_app_settings()

    # Prevent duplicate attendance if configured
    if settings.get("prevent_duplicate", True):
        existing = get_attendance_for_student_today(roll_number, today_str)
        if existing:
            return False, f"Attendance already marked for today at {existing.get('time')}", existing

    # Determine status based on late cutoff time setting
    status = "Present"
    late_cutoff = settings.get("late_cutoff_time", "09:30")
    try:
        current_hm = now.strftime("%H:%M")
        if current_hm > late_cutoff:
            status = "Late"
    except Exception:
        status = "Present"

    record = {
        "roll_number": roll_number,
        "name": name,
        "class_name": class_name,
        "date": today_str,
        "time": time_str,
        "status": status,
        "confidence": round(float(confidence), 4) if confidence is not None else None,
        "verification_method": verification_method,
        "latitude": float(latitude) if latitude is not None else None,
        "longitude": float(longitude) if longitude is not None else None,
        "distance_from_campus": round(float(distance_from_campus), 1) if distance_from_campus is not None else None,
        "timestamp": now_iso
    }

    if is_mongo_available() and attendance_collection is not None:
        try:
            attendance_collection.insert_one(dict(record))
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO attendance (roll_number, name, class_name, date, time, status, confidence, verification_method, latitude, longitude, distance_from_campus, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(roll_number, date) DO NOTHING
    """, (
        roll_number, name, class_name, today_str, time_str, status, 
        confidence, verification_method, 
        latitude, longitude, distance_from_campus, now_iso
    ))
    conn.commit()
    conn.close()

    return True, f"Attendance marked successfully for {name} ({roll_number})!", record


def record_manual_attendance(roll_number, status="Present", date_str=None, time_str=None):
    """Allows manual attendance entry or override by admin."""
    settings = get_app_settings()
    if not settings.get("allow_manual_entry", True):
        return False, "Manual attendance recording is disabled in Application Settings.", None

    student = get_student(roll_number)
    if not student:
        return False, "Student not found in database.", None

    now = datetime.now()
    date_val = date_str or now.strftime("%Y-%m-%d")
    time_val = time_str or now.strftime("%I:%M:%S %p")
    now_iso = now.isoformat()

    record = {
        "roll_number": student["roll_number"],
        "name": student["name"],
        "class_name": student["class_name"],
        "date": date_val,
        "time": time_val,
        "status": status,
        "confidence": None,
        "verification_method": "Manual Admin Entry",
        "timestamp": now_iso
    }

    if is_mongo_available() and attendance_collection is not None:
        try:
            attendance_collection.update_one(
                {"roll_number": student["roll_number"], "date": date_val},
                {"$set": dict(record)},
                upsert=True
            )
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO attendance (roll_number, name, class_name, date, time, status, confidence, verification_method, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(roll_number, date) DO UPDATE SET
            status = excluded.status,
            time = excluded.time,
            verification_method = excluded.verification_method,
            timestamp = excluded.timestamp
    """, (student["roll_number"], student["name"], student["class_name"], date_val, time_val, status, None, "Manual Admin Entry", now_iso))
    conn.commit()
    conn.close()

    return True, f"Manual attendance recorded as {status} for {student['name']}.", record


def get_attendance_for_student_today(roll_number, today_str=None):
    """Finds today's attendance record for a student."""
    if today_str is None:
        today_str = datetime.now().strftime("%Y-%m-%d")

    if is_mongo_available() and attendance_collection is not None:
        try:
            doc = attendance_collection.find_one(
                {"roll_number": roll_number, "date": today_str},
                {"_id": 0}
            )
            if doc:
                return doc
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, roll_number, name, class_name, date, time, status, confidence, verification_method, latitude, longitude, distance_from_campus, timestamp
        FROM attendance WHERE roll_number = ? AND date = ? LIMIT 1
    """, (roll_number, today_str))
    row = cursor.fetchone()
    conn.close()

    if row:
        return {
            "id": row[0],
            "roll_number": row[1],
            "name": row[2],
            "class_name": row[3],
            "date": row[4],
            "time": row[5],
            "status": row[6],
            "confidence": row[7],
            "verification_method": row[8],
            "latitude": row[9],
            "longitude": row[10],
            "distance_from_campus": row[11],
            "timestamp": row[12]
        }
    return None


def get_all_attendance(date_filter=None, roll_filter=None, class_filter=None):
    """Queries attendance records with flexible filtering and geolocation coordinates."""
    if is_mongo_available() and attendance_collection is not None:
        try:
            query = {}
            if date_filter:
                query["date"] = date_filter
            if roll_filter:
                query["roll_number"] = roll_filter.strip().upper()
            if class_filter:
                query["class_name"] = class_filter
            records = list(attendance_collection.find(query, {"_id": 0}).sort("timestamp", -1))
            if records:
                return records
        except PyMongoError:
            pass

    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    
    query = """
        SELECT id, roll_number, name, class_name, date, time, status, confidence, 
               verification_method, latitude, longitude, distance_from_campus, timestamp 
        FROM attendance WHERE 1=1
    """
    params = []

    if date_filter:
        query += " AND date = ?"
        params.append(date_filter)
    if roll_filter:
        query += " AND roll_number = ?"
        params.append(roll_filter.strip().upper())
    if class_filter:
        query += " AND class_name = ?"
        params.append(class_filter)

    query += " ORDER BY timestamp DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0],
            "roll_number": r[1],
            "name": r[2],
            "class_name": r[3],
            "date": r[4],
            "time": r[5],
            "status": r[6],
            "confidence": r[7],
            "verification_method": r[8],
            "latitude": r[9],
            "longitude": r[10],
            "distance_from_campus": r[11],
            "timestamp": r[12]
        }
        for r in rows
    ]


def delete_attendance_record(record_id):
    """Deletes an attendance entry by ID."""
    conn = sqlite3.connect(str(LOCAL_DB_PATH))
    cursor = conn.cursor()
    cursor.execute("DELETE FROM attendance WHERE id = ?", (record_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_dashboard_analytics():
    """Calculates comprehensive dashboard analytics, 7-day trend, and campus geofence info."""
    today = datetime.now()
    today_str = today.strftime("%Y-%m-%d")

    all_students = get_all_students()
    total_students = len(all_students)

    today_records = get_all_attendance(date_filter=today_str)
    present_today = len(set(r["roll_number"] for r in today_records if r.get("status") == "Present"))
    absent_today = max(0, total_students - present_today)

    rate = 0.0
    if total_students > 0:
        rate = round((present_today / total_students) * 100, 1)

    trend = []
    for i in range(6, -1, -1):
        day_date = today - timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        day_label = day_date.strftime("%a (%d %b)")
        day_records = get_all_attendance(date_filter=day_str)
        p_count = len(set(r["roll_number"] for r in day_records if r.get("status") == "Present"))
        trend.append({
            "date": day_str,
            "day": day_label,
            "present": p_count,
            "absent": max(0, total_students - p_count)
        })

    recent_logs = get_all_attendance()[:8]
    classes = sorted(list(set(s.get("class_name") for s in all_students if s.get("class_name"))))

    return {
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": absent_today,
        "attendance_rate": rate,
        "today_date": today_str,
        "classes": classes,
        "campus_location": get_campus_location(),
        "trend_7_days": trend,
        "recent_logs": recent_logs,
        "diagnostics": get_db_diagnostics()
    }
