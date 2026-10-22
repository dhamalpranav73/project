
import cv2
from pathlib import Path


PROJECT_FOLDER = Path(__file__).resolve().parent.parent
FACE_FOLDER = PROJECT_FOLDER / "face_data"


def detect_face(roll_number):
    # Locate the student's saved photo
    photo_path = FACE_FOLDER / f"{roll_number}.jpg"

    if not photo_path.exists():
        print("ERROR: Student face photo was not found.")
        return False

    # Load the photo
    image = cv2.imread(str(photo_path))

    if image is None:
        print("ERROR: Could not read the photo.")
        return False

    # Load OpenCV's built-in face detector
    cascade_path = (
        cv2.data.haarcascades
        + "haarcascade_frontalface_default.xml"
    )

    face_detector = cv2.CascadeClassifier(cascade_path)

    if face_detector.empty():
        print("ERROR: Could not load face detector.")
        return False

    # Detect faces in the photo
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    faces = face_detector.detectMultiScale(
        gray_image,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(40, 40)
    )

    if len(faces) == 0:
        print("No face detected. Try a clearer photo.")
        return False

    # Draw a rectangle around each detected face
    for (x, y, width, height) in faces:
        cv2.rectangle(
            image,
            (x, y),
            (x + width, y + height),
            (0, 255, 0),
            3
        )

    output_path = FACE_FOLDER / f"{roll_number}_detected.jpg"
    cv2.imwrite(str(output_path), image)

    print(f"Face detected! Number of faces: {len(faces)}")
    print(f"Result saved to: {output_path}")

    return True


if __name__ == "__main__":
    roll = input("Enter the student's registered roll number: ").strip()
    if roll:
        detect_face(roll)
    else:
        print("Please enter a roll number.")
