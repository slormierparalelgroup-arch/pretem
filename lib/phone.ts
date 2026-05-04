export type ProfileCountry = "haiti" | "usa" | "mexico";

const countryCodes: Record<ProfileCountry, string> = {
  haiti: "+509",
  usa: "+1",
  mexico: "+52"
};

export function getCountryCode(country: string) {
  return countryCodes[(country as ProfileCountry) || "haiti"] || countryCodes.haiti;
}

export function normalizePhoneForCountry(country: string, phone: string) {
  const digits = phone.replace(/\D/g, "");

  if (country === "haiti") {
    return digits.startsWith("509") ? `+${digits}` : `+509${digits}`;
  }

  if (country === "usa") {
    return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
  }

  if (country === "mexico") {
    return digits.startsWith("52") ? `+${digits}` : `+52${digits}`;
  }

  return phone.trim();
}
