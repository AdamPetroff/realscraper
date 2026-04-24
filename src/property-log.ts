import { DEFAULT_MORTGAGE_ESTIMATE_CONFIG } from "./config";
import { formatMonthlyMortgageEstimate } from "./mortgage-estimate";
import type { Property } from "./types";

type PropertyDetailMode = "default" | "short" | "long";

interface PropertyLogOptions {
  header?: string;
  detail?: PropertyDetailMode;
  imageLimit?: number;
  descriptionLimit?: number;
}

export function logPropertySummary(
  property: Property,
  index: number,
  options: PropertyLogOptions = {},
): void {
  const detail = options.detail ?? "default";
  const imageLimit = options.imageLimit ?? (detail === "long" ? 5 : 1);
  const descriptionLimit =
    options.descriptionLimit ??
    (detail === "short" ? 100 : detail === "default" ? 150 : undefined);

  console.log(`\n=== ${options.header ?? "Property"} ${index + 1} ===`);
  console.log(`Title: ${property.title || "N/A"}`);
  console.log(`Price: ${property.price || "N/A"}`);
  console.log(`Location: ${property.location || "N/A"}`);
  console.log(`District (Okres): ${property.district || "N/A"}`);
  console.log(`Region (Kraj): ${property.region || "N/A"}`);
  console.log(`Area: ${property.area || "N/A"}`);
  console.log(`Price per m²: ${formatPricePerSqm(property.pricePerSqm)}`);
  console.log(
    `Mortgage estimate: ${formatMortgageEstimate(property) ?? "N/A"}`,
  );
  console.log(`Rooms: ${property.rooms || "N/A"}`);
  console.log(`URL: ${property.url || "N/A"}`);

  if (typeof property.isNew === "boolean") {
    console.log(`Is New: ${property.isNew ? "Yes" : "No"}`);
  }

  if (property.description) {
    console.log(`Description: ${truncate(property.description, descriptionLimit)}`);
  }

  if (property.images?.length) {
    if (detail === "default") {
      console.log(`Images: ${property.images.length}`);
      console.log(`Image 1: ${property.images[0] || "N/A"}`);
      return;
    }

    console.log(`Images (${property.images.length}):`);
    property.images.slice(0, imageLimit).forEach((image, imageIndex) => {
      console.log(`  ${imageIndex + 1}. ${image}`);
    });

    if (property.images.length > imageLimit) {
      console.log(`  ...and ${property.images.length - imageLimit} more`);
    }
  }
}

function formatPricePerSqm(pricePerSqm?: number): string {
  if (typeof pricePerSqm !== "number") {
    return "N/A";
  }

  return `${new Intl.NumberFormat("cs-CZ").format(pricePerSqm)} Kč/m²`;
}

function formatMortgageEstimate(property: Property): string | undefined {
  return formatMonthlyMortgageEstimate(
    property,
    DEFAULT_MORTGAGE_ESTIMATE_CONFIG,
  );
}

function truncate(value: string, maxLength?: number): string {
  if (!maxLength || value.length <= maxLength) {
    return value;
  }

  return `${value.substring(0, maxLength)}...`;
}
