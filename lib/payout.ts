export type DestinationCountry = "haiti" | "usa" | "mexico";
export type PayoutMethod = "moncash" | "natcash" | "zelle" | "cashapp" | "mexico_bank";

export const countryOptions = [
  {
    value: "haiti",
    label: "Haiti",
    currency: "HTG",
    methods: [
      { value: "moncash", label: "MonCash" },
      { value: "natcash", label: "NatCash" }
    ]
  },
  {
    value: "usa",
    label: "USA",
    currency: "USD",
    methods: [
      { value: "zelle", label: "Zelle" },
      { value: "cashapp", label: "Cash App" }
    ]
  },
  {
    value: "mexico",
    label: "Mexico",
    currency: "MXN",
    methods: [{ value: "mexico_bank", label: "Bank transfer" }]
  }
] as const satisfies ReadonlyArray<{
  value: DestinationCountry;
  label: string;
  currency: string;
  methods: ReadonlyArray<{ value: PayoutMethod; label: string }>;
}>;

export function getCountryOption(country: DestinationCountry) {
  return countryOptions.find((option) => option.value === country) ?? countryOptions[0];
}

export function getPayoutMethodLabel(method: string | null | undefined) {
  for (const country of countryOptions) {
    const option = country.methods.find((item) => item.value === method);
    if (option) return option.label;
  }

  return "Not provided";
}

export function formatPayoutDetails(details: unknown) {
  if (!details || typeof details !== "object") return "No receiving details";

  const payout = details as Record<string, string | undefined>;

  if (payout.mobile_number) {
    return [payout.account_name, payout.mobile_number].filter(Boolean).join(" · ");
  }
  if (payout.receiver) return `Receiver: ${payout.receiver}`;

  return [payout.bank_name, payout.account_name, payout.clabe].filter(Boolean).join(" · ") || "No receiving details";
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

export function validateHaitiPayoutPhone(method: PayoutMethod, value: string) {
  const phone = normalizeHaitiPhone(value);

  if (phone.length !== 8) {
    return "Use an 8-digit Haiti phone number, with or without +509.";
  }

  const carrier = getHaitiCarrierFromPrefix(phone);

  if (method === "moncash" && carrier !== "digicel") {
    return "MonCash requires a Digicel number.";
  }

  if (method === "natcash" && carrier !== "natcom") {
    return "NatCash requires a Natcom number.";
  }

  return "";
}
