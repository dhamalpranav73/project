"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Camera, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  User, 
  ArrowLeft, 
  Upload, 
  Cpu, 
  AlertTriangle, 
  RefreshCw, 
  MapPin, 
  Navigation, 
  ShieldCheck, 
  Compass,
  Zap,
  ZapOff,
  Scan,
  Volume2
} from "lucide-react";
import { API_BASE, fetchCampusLocation, updateCampusLocation, CampusLocation } from "@/lib/api";

function calculateClientDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000.0;
  const dLat = (lat2 - lat1) * Math.PI / 180.0;
  const dLon = (lon2 - lon1) * Math.PI / 180.0;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Crisp dual-tone success chime synthesizer (Web Audio API)
function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.14); // A5
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);
  } catch (e) {
    console.warn("Audio playback not allowed yet:", e);
  }
}

export default function MarkAttendancePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const [streamActive, setStreamActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [rollFilter, setRollFilter] = useState("");
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);

  // Auto-Detect & Auto-Marking State
  const [autoDetect, setAutoDetect] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [scanStatus, setScanStatus] = useState("Looking for human face...");
  const [cooldown, setCooldown] = useState(0);

  // Geofence states
  const [campusConfig, setCampusConfig] = useState<CampusLocation | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [settingLocation, setSettingLocation] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  }, []);

  // Initialize camera
  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      setResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn("Video play error:", e);
        }
        setStreamActive(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotReadableError" || err.message?.includes("in use") || err.message?.includes("Device in use")) {
        setCameraError(
          "Camera is currently locked by another open browser tab. Please close other camera tabs, then click 'Retry Camera'."
        );
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied in your browser settings.");
      } else {
        setCameraError("Could not access camera: " + (err.message || "Unknown error"));
      }
      setStreamActive(false);
    }
  };

  // Get User's GPS Location
  const requestGPSLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
        setLocationError(null);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setLocationError("Location permission required. Please enable location to verify you are within 100m of campus.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Load campus location
  const loadCampus = async () => {
    const loc = await fetchCampusLocation();
    if (loc) {
      setCampusConfig(loc);
    }
  };

  // Set Current User GPS Location as Campus Center Point
  const handleSetCurrentAsCampus = async () => {
    if (!userLocation) {
      requestGPSLocation();
      alert("Fetching your current location... Please allow location access in your browser.");
      return;
    }

    setSettingLocation(true);
    const updated = await updateCampusLocation(
      userLocation.lat,
      userLocation.lon,
      100.0,
      "College Campus / Classroom",
      true
    );
    setSettingLocation(false);
    if (updated) {
      setCampusConfig(updated);
      alert(`Campus location successfully set to your current coordinates! Geofence set to 100m radius.`);
    } else {
      alert("Failed to update campus location.");
    }
  };

  useEffect(() => {
    startCamera();
    requestGPSLocation();
    loadCampus();

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

  // Compute live distance
  let distanceToCampus: number | null = null;
  let isWithinGeofence = false;

  if (userLocation && campusConfig && campusConfig.enabled) {
    distanceToCampus = calculateClientDistance(
      userLocation.lat,
      userLocation.lon,
      campusConfig.latitude,
      campusConfig.longitude
    );
    isWithinGeofence = distanceToCampus <= campusConfig.radius_meters;
  }

  // Safe response parser that avoids "Unexpected token '<'" on server errors
  const safeParseResponse = async (res: Response) => {
    try {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await res.json();
      }
      const rawText = await res.text();
      return {
        success: false,
        face_detected: false,
        matched: false,
        message: `Server status ${res.status}: ${res.statusText || "Communication issue with AI service."}`
      };
    } catch (e: any) {
      return {
        success: false,
        face_detected: false,
        matched: false,
        message: `Unable to read server response: ${e.message}`
      };
    }
  };

  // ==========================================
  // AUTOMATIC FRAME SCANNER & ATTENDANCE MARK
  // ==========================================
  const performScan = useCallback(async (isManual = false) => {
    if (!videoRef.current || !canvasRef.current) return;
    if (isScanningRef.current) return;
    if (!isManual && cooldown > 0) return;

    // Check geofence restriction if enabled
    if (campusConfig?.enabled) {
      if (!userLocation) {
        setScanStatus("Acquiring GPS location... Please allow location in your browser.");
        if (isManual) {
          alert("GPS location is required. Please allow location permissions in your browser.");
          requestGPSLocation();
        }
        return;
      }
      if (!isWithinGeofence && distanceToCampus !== null) {
        setScanStatus(`Geofence restriction: ${distanceToCampus}m away from campus (Max: ${campusConfig.radius_meters}m)`);
        setResult({
          success: false,
          matched: false,
          geofence_passed: false,
          distance_meters: distanceToCampus,
          message: `Geofence Restriction: You are ${distanceToCampus}m away from the campus/classroom. Attendance can only be marked within ${campusConfig.radius_meters}m.`
        });
        if (isManual) {
          alert(`Geofence restriction: You are ${distanceToCampus}m away from campus. Attendance can only be marked within ${campusConfig.radius_meters}m.`);
        }
        return;
      }
    }

    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    isScanningRef.current = true;
    if (isManual) {
      setLoading(true);
      setStatusMessage("Detecting face and verifying attendance with DeepFace AI...");
    }

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        isScanningRef.current = false;
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL("image/jpeg", 0.85);

      const res = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64Image,
          roll_number: rollFilter.trim(),
          latitude: userLocation?.lat ?? null,
          longitude: userLocation?.lon ?? null
        })
      });

      const data = await safeParseResponse(res);

      // If geofence failed on backend
      if (data.geofence_passed === false || res.status === 403) {
        setResult(data);
        setFaceDetected(false);
        setScanStatus(data.message || "Geofence restriction: Outside campus range.");
        setCooldown(4); // Pause auto-scan so it doesn't loop when out of range
        return;
      }

      if (data.face_detected) {
        setFaceDetected(true);

        if (data.matched && data.success) {
          // SUCCESS: Match confirmed and attendance recorded
          playSuccessChime();
          setResult(data);
          setLastCapturedImage(base64Image);
          setCooldown(5); // 5-second cooldown to let student step away
          setScanStatus(`Attendance marked for ${data.student?.name}!`);
        } else if (data.matched && !data.success) {
          // Already marked today
          setResult(data);
          setCooldown(4);
          setScanStatus(data.message || "Attendance already marked today.");
        } else {
          // Face detected but not matched to registered student
          setScanStatus("Human face detected • Student not matched in database");
          setCooldown(2); // Short 2-second pause to prevent hammering server on unmatched faces
          if (isManual) setResult(data);
        }
      } else {
        // No human face currently visible in webcam feed
        setFaceDetected(false);
        setScanStatus("Scanning: Looking for human face in camera...");
        if (isManual) setResult(data);
      }
    } catch (err: any) {
      console.warn("Scan error:", err);
      if (isManual) {
        setResult({
          success: false,
          matched: false,
          message: "Failed to connect to backend: " + err.message
        });
      }
    } finally {
      isScanningRef.current = false;
      if (isManual) setLoading(false);
    }
  }, [cooldown, campusConfig, isWithinGeofence, distanceToCampus, rollFilter, userLocation]);

  // Continuous auto-scan loop (every 1200ms)
  useEffect(() => {
    if (!streamActive || !autoDetect || cooldown > 0) return;

    const interval = setInterval(() => {
      performScan(false);
    }, 1200);

    return () => clearInterval(interval);
  }, [streamActive, autoDetect, cooldown, performScan]);

  // Countdown timer for cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Upload photo handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setLastCapturedImage(base64);
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/attendance/mark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: base64,
            roll_number: rollFilter.trim(),
            latitude: userLocation?.lat ?? null,
            longitude: userLocation?.lon ?? null
          })
        });
        const data = await safeParseResponse(res);

      // If geofence failed on backend
      if (data.geofence_passed === false || res.status === 403) {
        setResult(data);
        setFaceDetected(false);
        setScanStatus(data.message || "Geofence restriction: Outside campus range.");
        setCooldown(4); // Pause auto-scan so it doesn't loop when out of range
        return;
      }
        setResult(data);
        if (data.matched && data.success) playSuccessChime();
      } catch (err: any) {
        setResult({ success: false, matched: false, message: err.message });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // OpenCV server webcam trigger
  const triggerOpenCVCamera = async () => {
    stopCamera();
    setLoading(true);
    setStatusMessage("Triggering OpenCV camera...");
    try {
      const res = await fetch(`${API_BASE}/api/capture-webcam`, { method: "POST" });
      const data = await res.json();

      if (data.success && data.image_base64) {
        setLastCapturedImage(data.image_base64);
        const matchRes = await fetch(`${API_BASE}/api/attendance/mark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: data.image_base64,
            roll_number: rollFilter.trim(),
            latitude: userLocation?.lat ?? null,
            longitude: userLocation?.lon ?? null
          })
        });
        const matchData = await safeParseResponse(matchRes);
        setResult(matchData);
        if (matchData.matched && matchData.success) playSuccessChime();
      } else {
        alert("OpenCV Capture failed: " + (data.error || "Webcam could not be opened."));
      }
    } catch (err: any) {
      alert("Failed to communicate with server: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md border border-blue-200 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          100m Geofence Active
        </span>
      </div>

      <div className="text-center max-w-lg mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Auto-Detect Attendance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Look at the camera. The system automatically detects human faces and marks attendance instantly.
        </p>
      </div>

      {/* Geofence & Auto-Scan Status Control Bar */}
      <div className="max-w-2xl mx-auto space-y-3">
        {/* Geofence Badge */}
        <div className="p-3.5 rounded-2xl border shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${
              isWithinGeofence 
                ? "bg-emerald-100 text-emerald-700" 
                : userLocation 
                ? "bg-rose-100 text-rose-700" 
                : "bg-amber-100 text-amber-700"
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Geofence Status:</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  isWithinGeofence 
                    ? "bg-emerald-100 text-emerald-800" 
                    : userLocation 
                    ? "bg-rose-100 text-rose-800" 
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {isWithinGeofence
                    ? `✓ Inside Campus (${distanceToCampus}m away)`
                    : userLocation
                    ? `✕ Out of Range (${distanceToCampus}m away • Max: 100m)`
                    : "Locating GPS..."}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {locationError ? locationError : `Classroom radius: ${campusConfig?.radius_meters ?? 100}m`}
              </p>
            </div>
          </div>

          <button
            onClick={handleSetCurrentAsCampus}
            disabled={settingLocation}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition border border-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Sets your current GPS coordinates as the campus center point"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            {settingLocation ? "Setting..." : "Set Current Location as Campus"}
          </button>
        </div>

        {/* Auto-Detect Mode Toggle Banner */}
        <div className="p-3.5 rounded-2xl bg-linear-to-r from-blue-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${autoDetect ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-slate-400"}`}>
              {autoDetect ? <Zap className="w-5 h-5 animate-pulse" /> : <ZapOff className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Auto-Face Detection:</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  autoDetect ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40" : "bg-white/20 text-slate-300"
                }`}>
                  {autoDetect ? "ACTIVE (Hands-Free)" : "PAUSED"}
                </span>
              </div>
              <p className="text-[11px] text-blue-200 mt-0.5">
                {autoDetect
                  ? "Continuous live scanning: Marks attendance automatically when student is seen."
                  : "Auto-scan paused. Click 'Capture Now' to mark attendance manually."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAutoDetect(!autoDetect)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              autoDetect 
                ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-500/40" 
                : "bg-white/20 hover:bg-white/30 text-white"
            }`}
          >
            {autoDetect ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
            <span>{autoDetect ? "Auto-Detect ON" : "Turn Auto-Detect ON"}</span>
          </button>
        </div>
      </div>

      {/* Camera In Use / Error Notification */}
      {cameraError && (
        <div className="max-w-xl mx-auto p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h2 className="text-sm font-bold">Webcam Notice</h2>
            <p className="text-xs text-amber-800 leading-relaxed">{cameraError}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
              {typeof window !== "undefined" && (API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1")) && (
                <button
                  type="button"
                  onClick={triggerOpenCVCamera}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Use OpenCV Camera
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Target Roll Number Filter (Optional) */}
      <div className="max-w-md mx-auto bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <User className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={rollFilter}
          onChange={(e) => setRollFilter(e.target.value)}
          placeholder="Filter by Roll (Optional: matches all registered if blank)"
          className="w-full text-xs sm:text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
        />
        {rollFilter && (
          <button onClick={() => setRollFilter("")} className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1.5">
            ✕
          </button>
        )}
      </div>

      {/* Live Camera Viewport */}
      <div className="relative max-w-xl mx-auto bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800">
        <div className="relative aspect-4/3 w-full bg-slate-900 flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] ${streamActive ? "block" : "hidden"}`}
          />

          {!streamActive && (
            <div className="text-center p-6 space-y-3">
              <Camera className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 font-medium">Camera is currently paused or inactive</p>
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                Start Camera
              </button>
            </div>
          )}

          {/* Continuous Auto-Scanner Laser Beam */}
          {streamActive && autoDetect && cooldown === 0 && (
            <div className="absolute inset-x-8 h-1 bg-linear-to-r from-transparent via-cyan-400 to-transparent scan-beam pointer-events-none z-10 shadow-[0_0_12px_#38bdf8]" />
          )}

          {/* Centered Biometric Face Alignment Reticle */}
          {streamActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
              <div className={`relative w-64 sm:w-72 h-80 rounded-3xl flex flex-col justify-between p-3.5 transition-all duration-300 ${
                cooldown > 0
                  ? "border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(52,211,153,0.3)]"
                  : faceDetected
                  ? "border-2 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] radar-scan"
                  : "border-2 border-dashed border-slate-400/70 radar-scan"
              }`}>
                {/* Corner markers */}
                <span className={`absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 rounded-tl-sm ${faceDetected ? "border-cyan-400" : "border-slate-300"}`}></span>
                <span className={`absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 rounded-tr-sm ${faceDetected ? "border-cyan-400" : "border-slate-300"}`}></span>
                <span className={`absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 rounded-bl-sm ${faceDetected ? "border-cyan-400" : "border-slate-300"}`}></span>
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 rounded-br-sm ${faceDetected ? "border-cyan-400" : "border-slate-300"}`}></span>

                {/* Top Badge on Reticle */}
                <span className={`text-[10px] text-center font-bold tracking-wider uppercase px-3 py-1 rounded-full mx-auto backdrop-blur-md transition-colors ${
                  cooldown > 0
                    ? "bg-emerald-600 text-white"
                    : faceDetected
                    ? "bg-cyan-500 text-slate-950 font-black animate-pulse"
                    : "bg-black/60 text-slate-200"
                }`}>
                  {cooldown > 0
                    ? "✓ Attendance Recorded"
                    : faceDetected
                    ? "Human Face Detected • Identifying..."
                    : "Center Face in Reticle"}
                </span>

                {/* Bottom Status on Reticle */}
                <span className="text-[10px] text-center font-semibold text-slate-200 bg-black/60 px-3 py-1 rounded-full mx-auto backdrop-blur-md">
                  {cooldown > 0
                    ? `Next student in: ${cooldown}s`
                    : scanStatus}
                </span>
              </div>
            </div>
          )}

          {/* Cooldown Active Floating Banner */}
          {cooldown > 0 && (
            <div className="absolute top-4 inset-x-4 bg-emerald-600/90 backdrop-blur-md text-white p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-fadeIn z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">
                    Attendance Automatically Marked!
                  </span>
                  <span className="text-[11px] text-emerald-100">
                    Next student in line can step in ({cooldown}s)
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white flex items-center justify-center font-bold text-xs">
                {cooldown}
              </div>
            </div>
          )}

          {/* Manual Loading Spinner (when triggered manually) */}
          {loading && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-3 z-30">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-400 animate-pulse" />
                  DeepFace AI Matching
                </h2>
                <p className="text-xs text-slate-400 max-w-xs">{statusMessage}</p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Canvas for Frame Grab */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Controls Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {typeof window !== "undefined" && (API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1")) && (
              <button
                onClick={triggerOpenCVCamera}
                disabled={loading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                title="Capture from desktop OpenCV camera"
              >
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                OpenCV Cam
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            {streamActive ? (
              <button
                onClick={() => performScan(true)}
                disabled={loading}
                className="px-5 py-2.5 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Capture Manually
              </button>
            ) : (
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                <RotateCw className="w-4 h-4" />
                Restart Camera
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Verification Result Card */}
      {result && (
        <div className="max-w-xl mx-auto animate-scaleUp">
          {result.matched ? (
            <div className={`p-5 rounded-2xl border shadow-md ${
              result.success 
                ? "bg-emerald-50 border-emerald-200 text-emerald-950" 
                : "bg-amber-50 border-amber-200 text-amber-950"
            }`}>
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${result.success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {result.success ? <CheckCircle2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      result.success ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800"
                    }`}>
                      {result.success ? "Auto-Verified • Present" : "Already Marked Today"}
                    </span>
                    {result.distance !== null && (
                      <span className="text-[11px] font-mono text-slate-500">
                        Match Dist: {result.distance}
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-extrabold text-slate-900">
                    {result.message}
                  </h2>

                  {result.distance_from_campus !== null && result.distance_from_campus !== undefined && (
                    <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      GPS Range: {Math.round(result.distance_from_campus)}m from campus (Within 100m geofence)
                    </p>
                  )}

                  {/* Student Details & Photo comparison */}
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-200/60">
                    {result.student?.image_base64 && (
                      <div className="relative group shrink-0">
                        <img
                          src={result.student.image_base64}
                          alt="Database Photo"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-500 shadow-xs"
                        />
                        <span className="text-[9px] bg-slate-900 text-white px-1 rounded-sm absolute -bottom-1.5 left-1/2 -translate-x-1/2 font-semibold">
                          Database
                        </span>
                      </div>
                    )}

                    {lastCapturedImage && (
                      <div className="relative group shrink-0">
                        <img
                          src={lastCapturedImage}
                          alt="Live Auto-Frame"
                          className="w-14 h-14 rounded-xl object-cover border-2 border-blue-500 shadow-xs"
                        />
                        <span className="text-[9px] bg-blue-600 text-white px-1 rounded-sm absolute -bottom-1.5 left-1/2 -translate-x-1/2 font-semibold">
                          Live Auto
                        </span>
                      </div>
                    )}

                    <div className="text-xs space-y-0.5">
                      <p><strong>Name:</strong> {result.student?.name}</p>
                      <p><strong>Roll:</strong> {result.student?.roll_number}</p>
                      <p><strong>Class:</strong> {result.student?.class_name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 shadow-md flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-rose-900">Attendance Not Marked</h2>
                <p className="text-xs text-rose-800">{result.message}</p>
                {result.geofence_passed === false && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] text-rose-700 font-semibold">
                      ⚠️ You are currently outside the allowed 100m classroom geofence.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSetCurrentAsCampus}
                        disabled={settingLocation}
                        className="text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>{settingLocation ? "Setting..." : "Set Current Location as Campus"}</span>
                      </button>
                      <Link
                        href="/settings"
                        className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition"
                      >
                        Adjust Geofence in Settings →
                      </Link>
                    </div>
                  </div>
                )}
                <div className="pt-2 flex items-center gap-3">
                  <Link href="/students/register" className="text-xs font-bold text-rose-700 underline hover:text-rose-900">
                    Register as New Student →
                  </Link>
                  <button onClick={() => performScan(true)} className="text-xs font-semibold px-2.5 py-1 bg-rose-200/70 hover:bg-rose-200 text-rose-800 rounded-md cursor-pointer">
                    Scan Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
