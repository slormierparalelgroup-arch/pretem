"use client";

import { useEffect, useRef, useState } from "react";

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

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onChange(new File([blob], `${name}.jpg`, { type: "image/jpeg" }));
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  useEffect(() => closeCamera, []);

  return (
    <div className="capture-field">
      <label>
        {label}
        <input accept="image/*" capture="environment" type="file" onChange={(event) => onChange(event.target.files?.[0] ?? null)} required={!file} />
      </label>

      <div className="actions">
        <button className="secondary" onClick={cameraOpen ? closeCamera : openCamera} type="button">
          {cameraOpen ? t("closeCamera") : t("openCamera")}
        </button>
      </div>

      {file ? (
        <p className="notice">
          {t("selectedFile")}: {file.name}
        </p>
      ) : null}
      {cameraError ? <p className="notice">{cameraError}</p> : null}

      {cameraOpen ? (
        <div className="camera-panel">
          <video aria-label={t("cameraPreview")} autoPlay muted playsInline ref={videoRef} />
          <button type="button" onClick={capturePhoto}>
            {t("capturePhoto")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
