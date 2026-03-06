import type { Property } from "./types";

export const BLACKLISTED_TITLE_SUBSTRINGS = [
  "ZLATÁ a VIP",
  "Správa sítí: Facebooku & Instagramu – kompletně",
] as const;

const BLACKLISTED_TITLE_SUBSTRINGS_LOWER = BLACKLISTED_TITLE_SUBSTRINGS.map(
  (titlePart) => titlePart.toLocaleLowerCase("cs-CZ")
);

export function isBlacklistedPropertyTitle(title: string): boolean {
  const normalizedTitle = title.toLocaleLowerCase("cs-CZ");
  return BLACKLISTED_TITLE_SUBSTRINGS_LOWER.some((blacklistedTitlePart) =>
    normalizedTitle.includes(blacklistedTitlePart)
  );
}

export function filterPropertiesByTitleBlacklist(properties: Property[]): {
  filteredProperties: Property[];
  filteredOutCount: number;
} {
  const filteredProperties = properties.filter(
    (property) => !isBlacklistedPropertyTitle(property.title)
  );

  return {
    filteredProperties,
    filteredOutCount: properties.length - filteredProperties.length,
  };
}
