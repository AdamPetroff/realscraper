## ADDED Requirements

### Requirement: Property Source Identification
The system SHALL identify each scraped property with a `source` (scraper type) and `sourceId` (unique identifier from the source website).

#### Scenario: Sreality property identification
- **WHEN** a property is scraped from Sreality
- **THEN** the `source` is set to "sreality"
- **AND** the `sourceId` is extracted from the `estate.id` field

#### Scenario: Bezrealitky property identification
- **WHEN** a property is scraped from Bezrealitky
- **THEN** the `source` is set to "bezrealitky"
- **AND** the `sourceId` is extracted from the `uri` field

#### Scenario: Idnes property identification
- **WHEN** a property is scraped from Idnes
- **THEN** the `source` is set to "idnes"
- **AND** the `sourceId` is extracted from the property URL path

#### Scenario: Bazos property identification
- **WHEN** a property is scraped from Bazos
- **THEN** the `source` is set to "bazos"
- **AND** the `sourceId` is extracted from the property URL path

---

### Requirement: Numeric Price Extraction
The system SHALL extract numeric price values from formatted price strings for comparison purposes.

#### Scenario: Standard Czech price format
- **WHEN** a price is formatted as "3 500 000 Kč" or "3 500 000 CZK"
- **THEN** the numeric value 3500000 is extracted

#### Scenario: Price with charges
- **WHEN** a price includes charges like "15 000 CZK + 3 000 CZK"
- **THEN** the base numeric value 15000 is extracted (charges excluded from comparison)

#### Scenario: Non-standard price format
- **WHEN** a price cannot be parsed (e.g., "Na vyžádání", "Zdarma")
- **THEN** the numeric value is set to null
- **AND** price comparison is skipped for this property

---

### Requirement: Extended Property Type
The `Property` interface SHALL include `source`, `sourceId`, and `priceNumeric` fields.

#### Scenario: Property with all identification fields
- **WHEN** a scraper returns a property
- **THEN** the property object includes `source` (scraper type string)
- **AND** the property object includes `sourceId` (string from source site)
- **AND** the property object includes `priceNumeric` (number or undefined)

---

### Requirement: Price Change Information
The system SHALL provide price change details when returning properties with changed prices.

#### Scenario: Property with price decrease
- **WHEN** a property's price has decreased
- **THEN** the result includes `previousPrice` (old formatted price)
- **AND** the result includes `previousPriceNumeric` (old numeric price)
- **AND** the result includes `priceChangePercent` (negative percentage)

#### Scenario: Property with price increase
- **WHEN** a property's price has increased
- **THEN** the result includes `previousPrice` (old formatted price)
- **AND** the result includes `previousPriceNumeric` (old numeric price)
- **AND** the result includes `priceChangePercent` (positive percentage)
