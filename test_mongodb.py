
import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient

project_folder = Path(__file__).resolve().parent
load_dotenv(project_folder / "atlas-credentials.env")

uri = os.getenv("MONGODB_URI")

client = MongoClient(uri, serverSelectionTimeoutMS=10000)

db = client["SmartAttendanceDB"]
students = db["students"]

# Create a test student record
student = {
    "roll_number": "TEST001",
    "name": "Test Student",
    "class_name": "MCA Final Year"
}

result = students.insert_one(student)

print("SUCCESS: Student record added!")
print("Record ID:", result.inserted_id)

client.close()
