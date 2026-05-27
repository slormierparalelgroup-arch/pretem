"use client";

import { useEffect, useRef, useState } from "react";
import { createVerificationImageFromVideo, prepareVerificationImage } from "@/lib/image-files";

type CameraCaptureFieldProps = {
  file: File | null;
  label: string;
  name: string;
  onChange: (file: File | null) => void;
  t: (key: string) => string;
};

export function CameraCaptureField({ file, label, name, onChange, t }: CameraCaptureFieldProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [preparing, setPreparing] = useState(false);

  async function openCamera() {
    setCameraError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t("cameraAccessError"));
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: name === "selfie" ? "user" : "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError(t("cameraAccessError"));
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    setPreparing(true);
    const nextFile = await createVerificationImageFromVideo(video, name);
    if (nextFile) onChange(nextFile);
    setPreparing(false);
    closeCamera();
  }

  async function selectFile(file: File | null) {
    if (!file) {
      onChange(null);
      return;
    }

    setPreparing(true);
    const nextFile = await prepareVerificationImage(file, name);
    onChange(nextFile);
    setPreparing(false);
  }

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => setCameraError(t("cameraAccessError")));
    }
  }, [cameraOpen, t]);

  useEffect(() => closeCamera, []);

  return (
    <div className="capture-field">
      <label>
        {label}
        <input accept="image/*" type="file" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} required={!file} />
      </label>

      <div className="actions">
        <button className="secondary" onClick={cameraOpen ? closeCamera : openCamera} type="button">
          {cameraOpen ? t("closeCamera") : t("openCamera")}
        </button>
      </div>

      {file ? (
        <p className="notice">
          {t("selectedFile")}: {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
        </p>
      ) : null}
      {preparing ? <p className="notice">{t("preparingPhoto")}</p> : null}
      {cameraError ? <p className="notice">{cameraError}</p> : null}

      {cameraOpen ? (
        <div className="camera-panel">
          <video aria-label={t("cameraPreview")} autoPlay muted playsInline ref={videoRef} />
          <button disabled={preparing} type="button" onClick={capturePhoto}>
            {t("capturePhoto")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
