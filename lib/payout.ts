export type DestinationCountry = "haiti" | "usa" | "mexico";
export type PayoutMethod = "moncash" | "natcash" | "zelle" | "cashapp" | "mexico_bank";

export const countryOptions = [
  {
    value: "haiti",
    label: "Haiti",
    labelKey: "countryHaiti",
    currency: "HTG",
    methods: [
      { value: "moncash", label: "MonCash", labelKey: "methodMoncash" },
      { value: "natcash", label: "NatCash", labelKey: "methodNatcash" }
    ]
  },
  {
    value: "usa",
    label: "USA",
    labelKey: "countryUsa",
    currency: "USD",
    methods: [
      { value: "zelle", label: "Zelle", labelKey: "methodZelle" },
      { value: "cashapp", label: "Cash App", labelKey: "methodCashapp" }
    ]
  },
  {
    value: "mexico",
    label: "Mexico",
    labelKey: "countryMexico",
    currency: "MXN",
    methods: [{ value: "mexico_bank", label: "Bank transfer", labelKey: "methodBankTransfer" }]
  }
] as const satisfies ReadonlyArray<{
  value: DestinationCountry;
  label: string;
  labelKey: string;
  currency: string;
  methods: ReadonlyArray<{ value: PayoutMethod; label: string; labelKey: string }>;
}>;

export function getCountryOption(country: DestinationCountry) {
  return countryOptions.find((option) => option.value === country) ?? countryOptions[0];
}

type Translate = (key: string) => string;

export function getPayoutMethodLabel(method: string | null | undefined, t?: Translate) {
  for (const country of countryOptions) {
    const option = country.methods.find((item) => item.value === method);
    if (option) return t ? t(option.labelKey) : option.label;
  }

  return t ? t("notProvided") : "Not provided";
}

export function getDestinationLabel(country: string | null | undefined, t?: Translate) {
  const normalized = country?.toLowerCase();
  const option = countryOptions.find((item) => item.value === normalized || item.label.toLowerCase() === normalized);
  if (option) return t ? t(option.labelKey) : option.label;
  return country || (t ? t("destinationFallback") : "Destination");
}

export function formatPayoutDetails(details: unknown, t?: Translate) {
  if (!details || typeof details !== "object") return t ? t("noReceivingDetails") : "No receiving details";

  const payout = details as Record<string, string | undefined>;

  if (payout.mobile_number) {
    return [payout.account_name, payout.mobile_number].filter(Boolean).join(" · ");
  }
  if (payout.receiver) return `${t ? t("receiverLabel") : "Receiver"}: ${payout.receiver}`;

  return [payout.bank_name, payout.account_name, payout.clabe].filter(Boolean).join(" · ") || (t ? t("noReceivingDetails") : "No receiving details");
}

export function normalizeHaitiPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("509") ? digits.slice(3) : digits;
}

export function getHaitiCarrierFromPrefix(value: string) {
  const phone = normalizeHaitiPhone(value);
  const prefix = phone.slice(0, 2);

  if (["30", "31", "36", "37", "38", "46", "47"].includes(prefix)) return "digicel";
  if (["32", "33", "40", "41", "42", "43"].includes(prefix)) return "natcom";

  return "unknown";
}

export function validateHaitiPayoutPhone(method: PayoutMethod, value: string, t?: Translate) {
  const phone = normalizeHaitiPhone(value);

  if (phone.length !== 8) {
    return t ? t("haitiPhoneLengthError") : "Use an 8-digit Haiti phone number, with or without +509.";
  }

  const carrier = getHaitiCarrierFromPrefix(phone);

  if (method === "moncash" && carrier !== "digicel") {
    return t ? t("moncashDigicelError") : "MonCash requires a Digicel number.";
  }

  if (method === "natcash" && carrier !== "natcom") {
    return t ? t("natcashNatcomError") : "NatCash requires a Natcom number.";
  }

  return "";
}
