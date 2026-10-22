import os
import sys
from pathlib import Path
import cv2
import json

# Setup paths
APP_DIR = Path(__file__).resolve().parent.parent / "app"
sys.path.insert(0, str(APP_DIR))

import database
from face_recognition import (
    encode_image_to_base64,
    decode_base64_image,
    find_matching_student,
    verify_faces
)
from app import app


def run_tests():
    print("=" * 60)
    print("RUNNING AUTOMATED FACE ATTENDANCE & GEOFENCING TESTS")
    print("=" * 60)

    # 1. Load test face images
    face_dir = Path(__file__).resolve().parent.parent / "face_data"
    mca001_path = face_dir / "MCA001.jpg"
    diff_person_path = face_dir / "diff_person.jpg"

    assert mca001_path.exists(), "MCA001.jpg must exist in face_data"
    assert diff_person_path.exists(), "diff_person.jpg must exist in face_data"

    img_mca001 = cv2.imread(str(mca001_path))
    img_diff = cv2.imread(str(diff_person_path))

    # 2. Convert to Base64
    b64_mca001 = encode_image_to_base64(img_mca001)
    b64_diff = encode_image_to_base64(img_diff)

    assert b64_mca001.startswith("data:image/jpeg;base64,"), "Base64 encoding failed"
    print("[PASS] Image successfully converted to Base64 data URL")

    # 3. Test Base64 decoding
    decoded_img = decode_base64_image(b64_mca001)
    assert decoded_img is not None, "Failed to decode Base64 back to image"
    assert decoded_img.shape == img_mca001.shape, "Decoded shape does not match original"
    print(f"[PASS] Base64 decoded successfully back to OpenCV image array ({decoded_img.shape})")

    # 4. Save student to database with Base64 image
    test_roll = "TEST_MCA001"
    test_name = "Pranav Automated Test"
    test_class = "MCA AI Specialization"

    saved = database.save_student(
        roll_number=test_roll,
        name=test_name,
        class_name=test_class,
        image_base64=b64_mca001
    )
    assert saved is True, "Database save_student failed"
    print(f"[PASS] Student {test_roll} saved into database with Base64 image")

    student_doc = database.get_student(test_roll)
    assert student_doc is not None, "Could not fetch student from database"
    assert student_doc["roll_number"] == test_roll
    assert student_doc["image_base64"] is not None
    print(f"[PASS] Verified student fetched from database: {student_doc['name']} with Base64 image")

    # Get campus center location for geofence tests
    campus = database.get_campus_location()
    campus_lat = campus["latitude"]
    campus_lon = campus["longitude"]
    print(f"\nCampus location set to: {campus_lat}, {campus_lon} (Radius: {campus['radius_meters']}m)")

    client = app.test_client()

    # 5. Test Geofence: Reject when no GPS is provided
    print("\nTesting Geofence Rejection without GPS coordinates...")
    res_nogps = client.post(
        "/api/attendance/mark",
        data=json.dumps({"image_base64": b64_mca001, "roll_number": test_roll}),
        content_type="application/json"
    )
    assert res_nogps.status_code == 403, f"Expected 403 without GPS, got {res_nogps.status_code}"
    print("[PASS] Attendance correctly blocked when GPS location is not provided (403)")

    # 6. Test Geofence: Reject when student is > 100m away (e.g., 50km away)
    print("\nTesting Geofence Rejection when student is > 100m away...")
    res_outside = client.post(
        "/api/attendance/mark",
        data=json.dumps({
            "image_base64": b64_mca001,
            "roll_number": test_roll,
            "latitude": campus_lat + 0.5, # ~55 km away
            "longitude": campus_lon + 0.5
        }),
        content_type="application/json"
    )
    assert res_outside.status_code == 403, f"Expected 403 outside geofence, got {res_outside.status_code}"
    outside_json = res_outside.get_json()
    assert outside_json["geofence_passed"] is False
    print(f"[PASS] Attendance blocked when student is outside 100m geofence: {outside_json['message']}")

    # 7. Test Face Recognition & Geofence: Pass when within 100m (e.g. 5m away)
    print("\nTesting AI Face Matching when within 100m...")
    res_match = client.post(
        "/api/attendance/mark",
        data=json.dumps({
            "image_base64": b64_mca001,
            "roll_number": test_roll,
            "latitude": campus_lat + 0.00005, # ~5 meters away
            "longitude": campus_lon + 0.00005
        }),
        content_type="application/json"
    )
    assert res_match.status_code == 200, f"Expected 200, got {res_match.status_code}"
    data_match = res_match.get_json()
    print("API Response for Matching Face:", data_match)
    assert data_match["geofence_passed"] is True, "Geofence should pass within 100m"
    assert data_match["matched"] is True, f"Face should match: {data_match}"
    assert data_match["student"]["roll_number"] == test_roll
    print("[PASS] Live face successfully matched within 100m geofence and attendance marked!")

    # 8. Test duplicate prevention on same day
    print("\nTesting duplicate attendance prevention on same day...")
    res_dup = client.post(
        "/api/attendance/mark",
        data=json.dumps({
            "image_base64": b64_mca001,
            "roll_number": test_roll,
            "latitude": campus_lat,
            "longitude": campus_lon
        }),
        content_type="application/json"
    )
    data_dup = res_dup.get_json()
    print("Duplicate Check API Response:", data_dup["message"])
    assert data_dup["success"] is False, "Duplicate attendance on same day should not be marked again"
    assert "already marked" in data_dup["message"].lower()
    print("[PASS] Duplicate attendance properly detected and prevented for the same day")

    # 9. Test API with NON-MATCHING image
    print("\nTesting Non-Matching Face Recognition...")
    res_diff = client.post(
        "/api/attendance/mark",
        data=json.dumps({
            "image_base64": b64_diff,
            "roll_number": test_roll,
            "latitude": campus_lat,
            "longitude": campus_lon
        }),
        content_type="application/json"
    )
    data_diff = res_diff.get_json()
    print("API Response for Non-Matching Face:", data_diff)
    assert data_diff["matched"] is False, "Different face should NOT match"
    print("[PASS] Non-matching face correctly rejected by open-source face recognition")

    # 10. Test Dashboard Stats
    stats = database.get_dashboard_analytics()
    print("\nDashboard Stats:", stats)
    assert stats["total_students"] >= 1
    assert stats["present_today"] >= 1
    print("[PASS] Dashboard statistics updated accurately with GPS-verified logs")

    # Clean up test student
    database.delete_student(test_roll)
    print(f"\n[PASS] Cleaned up temporary test student {test_roll}")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! (100% OPERATIONAL)")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
