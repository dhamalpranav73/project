import os
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from database import (
    save_student,
    get_student,
    get_all_students,
    delete_student,
    mark_student_attendance,
    record_manual_attendance,
    get_all_attendance,
    delete_attendance_record,
    get_dashboard_analytics,
    get_db_diagnostics,
    get_campus_location,
    update_campus_location,
    calculate_haversine_distance,
    verify_admin_credentials,
    change_admin_password,
    generate_auth_token,
    verify_auth_token,
    get_app_settings,
    update_app_settings,
    clear_all_attendance_records,
    get_system_backup
)
from face_capture import capture_face, capture_single_frame_base64
from face_recognition import (
    find_matching_student,
    optimize_base64_image,
    decode_base64_image,
    detect_faces_in_image
)

app = Flask(__name__, template_folder="templates")
CORS(app, resources={r"/api/*": {
    "origins": "*",
    "allow_headers": ["Content-Type", "Authorization", "x-access-token"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}})


def check_auth_header():
    """Extracts and verifies Bearer token from request headers."""
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    elif "x-access-token" in request.headers:
        token = request.headers.get("x-access-token")

    if not token:
        return None, "Authorization token is missing. Please log in as administrator."

    payload = verify_auth_token(token)
    if not payload:
        return None, "Session expired or invalid token. Please log in again."

    return payload, None


# ==========================================
# AUTHENTICATION & SECURITY ENDPOINTS
# ==========================================

@app.route("/api/auth/login", methods=["POST"])
def api_auth_login():
    """Admin login endpoint."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    user_info, err = verify_admin_credentials(username, password)
    if not user_info:
        return jsonify({"success": False, "message": err or "Invalid credentials"}), 401

    token = generate_auth_token(user_info["username"], role=user_info["role"])
    return jsonify({
        "success": True,
        "token": token,
        "user": user_info,
        "message": f"Welcome back, {user_info['username']}!"
    }), 200


@app.route("/api/auth/verify", methods=["GET"])
def api_auth_verify():
    """Verifies existing admin session token."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "valid": False, "message": err}), 401

    return jsonify({
        "success": True,
        "valid": True,
        "user": {"username": payload["sub"], "role": payload.get("role", "admin")}
    }), 200


@app.route("/api/auth/change-password", methods=["POST"])
def api_auth_change_password():
    """Changes admin password; requires valid admin authentication."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": err}), 401

    data = request.get_json(silent=True) or {}
    old_password = data.get("old_password", "").strip()
    new_password = data.get("new_password", "").strip()

    success, msg = change_admin_password(payload["sub"], old_password, new_password)
    status_code = 200 if success else 400
    return jsonify({"success": success, "message": msg}), status_code


# ==========================================
# APPLICATION SETTINGS ENDPOINTS
# ==========================================

@app.route("/api/settings", methods=["GET", "POST"])
def api_app_settings():
    """
    GET: Fetches current application settings (location, face threshold, rules).
    POST: Updates application settings (Requires Admin Bearer Token).
    """
    if request.method == "POST":
        payload, err = check_auth_header()
        if not payload:
            return jsonify({"success": False, "message": err}), 401

        data = request.get_json(silent=True) or {}
        try:
            updated = update_app_settings(data)
            return jsonify({
                "success": True,
                "message": "Application settings saved successfully.",
                "settings": updated
            }), 200
        except Exception as e:
            return jsonify({"success": False, "message": f"Failed to save settings: {str(e)}"}), 500

    # GET request
    settings = get_app_settings()
    return jsonify({"success": True, "settings": settings}), 200


# ==========================================
# SYSTEM MANAGEMENT & BACKUP ENDPOINTS
# ==========================================

@app.route("/api/system/reset-attendance", methods=["POST"])
def api_system_reset_attendance():
    """Resets attendance logs. Requires Admin Bearer Token."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": err}), 401

    count = clear_all_attendance_records()
    return jsonify({
        "success": True,
        "message": f"Successfully cleared {count} attendance records from the database."
    }), 200


