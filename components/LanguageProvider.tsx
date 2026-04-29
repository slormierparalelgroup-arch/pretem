"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "ht" | "en" | "es";

type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  ht: {
    admin: "Admin",
    adminDashboard: "Tablo admin",
    adminLogin: "Koneksyon admin",
    adminReviewBody: "Admin yo ka apwouve, refize, epi swiv istwa prè yo.",
    adminReviewTitle: "Revizyon admin",
    approve: "Apwouve",
    back: "Retounen",
    basicInfo: "Enfo debaz",
    checkStatus: "Tcheke estati",
    checking: "Ap tcheke...",
    continue: "Kontinye",
    createAccount: "Kreye kont",
    currency: "Lajan",
    dashboard: "Tablo mwen",
    destinationCountry: "Nan ki peyi ou bezwen lajan an?",
    dueDate: "Dat limit",
    dueIn: "Pou peye nan",
    email: "Imel",
    filterByStatus: "Filtre pa estati",
    fullName: "Non konplè",
    haitiMobileNumber: "Nimewo MonCash/NatCash",
    haitiAccountName: "Non sou kont lan",
    haitiPhoneHelp: "MonCash dwe se Digicel. NatCash dwe se Natcom.",
    heroBody:
      "Yon platfòm mikwo-prè pratik pou imigran mande lajan, fini verifikasyon idantite, epi swiv desizyon ak yon nimewo referans klè.",
    idPhoto: "Foto pyès idantite",
    identityChecksBody: "Telechaje pyès idantite, selfie, ak selfie ak pyès idantite nan Supabase Storage.",
    identityChecksTitle: "Verifikasyon idantite",
    interest: "Enterè",
    language: "Lang",
    loadingAdminData: "Done admin yo ap chaje...",
    loadingLoanHistory: "Istwa prè yo ap chaje...",
    loadingTracker: "Zouti swivi a ap chaje...",
    loanAmount: "Kantite lajan",
    loanHistoryBody: "Gade istwa demann ou yo ak estati ranbousman yo.",
    loanInfo: "Enfo prè",
    login: "Konekte",
    markPaid: "Make kòm peye",
    mexicoAccountName: "Non sou kont lan",
    mexicoBankName: "Non bank lan",
    mexicoClabe: "CLABE",
    myLoans: "Prè mwen yo",
    password: "Modpas",
    payoutInfo: "Enfo pou resevwa lajan",
    payoutMethod: "Kijan ou vle resevwa lajan an?",
    phoneNumber: "Nimewo telefòn",
    referenceNumber: "Nimewo referans",
    reject: "Refize",
    repaymentPeriod: "Peryòd ranbousman",
    repayment: "Ranbousman",
    requested: "Kantite mande",
    reviewRequestsBody: "Revize demann yo, tcheke dokiman yo, epi jere estati ranbousman yo.",
    requestLoan: "Mande prè",
    requestSummary: "Rezime demann lan",
    requestStatusTitle: "Swiv yon demann",
    selfie: "Selfie",
    selfieWithId: "Selfie ak pyès idantite",
    simpleRequestsBody: "Voye enfòmasyon kontak, kantite lajan, ak apèsi ranbousman an.",
    simpleRequestsTitle: "Demann senp",
    signOut: "Dekonekte",
    submitRequest: "Voye demann",
    submitting: "Ap voye...",
    noLoansFound: "Pa gen prè",
    noLoansFoundBody: "Lè ou mande yon prè, li ap parèt isit la.",
    newRequest: "Nouvo demann",
    totalPayback: "Total pou peye",
    track: "Swiv",
    usaReceiver: "Imel, telefòn, oswa $Cashtag",
    verification: "Verifikasyon"
  },
  en: {
    admin: "Admin",
    adminDashboard: "Admin dashboard",
    adminLogin: "Admin login",
    adminReviewBody: "Admins can approve, reject, and track loan history.",
    adminReviewTitle: "Admin review",
    approve: "Approve",
    back: "Back",
    basicInfo: "Basic info",
    checkStatus: "Check status",
    checking: "Checking...",
    continue: "Continue",
    createAccount: "Create account",
    currency: "Currency",
    dashboard: "Dashboard",
    destinationCountry: "Which country do you need the money in?",
    dueDate: "Due date",
    dueIn: "Due in",
    email: "Email",
    filterByStatus: "Filter by status",
    fullName: "Full name",
    haitiMobileNumber: "MonCash/NatCash phone number",
    haitiAccountName: "Name on account",
    haitiPhoneHelp: "MonCash must be a Digicel number. NatCash must be a Natcom number.",
    heroBody:
      "A practical micro-loan platform for immigrants to request funds, complete identity verification, and track decisions with a clear reference number.",
    idPhoto: "ID photo",
    identityChecksBody: "Upload ID, selfie, and selfie with ID into Supabase Storage.",
    identityChecksTitle: "Identity checks",
    interest: "Interest",
    language: "Language",
    loadingAdminData: "Loading admin data...",
    loadingLoanHistory: "Loading loan history...",
    loadingTracker: "Loading tracker...",
    loanAmount: "Loan amount",
    loanHistoryBody: "View your request history and repayment status.",
    loanInfo: "Loan info",
    login: "Log in",
    markPaid: "Mark paid",
    mexicoAccountName: "Account name",
    mexicoBankName: "Bank name",
    mexicoClabe: "CLABE",
    myLoans: "My loans",
    password: "Password",
    payoutInfo: "Receiving information",
    payoutMethod: "How do you want to receive the money?",
    phoneNumber: "Phone number",
    referenceNumber: "Reference number",
    reject: "Reject",
    repaymentPeriod: "Repayment period",
    repayment: "Repayment",
    requested: "Requested",
    reviewRequestsBody: "Review requests, inspect verification uploads, and manage repayment state.",
    requestLoan: "Request loan",
    requestSummary: "Request summary",
    requestStatusTitle: "Track a request",
    selfie: "Selfie",
    selfieWithId: "Selfie with ID",
    simpleRequestsBody: "Submit basic contact details, amount, and repayment preview.",
    simpleRequestsTitle: "Simple requests",
    signOut: "Sign out",
    submitRequest: "Submit request",
    submitting: "Submitting...",
    noLoansFound: "No loans found",
    noLoansFoundBody: "Once you request a loan, it will appear here.",
    newRequest: "New request",
    totalPayback: "Total payback",
    track: "Track",
    usaReceiver: "Email, phone, or $Cashtag",
    verification: "Verification"
  },
  es: {
    admin: "Admin",
    adminDashboard: "Panel de admin",
    adminLogin: "Inicio de admin",
    adminReviewBody: "Los administradores pueden aprobar, rechazar y revisar el historial de préstamos.",
    adminReviewTitle: "Revisión admin",
    approve: "Aprobar",
    back: "Atrás",
    basicInfo: "Información básica",
    checkStatus: "Ver estado",
    checking: "Verificando...",
    continue: "Continuar",
    createAccount: "Crear cuenta",
    currency: "Moneda",
    dashboard: "Panel",
    destinationCountry: "¿En qué país necesitas el dinero?",
    dueDate: "Fecha de pago",
    dueIn: "Vence en",
    email: "Correo",
    filterByStatus: "Filtrar por estado",
    fullName: "Nombre completo",
    haitiMobileNumber: "Número MonCash/NatCash",
    haitiAccountName: "Nombre de la cuenta",
    haitiPhoneHelp: "MonCash debe ser Digicel. NatCash debe ser Natcom.",
    heroBody:
      "Una plataforma práctica de micropréstamos para inmigrantes que permite solicitar fondos, completar la verificación de identidad y seguir decisiones con un número de referencia claro.",
    idPhoto: "Foto de identificación",
    identityChecksBody: "Sube identificación, selfie y selfie con identificación a Supabase Storage.",
    identityChecksTitle: "Verificación de identidad",
    interest: "Interés",
    language: "Idioma",
    loadingAdminData: "Cargando datos de admin...",
    loadingLoanHistory: "Cargando historial de préstamos...",
    loadingTracker: "Cargando rastreador...",
    loanAmount: "Monto del préstamo",
    loanHistoryBody: "Consulta tu historial de solicitudes y estado de pago.",
    loanInfo: "Información del préstamo",
    login: "Iniciar sesión",
    markPaid: "Marcar pagado",
    mexicoAccountName: "Nombre de la cuenta",
    mexicoBankName: "Nombre del banco",
    mexicoClabe: "CLABE",
    myLoans: "Mis préstamos",
    password: "Contraseña",
    payoutInfo: "Información para recibir",
    payoutMethod: "¿Cómo quieres recibir el dinero?",
    phoneNumber: "Teléfono",
    referenceNumber: "Número de referencia",
    reject: "Rechazar",
    repaymentPeriod: "Plazo de pago",
    repayment: "Pago",
    requested: "Solicitado",
    reviewRequestsBody: "Revisa solicitudes, verifica documentos y administra el estado de pago.",
    requestLoan: "Solicitar préstamo",
    requestSummary: "Resumen de solicitud",
    requestStatusTitle: "Rastrear solicitud",
    selfie: "Selfie",
    selfieWithId: "Selfie con identificación",
    simpleRequestsBody: "Envía datos de contacto, monto y vista previa del pago.",
    simpleRequestsTitle: "Solicitudes simples",
    signOut: "Cerrar sesión",
    submitRequest: "Enviar solicitud",
    submitting: "Enviando...",
    noLoansFound: "No hay préstamos",
    noLoansFoundBody: "Cuando solicites un préstamo, aparecerá aquí.",
    newRequest: "Nueva solicitud",
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
