import { DestinationCountry } from "@/lib/payout";

type Translate = (key: string) => string;

type RepaymentInstruction = {
  label: string;
  value: string;
};

function envValue(key: string) {
  return process.env[key]?.trim() || "";
}

function normalizeCountry(country: string | null | undefined): DestinationCountry {
  const normalized = country?.toLowerCase();
  if (normalized === "usa" || normalized === "mexico") return normalized;
  return "haiti";
}

export function getRepaymentInstructions(country: string | null | undefined, t: Translate): RepaymentInstruction[] {
  const destination = normalizeCountry(country);

  if (destination === "usa") {
    return [
      { label: t("methodZelle"), value: envValue("NEXT_PUBLIC_REPAY_USA_ZELLE") },
      { label: t("methodCashapp"), value: envValue("NEXT_PUBLIC_REPAY_USA_CASHAPP") },
      { label: t("bankName"), value: envValue("NEXT_PUBLIC_REPAY_USA_BANK_NAME") },
      { label: t("bankAccountName"), value: envValue("NEXT_PUBLIC_REPAY_USA_BANK_ACCOUNT_NAME") },
      { label: t("bankAccountNumber"), value: envValue("NEXT_PUBLIC_REPAY_USA_BANK_ACCOUNT_NUMBER") }
    ];
  }

  if (destination === "mexico") {
    return [
      { label: t("mexicoBankName"), value: envValue("NEXT_PUBLIC_REPAY_MEXICO_BANK_NAME") },
      { label: t("mexicoAccountName"), value: envValue("NEXT_PUBLIC_REPAY_MEXICO_ACCOUNT_NAME") },
      { label: t("mexicoClabe"), value: envValue("NEXT_PUBLIC_REPAY_MEXICO_CLABE") }
    ];
  }

  return [
    { label: `${t("methodMoncash")} - ${t("haitiAccountName")}`, value: envValue("NEXT_PUBLIC_REPAY_HAITI_MONCASH_NAME") },
    { label: `${t("methodMoncash")} - ${t("phoneNumber")}`, value: envValue("NEXT_PUBLIC_REPAY_HAITI_MONCASH_PHONE") },
    { label: `${t("methodNatcash")} - ${t("haitiAccountName")}`, value: envValue("NEXT_PUBLIC_REPAY_HAITI_NATCASH_NAME") },
    { label: `${t("methodNatcash")} - ${t("phoneNumber")}`, value: envValue("NEXT_PUBLIC_REPAY_HAITI_NATCASH_PHONE") }
  ];
}
