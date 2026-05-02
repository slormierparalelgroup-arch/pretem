"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type PasswordFieldProps = {
  minLength?: number;
  onChange: (value: string) => void;
  value: string;
};

export function PasswordField({ minLength, onChange, value }: PasswordFieldProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {t("password")}
      <div className="password-control">
        <input
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          required
        />
        <button
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          className="icon-button"
          onClick={() => setVisible((nextVisible) => !nextVisible)}
          type="button"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
