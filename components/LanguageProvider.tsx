"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ht" | "en" | "es";

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  ht: {
    admin: "Admin",
    back: "Retounen",
    basicInfo: "Enfo debaz",
    continue: "Kontinye",
    createAccount: "Kreye kont",
    currency: "Lajan",
    dashboard: "Tablo mwen",
    destinationCountry: "Nan ki peyi ou bezwen lajan an?",
    dueIn: "Pou peye nan",
    email: "Imel",
    fullName: "Non konplè",
    haitiMobileNumber: "Nimewo MonCash/NatCash",
    haitiAccountName: "Non sou kont lan",
    haitiPhoneHelp: "MonCash dwe se Digicel. NatCash dwe se Natcom.",
    idPhoto: "Foto pyès idantite",
    interest: "Enterè",
    language: "Lang",
    loanAmount: "Kantite lajan",
    loanInfo: "Enfo prè",
    login: "Konekte",
    mexicoAccountName: "Non sou kont lan",
    mexicoBankName: "Non bank lan",
    mexicoClabe: "CLABE",
    myLoans: "Prè mwen yo",
    password: "Modpas",
    payoutInfo: "Enfo pou resevwa lajan",
    payoutMethod: "Kijan ou vle resevwa lajan an?",
    phoneNumber: "Nimewo telefòn",
    repaymentPeriod: "Peryòd ranbousman",
    requestLoan: "Mande prè",
    requestSummary: "Rezime demann lan",
    selfie: "Selfie",
    selfieWithId: "Selfie ak pyès idantite",
    submitRequest: "Voye demann",
    submitting: "Ap voye...",
    totalPayback: "Total pou peye",
    track: "Swiv",
    usaReceiver: "Imel, telefòn, oswa $Cashtag",
    verification: "Verifikasyon"
  },
  en: {
    admin: "Admin",
    back: "Back",
    basicInfo: "Basic info",
    continue: "Continue",
    createAccount: "Create account",
    currency: "Currency",
    dashboard: "Dashboard",
    destinationCountry: "Which country do you need the money in?",
    dueIn: "Due in",
    email: "Email",
    fullName: "Full name",
    haitiMobileNumber: "MonCash/NatCash phone number",
    haitiAccountName: "Name on account",
    haitiPhoneHelp: "MonCash must be a Digicel number. NatCash must be a Natcom number.",
    idPhoto: "ID photo",
    interest: "Interest",
    language: "Language",
    loanAmount: "Loan amount",
    loanInfo: "Loan info",
    login: "Log in",
    mexicoAccountName: "Account name",
    mexicoBankName: "Bank name",
    mexicoClabe: "CLABE",
    myLoans: "My loans",
    password: "Password",
    payoutInfo: "Receiving information",
    payoutMethod: "How do you want to receive the money?",
    phoneNumber: "Phone number",
    repaymentPeriod: "Repayment period",
    requestLoan: "Request loan",
    requestSummary: "Request summary",
    selfie: "Selfie",
    selfieWithId: "Selfie with ID",
    submitRequest: "Submit request",
    submitting: "Submitting...",
    totalPayback: "Total payback",
    track: "Track",
    usaReceiver: "Email, phone, or $Cashtag",
    verification: "Verification"
  },
  es: {
    admin: "Admin",
    back: "Atrás",
    basicInfo: "Información básica",
    continue: "Continuar",
    createAccount: "Crear cuenta",
    currency: "Moneda",
    dashboard: "Panel",
    destinationCountry: "¿En qué país necesitas el dinero?",
    dueIn: "Vence en",
    email: "Correo",
    fullName: "Nombre completo",
    haitiMobileNumber: "Número MonCash/NatCash",
    haitiAccountName: "Nombre de la cuenta",
    haitiPhoneHelp: "MonCash debe ser Digicel. NatCash debe ser Natcom.",
    idPhoto: "Foto de identificación",
    interest: "Interés",
    language: "Idioma",
    loanAmount: "Monto del préstamo",
    loanInfo: "Información del préstamo",
    login: "Iniciar sesión",
    mexicoAccountName: "Nombre de la cuenta",
    mexicoBankName: "Nombre del banco",
    mexicoClabe: "CLABE",
    myLoans: "Mis préstamos",
    password: "Contraseña",
    payoutInfo: "Información para recibir",
    payoutMethod: "¿Cómo quieres recibir el dinero?",
    phoneNumber: "Teléfono",
    repaymentPeriod: "Plazo de pago",
    requestLoan: "Solicitar préstamo",
    requestSummary: "Resumen de solicitud",
    selfie: "Selfie",
    selfieWithId: "Selfie con identificación",
    submitRequest: "Enviar solicitud",
    submitting: "Enviando...",
    totalPayback: "Total a pagar",
    track: "Rastrear",
    usaReceiver: "Correo, teléfono o $Cashtag",
    verification: "Verificación"
  }
};

const languageLabels: Record<Language, string> = {
  ht: "Kreyol",
  en: "English",
  es: "Español"
};

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}>({
  language: "ht",
  setLanguage: () => undefined,
  t: (key) => key
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ht");

  useEffect(() => {
    const saved = window.localStorage.getItem("pretem-language") as Language | null;
    if (saved && dictionaries[saved]) setLanguageState(saved);
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage: (nextLanguage: Language) => {
        setLanguageState(nextLanguage);
        window.localStorage.setItem("pretem-language", nextLanguage);
      },
      t: (key: string) => dictionaries[language][key] ?? key
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="language-select">
      <span>{t("language")}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {Object.entries(languageLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
