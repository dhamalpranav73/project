import cv2
import base64
from pathlib import Path
from database import save_student, get_student

PROJECT_FOLDER = Path(__file__).resolve().parent.parent
FACE_FOLDER = PROJECT_FOLDER / "face_data"
FACE_FOLDER.mkdir(parents=True, exist_ok=True)


def capture_single_frame_base64():
    """
    Captures a single frame from the connected webcam and returns it as Base64 data URL.
    Useful for backend camera triggers.
    """
    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        return None, "Webcam could not be opened."

    try:
        # Allow sensor warm-up
        for _ in range(5):
            camera.read()

        success, frame = camera.read()
        if not success or frame is None:
            return None, "Failed to capture image frame from webcam."

        success, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not success:
            return None, "Failed to encode frame."

        b64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}", None
    finally:
        camera.release()


def capture_face(roll_number):
    """
    Opens interactive OpenCV webcam window.
    SPACEBAR captures the face, saves to disk AND updates the student's Base64 image in the database.
    Q cancels.
    """
    safe_roll_number = "".join(
        ch for ch in roll_number
        if ch.isalnum() or ch in "-_"
    )

    if not safe_roll_number:
        print("ERROR: Invalid roll number.")
        return False

    photo_path = FACE_FOLDER / f"{safe_roll_number}.jpg"

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        print("ERROR: Could not open webcam.")
        return False

    print("Webcam opened successfully.")
    print("Press SPACEBAR to capture.")
    print("Press Q to cancel.")

    captured = False

    try:
        while True:
            success, frame = camera.read()

            if not success:
                print("ERROR: Could not read webcam.")
                break

            cv2.imshow("Student Face Capture - Press SPACE to capture, Q to quit", frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord(" "):
                # Save to disk
                saved = cv2.imwrite(str(photo_path), frame)

                if saved:
                    print("SUCCESS! Photo saved to disk:")
                    print(photo_path)
                    captured = True

                    # Convert to base64 and update database
                    _, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                    b64_str = f"data:image/jpeg;base64,{base64.b64encode(buffer).decode('utf-8')}"

                    student = get_student(roll_number)
                    if student:
                        save_student(
                            roll_number=student["roll_number"],
                            name=student["name"],
                            class_name=student["class_name"],
                            image_base64=b64_str
                        )
                        print("SUCCESS! Student photo updated in database as Base64.")
                    else:
                        print("Note: Student record not found yet in database. Image saved to disk.")
                else:
                    print("ERROR: Could not save photo.")

                break

            elif key == ord("q"):
                print("Capture cancelled.")
                break

    finally:
        camera.release()
        cv2.destroyAllWindows()

    return captured


if __name__ == "__main__":
    roll = input("Enter registered student's roll number: ").strip()
    if roll:
        capture_face(roll)
    else:
        print("Please enter a roll number.")
