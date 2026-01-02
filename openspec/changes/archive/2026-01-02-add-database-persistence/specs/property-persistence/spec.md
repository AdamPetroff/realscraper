## ADDED Requirements

### Requirement: Supabase Connection
The system SHALL connect to Supabase using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables.

#### Scenario: Successful Supabase connection
- **WHEN** the application starts with valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- **THEN** a Supabase client is initialized
- **AND** the system logs successful connection

#### Scenario: Missing Supabase credentials
- **WHEN** the application starts without `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` set
- **THEN** the system logs a warning
- **AND** continues operation without database persistence (fallback to notify-all behavior)

#### Scenario: Supabase connection failure
- **WHEN** the Supabase service is unreachable
- **THEN** the system logs an error
- **AND** continues operation without database persistence

---

### Requirement: Property Storage
The system SHALL store scraped properties in a `properties` table with source identification and price tracking.

#### Scenario: Store new property
- **WHEN** a scraped property has not been seen before (no matching source + sourceId)
- **THEN** the property is inserted into the `properties` table
- **AND** `first_seen_at` and `last_seen_at` are set to current timestamp

#### Scenario: Update existing property timestamp
- **WHEN** a scraped property matches an existing record (same source + sourceId)
- **THEN** the `last_seen_at` timestamp is updated
- **AND** the `updated_at` timestamp is updated

---

### Requirement: Price History Tracking
The system SHALL record price changes in a `price_history` table when a property's price differs from the stored value.

#### Scenario: Price decrease detected
- **WHEN** a property's scraped price is lower than the stored price
- **THEN** a new record is added to `price_history` with the new price
- **AND** the property record's price is updated

#### Scenario: Price increase detected
- **WHEN** a property's scraped price is higher than the stored price
- **THEN** a new record is added to `price_history` with the new price
- **AND** the property record's price is updated

#### Scenario: Price unchanged
- **WHEN** a property's scraped price equals the stored price
- **THEN** no price history record is created
- **AND** only `last_seen_at` is updated

---

### Requirement: Property Deduplication
The system SHALL skip Telegram notifications for properties that already exist in the database with unchanged prices.

#### Scenario: New property notification
- **WHEN** a property is scraped that does not exist in the database
- **THEN** the property is sent to Telegram as a new listing

#### Scenario: Skip unchanged property
- **WHEN** a property exists in the database with the same price
- **THEN** the property is NOT sent to Telegram
- **AND** only the `last_seen_at` timestamp is updated

#### Scenario: Price change notification
- **WHEN** a property exists in the database but the price has changed
- **THEN** the property is sent to Telegram with price change information
- **AND** the notification includes old price, new price, and percentage change

---

### Requirement: Database Migration Management
The system SHALL use Supabase migrations to manage database schema.

#### Scenario: Create properties table
- **WHEN** the migration runs
- **THEN** a `properties` table is created with columns: id, source, source_id, title, location, area, rooms, url, price_formatted, price_numeric, first_seen_at, last_seen_at, created_at, updated_at
- **AND** a unique constraint exists on (source, source_id)

#### Scenario: Create price_history table
- **WHEN** the migration runs
- **THEN** a `price_history` table is created with columns: id, property_id, price_formatted, price_numeric, recorded_at
- **AND** property_id references the properties table with CASCADE delete
