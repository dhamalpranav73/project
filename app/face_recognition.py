import base64
import numpy as np
import cv2
from pathlib import Path
from deepface import DeepFace

PROJECT_FOLDER = Path(__file__).resolve().parent.parent
FACE_FOLDER = PROJECT_FOLDER / "face_data"
FACE_FOLDER.mkdir(parents=True, exist_ok=True)


def decode_base64_image(base64_str):
    """
    Decodes a base64 string (with or without data URL header)
    into an OpenCV BGR image (numpy array).
    """
    if not base64_str or not isinstance(base64_str, str):
        return None

    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]

        # Fix base64 padding if needed
        padding_needed = len(base64_str) % 4
        if padding_needed:
            base64_str += "=" * (4 - padding_needed)

        image_bytes = base64.b64decode(base64_str)
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None


def encode_image_to_base64(image_np, quality=85):
    """
    Encodes an OpenCV BGR image (numpy array) to a base64 data URL string.
    """
    if image_np is None:
        return None

    try:
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        success, buffer = cv2.imencode(".jpg", image_np, encode_params)
        if not success:
            return None

        b64_str = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/jpeg;base64,{b64_str}"
    except Exception as e:
        print(f"Error encoding image to base64: {e}")
        return None


def optimize_base64_image(base64_str, max_dimension=640, quality=85):
    """
    Resizes image to a max dimension and compresses JPEG quality
    to keep database size small and DeepFace processing fast.
    """
    img = decode_base64_image(base64_str)
    if img is None:
        return base64_str

    h, w = img.shape[:2]
    if max(h, w) > max_dimension:
        scale = max_dimension / float(max(h, w))
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    return encode_image_to_base64(img, quality=quality)


def _prepare_image_input(img_input):
    """
    Converts path, base64 string, or numpy array to an acceptable DeepFace input.
    """
    if isinstance(img_input, np.ndarray):
        return img_input

    if isinstance(img_input, str):
        if img_input.startswith("data:image") or len(img_input) > 260:
            decoded = decode_base64_image(img_input)
            if decoded is not None:
                return decoded
        path = Path(img_input)
        if path.exists():
            return cv2.imread(str(path))

    return None


# Load Haar Cascade detector for rapid (<5ms) human face presence detection
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def detect_faces_in_image(image_input):
    """
    Rapid (3-5ms) OpenCV Haar-Cascade detector to check if a human face is present.
    Returns: (has_face: bool, face_boxes: list of dict(x, y, w, h))
    """
    img = _prepare_image_input(image_input)
    if img is None:
        return False, []

    h, w = img.shape[:2]
    # Resize down to max 320px width for near-instant 3ms detection
    scale = 320.0 / float(max(w, 320))
    target_w = max(1, int(w * scale))
    target_h = max(1, int(h * scale))
    small = cv2.resize(img, (target_w, target_h))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.15,
        minNeighbors=3,
        minSize=(30, 30)
    )

    boxes = []
    inv_scale = 1.0 / scale
    for (x, y, fw, fh) in faces:
        boxes.append({
            "x": int(x * inv_scale),
            "y": int(y * inv_scale),
            "w": int(fw * inv_scale),
            "h": int(fh * inv_scale)
        })

    return len(faces) > 0, boxes


def verify_faces(img1_input, img2_input, model_name="Facenet", custom_threshold=None):
    """
    Compares two faces using DeepFace open-source library.
    Returns: dict(verified=bool, distance=float, threshold=float)
    """
    img1 = _prepare_image_input(img1_input)
    img2 = _prepare_image_input(img2_input)

    if img1 is None or img2 is None:
        return {"verified": False, "distance": 1.0, "threshold": 0.4, "error": "Invalid image data"}

    try:
        result = DeepFace.verify(
            img1_path=img1,
            img2_path=img2,
            model_name=model_name,
            detector_backend="opencv",
            enforce_detection=False,
            silent=True
        )

        distance = float(result.get("distance", 1.0))
        default_thresh = float(result.get("threshold", 0.4))
        effective_thresh = float(custom_threshold) if custom_threshold is not None else default_thresh
        verified = distance <= effective_thresh

        return {
            "verified": bool(verified),
            "distance": distance,
            "threshold": effective_thresh
        }
    except Exception as e:
        print(f"DeepFace verification error: {e}")
        return {"verified": False, "distance": 1.0, "threshold": 0.4, "error": str(e)}


def find_matching_student(live_image_input, students_list, specific_roll=None, threshold=None):
    """
    Matches a live image against registered students' database images.
    If specific_roll is provided, only verifies against that student.
    Otherwise, matches against all registered students (1-to-N).
    
    Returns: (matched_student_dict, distance, error_message)
    """
    live_img = _prepare_image_input(live_image_input)
    if live_img is None:
        return None, None, "Invalid live image captured. Please try again."

    best_student = None
    min_distance = 999.0

    for student in students_list:
        roll = student.get("roll_number")
        if not roll:
            continue

        if specific_roll and roll.strip().upper() != specific_roll.strip().upper():
            continue

        db_image_base64 = student.get("image_base64")
        db_img = None

        if db_image_base64:
            db_img = decode_base64_image(db_image_base64)
        else:
            # Fallback to local face_data file if migration is pending
            safe_roll = "".join(ch for ch in roll if ch.isalnum() or ch in "-_")
            fallback_file = FACE_FOLDER / f"{safe_roll}.jpg"
            if fallback_file.exists():
                db_img = cv2.imread(str(fallback_file))

        if db_img is None:
            continue

        try:
            match_res = verify_faces(live_img, db_img, custom_threshold=threshold)
            distance = match_res.get("distance", 1.0)
            verified = match_res.get("verified", False)

            # Check if verified and best candidate so far
            if verified and distance < min_distance:
                min_distance = distance
                best_student = student

        except Exception as err:
            print(f"Error comparing with {roll}: {err}")

    if best_student:
        return best_student, min_distance, None
    else:
        return None, None, "Face did not match any registered student in database."
