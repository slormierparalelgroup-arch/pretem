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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: name === "selfie" ? "user" : "environment" },
        audio: false
      });

      streamRef.current = stream;
      setCameraOpen(true);

      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
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

  useEffect(() => closeCamera, []);

  return (
    <div className="capture-field">
      <label>
        {label}
        <input accept="image/*" capture="environment" type="file" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} required={!file} />
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
