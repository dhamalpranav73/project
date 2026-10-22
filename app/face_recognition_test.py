
from pathlib import Path
from deepface import DeepFace

# Project folders
PROJECT_FOLDER = Path(__file__).resolve().parent.parent
FACE_FOLDER = PROJECT_FOLDER / "face_data"

# Photo to test
photo_path = FACE_FOLDER / "MCA001.jpg"

if not photo_path.exists():
    print("ERROR: MCA001.jpg was not found in face_data.")
else:
    print("Testing AI face detection and analysis...")

    try:
        result = DeepFace.analyze(
            img_path=str(photo_path),
            actions=["gender", "age"],
            detector_backend="opencv",
            enforce_detection=True,
            silent=True
        )

        print("SUCCESS! DeepFace processed the photo.")
        print(f"Estimated age: {result[0]['age']}")
        print("Face analysis completed.")

    except Exception as error:
        print("Face analysis failed:")
        print(error)
