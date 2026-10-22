"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  UserPlus, 
  Camera, 
  Upload, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Check,
  Cpu,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { API_BASE } from "@/lib/api";

export default function RegisterStudentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [rollNumber, setRollNumber] = useState("");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [email, setEmail] = useState("");

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video play error:", e);
        }
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setCameraActive(false);
      if (err.name === "NotReadableError" || err.message?.includes("in use") || err.message?.includes("Device in use")) {
        setCameraError(
          "Camera is currently in use by another tab or application. Please close other camera tabs, or use the OpenCV Camera button below."
        );
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Please allow camera access in your browser address bar.");
      } else {
        setCameraError("Could not access camera: " + (err.message || "Unknown error"));
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const b64 = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedImageBase64(b64);
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImageBase64(null);
    startCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImageBase64(event.target?.result as string);
      stopCamera();
      setCameraError(null);
    };
    reader.readAsDataURL(file);
  };

  // Trigger OpenCV server camera
  const captureViaOpenCV = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const res = await fetch(`${API_BASE}/api/capture-webcam`, { method: "POST" });
      const data = await res.json();
      if (data.success && data.image_base64) {
        setCapturedImageBase64(data.image_base64);
      } else {
        setCameraError("OpenCV capture failed: " + (data.error || "Webcam could not be opened on server."));
      }
    } catch (err: any) {
      setCameraError("Failed to connect to server camera: " + err.message);
    }
  };

  // Auto-start camera on page mount, stop on unmount/tab hide
  useEffect(() => {
    startCamera();

    const handleVisibility = () => {
      if (document.hidden) {
        stopCamera();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", stopCamera);

    return () => {
      stopCamera();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", stopCamera);
    };
  }, [stopCamera]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertInfo(null);

    if (!rollNumber.trim() || !name.trim() || !className.trim()) {
      setAlertInfo({ type: "error", message: "Please fill in Roll Number, Full Name, and Class." });
      return;
    }

    if (!capturedImageBase64) {
      setAlertInfo({ type: "error", message: "Please capture or upload a face photo for registration." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roll_number: rollNumber.trim().toUpperCase(),
          name: name.trim(),
          class_name: className.trim(),
          email: email.trim(),
          image_base64: capturedImageBase64
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAlertInfo({
          type: "success",
          message: `Student ${name} (${rollNumber}) registered and Base64 facial data saved in database!`
        });
        setRollNumber("");
        setName("");
        setClassName("");
        setEmail("");
        setCapturedImageBase64(null);
      } else {
        setAlertInfo({ type: "error", message: data.message || "Failed to save student." });
      }
    } catch (err: any) {
      setAlertInfo({ type: "error", message: "Network error: " + err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
      {/* Back button */}
      <div className="pb-3 border-b border-slate-200">
        <Link href="/students" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Students Directory
        </Link>
      </div>

      <div className="text-center max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Register New Student
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Store student credentials and reference face photo as Base64 in the database.
        </p>
      </div>

      {alertInfo && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
          alertInfo.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
            : "bg-rose-50 border-rose-200 text-rose-900"
        }`}>
          {alertInfo.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h2 className="text-sm font-bold">{alertInfo.message}</h2>
            {alertInfo.type === "success" && (
              <div className="flex items-center gap-4 mt-2 text-xs font-semibold">
                <Link href="/attendance/mark" className="text-emerald-700 underline hover:text-emerald-800">
                  Test Face Attendance Now →
                </Link>
                <Link href="/students" className="text-emerald-700 underline hover:text-emerald-800">
                  View in Student Roster →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera In Use / Error Notification */}
      {cameraError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h2 className="text-sm font-bold">Webcam Notice</h2>
            <p className="text-xs text-amber-800 leading-relaxed">{cameraError}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
              <button
                type="button"
                onClick={captureViaOpenCV}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Cpu className="w-3.5 h-3.5" />
                Use OpenCV Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Roll Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Roll Number *
            </label>
            <input
              type="text"
              required
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. MCA001, CS2026"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Student Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pranav Dhamal"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Class / Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Class / Department *
            </label>
            <input
              type="text"
              required
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. MCA Final Year, CS 3rd Sem"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Email Address (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student@college.edu"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Biometric Face Capture Box */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-blue-600" />
              Biometric Face Photo (Base64 Stored in Database) *
            </span>
            {capturedImageBase64 && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Check className="w-3.5 h-3.5" />
                Photo Ready
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Viewport: Video is ALWAYS in DOM */}
            <div className="relative w-56 h-56 sm:w-64 sm:h-64 bg-slate-900 rounded-2xl overflow-hidden border border-slate-300 shadow-inner shrink-0 flex items-center justify-center">
              {/* Captured Photo Preview */}
              {capturedImageBase64 && (
                <img
                  src={capturedImageBase64}
                  alt="Captured Face"
                  className="absolute inset-0 w-full h-full object-cover z-10"
                />
              )}

              {/* Video is always mounted so ref is NEVER null */}
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] ${
                  cameraActive && !capturedImageBase64 ? "block" : "hidden"
                }`}
              />

              {/* Center target guide overlay when camera is streaming */}
              {cameraActive && !capturedImageBase64 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
                  <div className="w-40 h-48 border-2 border-dashed border-emerald-400/80 rounded-2xl flex items-end justify-center pb-2">
                    <span className="text-[10px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-xs">
                      Align Face
                    </span>
                  </div>
                </div>
              )}

              {/* Inactive Placeholder */}
              {!cameraActive && !capturedImageBase64 && (
                <div className="text-center p-4 text-slate-400 space-y-2">
                  <Camera className="w-10 h-10 mx-auto text-slate-500 opacity-60" />
                  <p className="text-xs font-medium text-slate-400">Camera is paused</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
                  >
                    Start Camera
                  </button>
                </div>
              )}

              {/* Hidden Canvas */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Controls */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <p className="text-xs text-slate-500 leading-relaxed">
                Center the student&apos;s face in the camera and click <strong>Capture Photo</strong>. The photo is automatically compressed and saved as Base64 in the database.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {!capturedImageBase64 ? (
                  cameraActive ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Photo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                    >
                      <Camera className="w-4 h-4" />
                      Start Camera
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={retakePhoto}
                    className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Retake Photo
                  </button>
                )}

                <button
                  type="button"
                  onClick={captureViaOpenCV}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                  title="Capture frame using OpenCV backend camera"
                >
                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                  OpenCV Cam
                </button>

                <label className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  Upload File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving to Database...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Save Student &amp; Store Face in Database
            </>
          )}
        </button>
      </form>
    </div>
  );
}
