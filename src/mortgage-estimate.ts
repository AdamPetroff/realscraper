import { DEFAULT_MORTGAGE_ESTIMATE_CONFIG, type MortgageEstimateConfig } from "./config";
import type { Property } from "./types";

const AUCTION_SOURCES = new Set<Property["source"]>(["okdrazby", "exdrazby"]);
const numberFormatter = new Intl.NumberFormat("cs-CZ");

export function canEstimateMortgage(property: Pick<Property, "priceNumeric" | "source">): boolean {
  return (
    typeof property.priceNumeric === "number" &&
    Number.isFinite(property.priceNumeric) &&
    property.priceNumeric > 0 &&
    !AUCTION_SOURCES.has(property.source)
  );
}

export function calculateMonthlyMortgagePayment(
  propertyPrice: number,
  config: MortgageEstimateConfig = DEFAULT_MORTGAGE_ESTIMATE_CONFIG
): number | undefined {
  if (
    !Number.isFinite(propertyPrice) ||
    propertyPrice <= 0 ||
    !Number.isFinite(config.annualInterestRatePercent) ||
    config.annualInterestRatePercent <= 0 ||
    !Number.isFinite(config.financedShare) ||
    config.financedShare <= 0 ||
    config.financedShare > 1 ||
    !Number.isFinite(config.loanTermYears) ||
    config.loanTermYears <= 0
  ) {
    return undefined;
  }

  const principal = propertyPrice * config.financedShare;
  const monthlyRate = config.annualInterestRatePercent / 100 / 12;
  const paymentCount = config.loanTermYears * 12;
  const compoundedRate = Math.pow(1 + monthlyRate, paymentCount);

  if (!Number.isFinite(compoundedRate) || compoundedRate <= 1) {
    return undefined;
  }

  return (
    (principal * monthlyRate * compoundedRate) /
    (compoundedRate - 1)
  );
}

export function formatMonthlyMortgageEstimate(
  property: Pick<Property, "priceNumeric" | "source">,
  config: MortgageEstimateConfig = DEFAULT_MORTGAGE_ESTIMATE_CONFIG
): string | undefined {
  if (!canEstimateMortgage(property) || typeof property.priceNumeric !== "number") {
    return undefined;
  }

  const propertyPrice = property.priceNumeric;
  const monthlyPayment = calculateMonthlyMortgagePayment(propertyPrice, config);

  if (!monthlyPayment) {
    return undefined;
  }

  return `${numberFormatter.format(Math.round(monthlyPayment))} Kč/měs.`;
}
