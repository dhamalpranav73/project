# Smart Attendance Management System Using AI

An AI-powered attendance management web application that stores student face photos in the database in **Base64** format and marks attendance via live face matching using open-source Python computer vision libraries.

---

## 🚀 Key Features

1. **Student Registration with Base64 Image Storage**:
   - Register students with Roll Number, Name, Class.
   - Capture student face live via browser webcam or upload photo.
   - Automatically optimizes, compresses, and encodes the face into a **Base64 data URL string** stored directly in the database (`students` collection).

2. **Live Face Attendance Station (`/mark-attendance`)**:
   - Live camera view with face alignment guide.
   - 1-click snapshot capture: captures student's live face image.
   - Matches live image against stored Base64 images using open-source **DeepFace** (Facenet model).
   - Automatically marks attendance upon positive match with exact date and time.
   - Prevents duplicate attendance marks on the same day.

3. **Attendance Logs (`/attendance`)**:
   - View real-time attendance records with date, time, student details, status, and AI match distance.
   - Filter attendance records by date.

4. **Registered Students Directory (`/students`)**:
   - View all registered students with thumbnail previews rendered directly from the stored Base64 image data.

5. **Dashboard Overview (`/`)**:
   - Live metrics: Total Students, Present Today, Absent Today, Attendance Rate.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.12, Flask
- **Open-Source Face Recognition**: `DeepFace` (Facenet model + OpenCV detector)
- **Computer Vision**: `OpenCV` (for image processing, resizing, base64 encoding/decoding)
- **Database**: MongoDB Atlas (`pymongo`) with built-in SQLite offline fallback
- **Frontend**: HTML5, CSS3, JavaScript (WebRTC Camera API, Canvas)

---

## 💻 How to Run the Application

### 1. Activate Virtual Environment
```powershell
.\.venv\Scripts\activate
```

### 2. Start the Flask App
```powershell
python app/app.py
```
Open your browser and navigate to:
```
http://127.0.0.1:5000/
```

### 3. Run Automated Tests
```powershell
python tests/test_face_attendance.py
```

---

## 🌐 MongoDB Atlas IP Whitelist Setup
If using MongoDB Atlas, ensure your current IP address is whitelisted in MongoDB Atlas:
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Navigate to **Security** → **Network Access**.
3. Click **Add IP Address** → choose **Add Current IP Address** (or `0.0.0.0/0` to allow access from any IP for development).
4. Click **Confirm**.
*(Note: If Atlas is temporarily unreachable, the app automatically switches to the local SQLite database fallback so testing is never blocked!)*