@app.route("/api/system/backup", methods=["GET"])
def api_system_backup():
    """Exports full database backup JSON. Requires Admin Bearer Token."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": err}), 401

    backup_data = get_system_backup()
    return jsonify({
        "success": True,
        "backup": backup_data
    }), 200


# ==========================================
# REST API ENDPOINTS FOR NEXT.JS FRONTEND
# ==========================================

@app.route("/api/stats", methods=["GET"])
def api_get_stats():
    """Returns real-time dashboard analytics, trends, geofence, and diagnostics."""
    stats = get_dashboard_analytics()
    return jsonify(stats), 200


@app.route("/api/database/status", methods=["GET"])
def api_get_db_status():
    """Returns detailed database engine health and diagnostics."""
    diagnostics = get_db_diagnostics()
    return jsonify(diagnostics), 200


@app.route("/api/location/config", methods=["GET", "POST"])
def api_location_config():
    """
    GET: Returns current college campus coordinates and allowed radius (100m).
    POST: Updates campus location or calibrates to current admin GPS location (Requires Admin Auth).
    """
    if request.method == "POST":
        payload, err = check_auth_header()
        if not payload:
            return jsonify({"success": False, "message": f"Admin authentication required: {err}"}), 401

        data = request.get_json(silent=True) or {}
        lat = data.get("latitude")
        lon = data.get("longitude")
        radius = data.get("radius_meters", 100.0)
        name = data.get("name", "College Campus / Classroom")
        enabled = data.get("enabled", True)

        if lat is None or lon is None:
            return jsonify({"success": False, "message": "Latitude and longitude are required."}), 400

        updated = update_campus_location(
            latitude=lat,
            longitude=lon,
            radius_meters=radius,
            name=name,
            enabled=enabled
        )
        return jsonify({
            "success": True,
            "message": f"Campus location set to ({lat}, {lon}) with {radius}m geofence radius.",
            "config": updated
        }), 200

    # GET
    campus = get_campus_location()
    return jsonify({"success": True, "config": campus}), 200


@app.route("/api/students", methods=["GET"])
def api_get_students():
    """Fetches all students with optional search query and class filtering."""
    search = request.args.get("search", "").strip()
    class_name = request.args.get("class_name", "").strip()
    students = get_all_students(search=search if search else None, class_filter=class_name if class_name else None)
    return jsonify({"success": True, "count": len(students), "students": students}), 200


@app.route("/api/students/<roll_number>", methods=["GET"])
def api_get_student_detail(roll_number):
    """Fetches single student details by roll number."""
    student = get_student(roll_number)
    if not student:
        return jsonify({"success": False, "message": "Student not found"}), 404
    return jsonify({"success": True, "student": student}), 200


@app.route("/api/students", methods=["POST"])
def api_register_student():
    """Registers a student in the database. Prevents accidental overwrite of existing students."""
    data = request.get_json(silent=True) or request.form
    roll_number = data.get("roll_number", "").strip().upper()
    name = data.get("name", "").strip()
    class_name = data.get("class_name", "").strip()
    email = data.get("email", "").strip()
    image_base64 = data.get("image_base64", "").strip()

    if not roll_number or not name or not class_name:
        return jsonify({"success": False, "message": "Roll number, Name, and Class are required."}), 400

    if not image_base64:
        return jsonify({"success": False, "message": "Face photo is required for facial recognition."}), 400

    # Check for duplicate registration
    existing = get_student(roll_number)
    if existing:
        payload, _ = check_auth_header()
        if not payload:
            return jsonify({
                "success": False,
                "message": f"Roll number '{roll_number}' is already registered to '{existing['name']}'. To update their profile, please log in as an administrator."
            }), 409

    try:
        optimized_b64 = optimize_base64_image(image_base64, max_dimension=640, quality=85)
        save_student(
            roll_number=roll_number,
            name=name,
            class_name=class_name,
            image_base64=optimized_b64,
            email=email
        )
        saved_student = get_student(roll_number)
        return jsonify({
            "success": True,
            "message": f"Student {name} ({roll_number}) registered successfully with Base64 face in database!",
            "student": saved_student
        }), 201
    except Exception as e:
        app.logger.exception("Registration failed")
        return jsonify({"success": False, "message": f"Database save error: {str(e)}"}), 500


@app.route("/api/students/<roll_number>", methods=["PUT"])
def api_update_student(roll_number):
    """Updates student information or updates their reference Base64 facial photo (Requires Admin Auth)."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": f"Admin authentication required: {err}"}), 401

    student = get_student(roll_number)
    if not student:
        return jsonify({"success": False, "message": "Student not found"}), 404

    data = request.get_json(silent=True) or {}
    name = data.get("name", student["name"]).strip()
    class_name = data.get("class_name", student["class_name"]).strip()
    email = data.get("email", student.get("email", "")).strip()
    image_base64 = data.get("image_base64")

    opt_b64 = None
    if image_base64:
        opt_b64 = optimize_base64_image(image_base64)

    save_student(
        roll_number=roll_number,
        name=name,
        class_name=class_name,
        image_base64=opt_b64 or student.get("image_base64"),
        email=email
    )

    updated = get_student(roll_number)
    return jsonify({"success": True, "message": "Student updated successfully", "student": updated}), 200


@app.route("/api/students/<roll_number>", methods=["DELETE"])
def api_delete_student(roll_number):
    """Deletes student from database (Requires Admin Auth)."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": f"Admin authentication required: {err}"}), 401

    success = delete_student(roll_number)
    return jsonify({"success": success, "message": f"Student {roll_number} deleted successfully."}), 200


@app.route("/api/attendance", methods=["GET"])
def api_get_attendance():
    """Fetches attendance records with date, class, or roll number filter."""
    date_filter = request.args.get("date", "").strip()
    roll_filter = request.args.get("roll_number", "").strip()
    class_filter = request.args.get("class_name", "").strip()

    records = get_all_attendance(
        date_filter=date_filter if date_filter else None,
        roll_filter=roll_filter if roll_filter else None,
        class_filter=class_filter if class_filter else None
    )
    return jsonify({"success": True, "count": len(records), "records": records}), 200


@app.errorhandler(500)
def handle_500_error(e):
    """Ensures all 500 errors return JSON, avoiding unexpected token '<' errors on client."""
    import traceback
    return jsonify({
        "success": False,
        "matched": False,
        "face_detected": False,
        "message": f"Internal server error: {str(e)}",
        "detail": traceback.format_exc()
    }), 500


@app.errorhandler(Exception)
def handle_general_exception(e):
    """Catches all unhandled exceptions and returns structured JSON."""
    import traceback
    return jsonify({
        "success": False,
        "matched": False,
        "face_detected": False,
        "message": f"Server exception: {str(e)}",
        "detail": traceback.format_exc()
    }), 500


@app.route("/api/attendance/mark", methods=["POST"])
def api_mark_attendance_face():
    """
    Primary AI Face Matching & 100m Geofencing Endpoint.
    1. Validates that student is within 100m of the college campus coordinates.
    2. Matches live face with database Base64 photo using DeepFace.
    3. Records attendance in database with distance audit log.
    """
    try:
        data = request.get_json(silent=True) or {}
        live_image_b64 = data.get("image_base64", "").strip()
        specific_roll = data.get("roll_number", "").strip().upper()
        student_lat = data.get("latitude")
        student_lon = data.get("longitude")

        if not live_image_b64:
            return jsonify({
                "success": False,
                "matched": False,
                "message": "No live camera photo received. Please look at the camera and capture frame."
            }), 400

        # ==========================================
        # GEOFENCE CHECK (Must be within 100m)
        # ==========================================
        campus = get_campus_location()
        distance_from_campus = None

        if campus and campus.get("enabled", True):
            allowed_radius = float(campus.get("radius_meters", 100.0))

            if student_lat is None or student_lon is None:
                return jsonify({
                    "success": False,
                    "matched": False,
                    "geofence_passed": False,
                    "message": "GPS location is required. You must enable location access to verify you are within 100m of the campus."
                }), 200

            distance_from_campus = calculate_haversine_distance(
                student_lat, student_lon,
                campus["latitude"], campus["longitude"]
            )

            if distance_from_campus > allowed_radius:
                return jsonify({
                    "success": False,
                    "matched": False,
                    "geofence_passed": False,
                    "distance_meters": distance_from_campus,
                    "allowed_radius": allowed_radius,
                    "message": f"Geofence Restriction: You are {int(distance_from_campus)}m away from the campus/classroom. Attendance can only be marked within {int(allowed_radius)}m."
                }), 200

        students = get_all_students()
        if not students:
            return jsonify({
                "success": False,
                "matched": False,
                "message": "No registered students found in database. Please register students first."
            }), 400

        # ==========================================
        # RAPID HUMAN FACE PRESENCE CHECK (OpenCV Haar 3ms)
        # ==========================================
        has_face, face_boxes = detect_faces_in_image(live_image_b64)
        if not has_face:
            return jsonify({
                "success": False,
                "face_detected": False,
                "matched": False,
                "geofence_passed": True,
                "distance_from_campus": distance_from_campus,
                "message": "Looking for human face in camera..."
            }), 200

        app_settings = get_app_settings()

        # Match using open-source DeepFace Facenet with configured threshold
        matched_student, distance, err = find_matching_student(
            live_image_input=live_image_b64,
            students_list=students,
            specific_roll=specific_roll if specific_roll else None,
            threshold=app_settings.get("match_threshold", 0.40)
        )

        if not matched_student:
            return jsonify({
                "success": False,
                "face_detected": True,
                "matched": False,
                "geofence_passed": True,
                "distance_from_campus": distance_from_campus,
                "face_boxes": face_boxes,
                "message": err or "Face detected, but did not match any registered student in database."
            }), 200

        # Mark attendance in database with GPS metadata
        success, msg, record = mark_student_attendance(
            roll_number=matched_student["roll_number"],
            name=matched_student["name"],
            class_name=matched_student.get("class_name", ""),
            confidence=distance,
            verification_method="AI Face Auto-Scan",
            latitude=student_lat,
            longitude=student_lon,
            distance_from_campus=distance_from_campus
        )

        return jsonify({
            "success": success,
            "face_detected": True,
            "matched": True,
            "geofence_passed": True,
            "message": msg,
            "student": {
                "roll_number": matched_student["roll_number"],
                "name": matched_student["name"],
                "class_name": matched_student.get("class_name", ""),
                "image_base64": matched_student.get("image_base64", "")
            },
            "distance": round(distance, 4) if distance is not None else None,
            "distance_from_campus": distance_from_campus,
            "face_boxes": face_boxes,
            "record": record
        }), 200

    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        app.logger.error(f"Error in api_mark_attendance_face: {trace}")
        return jsonify({
            "success": False,
            "face_detected": False,
            "matched": False,
            "message": f"Face recognition error: {str(e)}",
            "error": str(e),
            "traceback": trace
        }), 200


@app.route("/api/attendance/manual", methods=["POST"])
def api_mark_attendance_manual():
    """Manual attendance recording / admin override (Requires Admin Auth)."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": f"Admin authentication required: {err}"}), 401

    data = request.get_json(silent=True) or {}
    roll = data.get("roll_number", "").strip().upper()
    status = data.get("status", "Present").strip()
    date_val = data.get("date", "").strip()

    if not roll:
        return jsonify({"success": False, "message": "Roll number is required"}), 400

    success, msg, record = record_manual_attendance(roll_number=roll, status=status, date_str=date_val if date_val else None)
    if not success:
        return jsonify({"success": False, "message": msg}), 400
    return jsonify({"success": True, "message": msg, "record": record}), 200


@app.route("/api/attendance/<record_id>", methods=["DELETE"])
def api_delete_attendance(record_id):
    """Deletes an attendance record (Requires Admin Auth)."""
    payload, err = check_auth_header()
    if not payload:
        return jsonify({"success": False, "message": f"Admin authentication required: {err}"}), 401

    deleted = delete_attendance_record(record_id)
    return jsonify({"success": deleted, "message": "Attendance record deleted." if deleted else "Record not found."}), 200


@app.route("/api/capture-webcam", methods=["POST"])
def api_capture_webcam():
    """Triggers server webcam snapshot via OpenCV."""
    b64_img, err = capture_single_frame_base64()
    if err or not b64_img:
        return jsonify({"success": False, "error": err or "Failed to capture webcam"}), 500
    return jsonify({"success": True, "image_base64": b64_img}), 200


# ==========================================
# LEGACY HTML TEMPLATE ROUTES (OPTIONAL)
# ==========================================

@app.route("/")
def home():
    stats = get_dashboard_analytics()
    return render_template("dashboard.html", stats=stats)

@app.route("/register", methods=["GET", "POST"])
def register_student():
    if request.method == "POST":
        roll_number = request.form.get("roll_number", "").strip().upper()
        student_name = request.form.get("student_name", "").strip()
        class_name = request.form.get("class_name", "").strip()
        image_base64 = request.form.get("image_base64", "").strip()
        if roll_number and student_name and class_name and image_base64:
            opt = optimize_base64_image(image_base64)
            save_student(roll_number, student_name, class_name, opt)
            return render_template("register_student.html", saved=True, student={"roll_number": roll_number, "name": student_name, "class_name": class_name})
    return render_template("register_student.html")

@app.route("/students")
def view_students():
    return render_template("students.html", students=get_all_students())

@app.route("/mark-attendance")
def mark_attendance_page():
    return render_template("mark_attendance.html")

@app.route("/attendance")
def view_attendance():
    date_filter = request.args.get("date", "").strip()
    return render_template("attendance.html", records=get_all_attendance(date_filter=date_filter if date_filter else None), selected_date=date_filter)

@app.route("/capture-face", methods=["GET", "POST"])
def capture_face_page():
    return render_template("capture_face.html")


@app.route("/healthz")
@app.route("/api/health")
def healthz():
    """Lightweight keep-alive health check endpoint for Render."""
    return jsonify({
        "status": "healthy",
        "service": "SmartAttendanceAI Backend",
        "timestamp": os.environ.get("RENDER_GIT_COMMIT", "live")
    }), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    debug = os.environ.get("FLASK_DEBUG", "True").lower() in ("true", "1")
    app.run(host=host, port=port, debug=debug)
