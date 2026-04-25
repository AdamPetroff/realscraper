<script lang="ts">
  type ScraperType =
    | "idnes"
    | "bezrealitky"
    | "sreality"
    | "bazos"
    | "okdrazby"
    | "exdrazby";

  type StoredConfig = {
    key: string;
    label: string;
    enabled: boolean;
    scrapers: ScraperType[];
    search: Record<string, any>;
    overrides: Record<string, any> | null;
    expanded: Array<{
      id: string;
      label: string;
      type: ScraperType;
      enabled: boolean;
      url: string;
    }>;
  };

  type PreviewResult = {
    id: string;
    label: string;
    type: ScraperType;
    url: string;
    returnedCount: number;
    filteredOutCount: number;
    properties: Array<{
      title: string;
      price: string;
      location: string;
      area?: string;
      rooms: string;
      source?: string;
      sourceId?: string;
      url: string;
    }>;
    error?: string;
  };

  type ImportResult = {
    mode: "all-sites" | "sreality-only";
    warnings: string[];
    draftConfig: StoredConfig;
    previewResults: PreviewResult[];
    previewAttempted: boolean;
  };

  type EditorForm = {
    key: string;
    label: string;
    enabled: boolean;
    scrapers: ScraperType[];
    offerType: "sale" | "rent";
    propertyKind: "apartment" | "land" | "house";
    priceMin: string;
    priceMax: string;
    areaMin: string;
    areaMax: string;
    pricePerSqmMin: string;
    pricePerSqmMax: string;
    roomLayouts: string;
    roomCountMin: string;
    ownership: "" | "personal";
    onlyNew: boolean;
    freshness: "" | "today" | "week" | "month";
    locationLabel: string;
    idnesCity: string;
    srealityLocationSlug: string;
    bezrealitkyOsmValue: string;
    bezrealitkyRegionOsmIds: string;
    bezrealitkyLocation: string;
    bazosLocationCode: string;
    bazosRadiusKm: string;
    okdrazbyRegionIds: string;
    okdrazbyCountyIds: string;
    exdrazbyRegionIds: string;
    overridesJson: string;
  };

  const SCRAPERS: ScraperType[] = [
    "idnes",
    "bezrealitky",
    "sreality",
    "bazos",
    "okdrazby",
    "exdrazby",
  ];

  let authChecking = true;
  let authenticated = false;
  let authConfigured = true;
  let loginPassword = "";
  let loginError = "";
  let loginLoading = false;

  let configs: StoredConfig[] = [];
  let loadingConfigs = false;
  let pageError = "";
  let saveError = "";
  let saving = false;
  let editingOriginalKey: string | null = null;
  let form = createEmptyForm();
  let importName = "";
  let importUrl = "";
  let importing = false;
  let importError = "";
  let importResult: ImportResult | null = null;
  let persistingImport = false;
  let testStates: Record<
    string,
    { loading: boolean; error: string; results: PreviewResult[] }
  > = {};

  $: enabledCount = configs.filter((config) => config.enabled).length;
  $: expandedCount = configs.reduce(
    (sum, config) => sum + config.expanded.length,
    0,
  );

  function createEmptyForm(): EditorForm {
    return {
      key: "",
      label: "",
      enabled: true,
      scrapers: [],
      offerType: "sale",
      propertyKind: "apartment",
      priceMin: "",
      priceMax: "",
      areaMin: "",
      areaMax: "",
      pricePerSqmMin: "",
      pricePerSqmMax: "",
      roomLayouts: "",
      roomCountMin: "",
      ownership: "personal",
      onlyNew: false,
      freshness: "today",
      locationLabel: "",
      idnesCity: "",
      srealityLocationSlug: "",
      bezrealitkyOsmValue: "",
      bezrealitkyRegionOsmIds: "",
      bezrealitkyLocation: "",
      bazosLocationCode: "",
      bazosRadiusKm: "",
      okdrazbyRegionIds: "",
      okdrazbyCountyIds: "",
      exdrazbyRegionIds: "",
      overridesJson: "{\n}",
    };
  }

  function formFromConfig(config: StoredConfig): EditorForm {
    const search = config.search ?? {};
    const location = search.location ?? {};

    return {
      key: config.key,
      label: config.label,
      enabled: config.enabled,
      scrapers: config.scrapers ?? [],
      offerType: search.offerType ?? "sale",
      propertyKind: search.propertyKind ?? "apartment",
      priceMin: toInputValue(search.priceMin),
      priceMax: toInputValue(search.priceMax),
      areaMin: toInputValue(search.areaMin),
      areaMax: toInputValue(search.areaMax),
      pricePerSqmMin: toInputValue(search.pricePerSqmMin),
      pricePerSqmMax: toInputValue(search.pricePerSqmMax),
      roomLayouts: Array.isArray(search.roomLayouts)
        ? search.roomLayouts.join(", ")
        : "",
      roomCountMin: toInputValue(search.roomCountMin),
      ownership: search.ownership ?? "",
      onlyNew: Boolean(search.onlyNew),
      freshness: search.freshness ?? "",
      locationLabel: location.label ?? "",
      idnesCity: location.idnesCity ?? "",
      srealityLocationSlug: location.srealityLocationSlug ?? "",
      bezrealitkyOsmValue: location.bezrealitky?.osmValue ?? "",
      bezrealitkyRegionOsmIds: location.bezrealitky?.regionOsmIds ?? "",
      bezrealitkyLocation: location.bezrealitky?.location ?? "",
      bazosLocationCode: location.bazos?.locationCode ?? "",
      bazosRadiusKm: toInputValue(location.bazos?.radiusKm),
      okdrazbyRegionIds: joinNumberList(location.okdrazby?.regionIds),
      okdrazbyCountyIds: joinNumberList(location.okdrazby?.countyIds),
      exdrazbyRegionIds: joinNumberList(location.exdrazby?.regionIds),
      overridesJson: JSON.stringify(config.overrides ?? {}, null, 2),
    };
  }

  function toInputValue(value: unknown): string {
    return typeof value === "number" ? String(value) : "";
  }

  function joinNumberList(value: unknown): string {
    return Array.isArray(value) ? value.join(", ") : "";
  }

  function parseOptionalNumber(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`"${value}" is not a valid number`);
    }
    return parsed;
  }

  function parseStringList(value: string): string[] | undefined {
    const entries = value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length > 0 ? entries : undefined;
  }

  function parseNumberList(value: string): number[] | undefined {
    const entries = parseStringList(value);
    if (!entries) return undefined;

    return entries.map((entry) => {
      const parsed = Number(entry);
      if (!Number.isInteger(parsed)) {
        throw new Error(`"${entry}" is not a valid integer`);
      }
      return parsed;
    });
  }

  function configFromForm(): Record<string, any> {
    const location: Record<string, any> = {
      label: form.locationLabel.trim(),
    };

    if (form.idnesCity.trim()) {
      location.idnesCity = form.idnesCity.trim();
    }
    if (form.srealityLocationSlug.trim()) {
      location.srealityLocationSlug = form.srealityLocationSlug.trim();
    }
    if (
      form.bezrealitkyOsmValue.trim() ||
      form.bezrealitkyRegionOsmIds.trim()
    ) {
      location.bezrealitky = {
        osmValue: form.bezrealitkyOsmValue.trim(),
        regionOsmIds: form.bezrealitkyRegionOsmIds.trim(),
        ...(form.bezrealitkyLocation.trim()
          ? { location: form.bezrealitkyLocation.trim() }
          : {}),
      };
    }
    if (form.bazosLocationCode.trim()) {
      location.bazos = {
        locationCode: form.bazosLocationCode.trim(),
        ...(parseOptionalNumber(form.bazosRadiusKm) !== undefined
          ? { radiusKm: parseOptionalNumber(form.bazosRadiusKm) }
          : {}),
      };
    }

    const okRegionIds = parseNumberList(form.okdrazbyRegionIds);
    const okCountyIds = parseNumberList(form.okdrazbyCountyIds);
    if (okRegionIds) {
      location.okdrazby = {
        regionIds: okRegionIds,
        ...(okCountyIds ? { countyIds: okCountyIds } : {}),
      };
    }

    const exRegionIds = parseNumberList(form.exdrazbyRegionIds);
    if (exRegionIds) {
      location.exdrazby = {
        regionIds: exRegionIds,
      };
    }

    const search: Record<string, any> = {
      offerType: form.offerType,
      propertyKind: form.propertyKind,
      location,
    };

    for (const [key, value] of [
      ["priceMin", form.priceMin],
      ["priceMax", form.priceMax],
      ["areaMin", form.areaMin],
      ["areaMax", form.areaMax],
      ["pricePerSqmMin", form.pricePerSqmMin],
      ["pricePerSqmMax", form.pricePerSqmMax],
      ["roomCountMin", form.roomCountMin],
    ] as const) {
      const parsed = parseOptionalNumber(value);
      if (parsed !== undefined) {
        search[key] = parsed;
      }
    }

    const roomLayouts = parseStringList(form.roomLayouts);
    if (roomLayouts) {
      search.roomLayouts = roomLayouts;
    }
    if (form.ownership) {
      search.ownership = form.ownership;
    }
    if (form.freshness) {
      search.freshness = form.freshness;
    }
    search.onlyNew = form.onlyNew;

    const overrides = JSON.parse(form.overridesJson || "{}");

    return {
      key: form.key.trim(),
      label: form.label.trim(),
      enabled: form.enabled,
      scrapers: form.scrapers,
      search,
      overrides,
    };
  }

  async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
    return fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
    });
  }

  async function checkAuth(): Promise<void> {
    authChecking = true;
    try {
      const response = await apiFetch("/api/auth/me");
      const payload = await response.json();
      authenticated = Boolean(payload.authenticated);
      authConfigured = Boolean(payload.configured);
      if (authenticated) {
        await loadConfigs();
      }
    } catch (error) {
      loginError = error instanceof Error ? error.message : "Unable to check auth";
    } finally {
      authChecking = false;
    }
  }

  async function login(): Promise<void> {
    loginLoading = true;
    loginError = "";

    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: loginPassword }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `Login failed with ${response.status}`);
      }

      authenticated = true;
      loginPassword = "";
      await loadConfigs();
    } catch (error) {
      loginError = error instanceof Error ? error.message : "Login failed";
    } finally {
      loginLoading = false;
    }
  }

  async function logout(): Promise<void> {
    await apiFetch("/api/auth/logout", { method: "POST" });
    authenticated = false;
    configs = [];
  }

  async function loadConfigs(): Promise<void> {
    loadingConfigs = true;
    pageError = "";

    try {
      const response = await apiFetch("/api/scrape-configs", {
        cache: "no-store",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? `API returned ${response.status}`);
      }

      const payload = await response.json();
      configs = payload.configs;
      if (!editingOriginalKey && configs.length > 0) {
        editConfig(configs[0]);
      }
    } catch (error) {
      pageError =
        error instanceof Error ? error.message : "Unable to load scrape configs";
    } finally {
      loadingConfigs = false;
    }
  }

  function editConfig(config: StoredConfig): void {
    editingOriginalKey = config.key;
    form = formFromConfig(config);
    saveError = "";
  }

  function newConfig(): void {
    editingOriginalKey = null;
    form = createEmptyForm();
    saveError = "";
  }

  function duplicateConfig(config: StoredConfig): void {
    editingOriginalKey = null;
    form = formFromConfig(config);
    form.key = `${config.key}-copy`;
    form.label = `${config.label} Copy`;
    saveError = "";
  }

  function toggleScraper(scraper: ScraperType): void {
    form.scrapers = form.scrapers.includes(scraper)
      ? form.scrapers.filter((entry) => entry !== scraper)
      : [...form.scrapers, scraper];
  }

  async function saveConfig(): Promise<void> {
    saving = true;
    saveError = "";

    try {
      const payload = configFromForm();
      const response = await apiFetch(
        editingOriginalKey
          ? `/api/scrape-configs/${encodeURIComponent(editingOriginalKey)}`
          : "/api/scrape-configs",
        {
          method: editingOriginalKey ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Save failed with ${response.status}`);
      }

      const result = await response.json();
      await loadConfigs();
      editConfig(result.config);
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Unable to save config";
    } finally {
      saving = false;
    }
  }

  async function importFromSreality(): Promise<void> {
    importing = true;
    importError = "";
    importResult = null;

    try {
      const response = await apiFetch("/api/scrape-configs/import-sreality", {
        method: "POST",
        body: JSON.stringify({
          name: importName,
          url: importUrl,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? `Import failed with ${response.status}`);
      }

      importResult = payload as ImportResult;
    } catch (error) {
      importError =
        error instanceof Error ? error.message : "Unable to import Sreality URL";
    } finally {
      importing = false;
    }
  }

  async function persistImportedDraft(): Promise<void> {
    if (!importResult?.previewAttempted) {
      return;
    }

    persistingImport = true;
    importError = "";

    try {
      const response = await apiFetch("/api/scrape-configs", {
        method: "POST",
        body: JSON.stringify(importResult.draftConfig),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? `Save failed with ${response.status}`);
      }

      await loadConfigs();
      editConfig(payload.config);
      clearImportState();
    } catch (error) {
      importError =
        error instanceof Error ? error.message : "Unable to save imported config";
    } finally {
      persistingImport = false;
    }
  }

  function loadImportedDraftIntoEditor(): void {
    if (!importResult) {
      return;
    }

    editingOriginalKey = null;
    form = formFromConfig(importResult.draftConfig);
    saveError = "";
  }

  function clearImportState(): void {
    importName = "";
    importUrl = "";
    importError = "";
    importResult = null;
  }

  async function deleteConfig(config: StoredConfig): Promise<void> {
    if (!confirm(`Delete "${config.label}"?`)) {
      return;
    }

    const response = await apiFetch(
      `/api/scrape-configs/${encodeURIComponent(config.key)}`,
      { method: "DELETE" },
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      pageError = payload.error ?? `Delete failed with ${response.status}`;
      return;
    }

    if (editingOriginalKey === config.key) {
      newConfig();
    }
    await loadConfigs();
  }

  async function testConfig(
    config: StoredConfig,
    scraperType?: ScraperType,
  ): Promise<void> {
    const stateKey = `${config.key}:${scraperType ?? "all"}`;
    testStates = {
      ...testStates,
      [stateKey]: { loading: true, error: "", results: [] },
    };

    try {
      const response = await apiFetch(
        `/api/scrape-configs/${encodeURIComponent(config.key)}/test`,
        {
          method: "POST",
          body: JSON.stringify({ scraperType }),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Test failed with ${response.status}`);
      }

      testStates = {
        ...testStates,
        [stateKey]: { loading: false, error: "", results: payload.results },
      };
    } catch (error) {
      testStates = {
        ...testStates,
        [stateKey]: {
          loading: false,
          error: error instanceof Error ? error.message : "Test failed",
          results: [],
        },
      };
    }
  }

  function testState(config: StoredConfig, scraperType?: ScraperType) {
    return testStates[`${config.key}:${scraperType ?? "all"}`];
  }

  checkAuth();
</script>

<svelte:head>
  <meta
    name="description"
    content="Password-protected admin console for Reality Scraper scrape configs."
  />
</svelte:head>

{#if authChecking}
  <main class="center-shell">
    <div class="login-panel">
      <span class="kicker">Reality Scraper</span>
      <h1>Checking session</h1>
    </div>
  </main>
{:else if !authenticated}
  <main class="center-shell">
    <form class="login-panel" on:submit|preventDefault={login}>
      <span class="kicker">Reality Scraper Admin</span>
      <h1>Scrape control room</h1>
      <p>
        Enter the password from <code>SCRAPE_ADMIN_PASSWORD</code> to manage and test
        scrape configs.
      </p>

      {#if !authConfigured}
        <div class="notice error">SCRAPE_ADMIN_PASSWORD is not configured on the server.</div>
      {/if}

      <label>
        Password
        <input
          type="password"
          bind:value={loginPassword}
          autocomplete="current-password"
          disabled={!authConfigured || loginLoading}
        />
      </label>

      {#if loginError}
        <div class="notice error">{loginError}</div>
      {/if}

      <button type="submit" disabled={!authConfigured || loginLoading}>
        {loginLoading ? "Signing in" : "Sign in"}
      </button>
    </form>
  </main>
{:else}
  <main class="app-shell">
    <header class="topbar">
      <div>
        <span class="kicker">Reality Scraper</span>
        <h1>Scrape configs</h1>
      </div>
      <div class="top-actions">
        <button type="button" class="secondary" on:click={loadConfigs}>
          Refresh
        </button>
        <button type="button" class="secondary" on:click={logout}>Logout</button>
      </div>
    </header>

    <section class="metrics" aria-label="Scrape config summary">
      <div>
        <span>Stored configs</span>
        <strong>{configs.length}</strong>
      </div>
      <div>
        <span>Enabled configs</span>
        <strong>{enabledCount}</strong>
      </div>
      <div>
        <span>Expanded runs</span>
        <strong>{expandedCount}</strong>
      </div>
    </section>

    {#if pageError}
      <div class="notice error">{pageError}</div>
    {/if}

    <div class="workspace">
      <section class="config-list" aria-label="Stored scrape configs">
        <form class="import-panel" on:submit|preventDefault={importFromSreality}>
          <div class="section-head">
            <h2>Import from Sreality</h2>
          </div>

          <div class="grid two">
            <label>
              Name
              <input bind:value={importName} required placeholder="Imported scrape name" />
            </label>
            <label>
              Sreality URL
              <input
                bind:value={importUrl}
                required
                placeholder="https://www.sreality.cz/hledani/..."
              />
            </label>
          </div>

          {#if importError}
            <div class="notice error">{importError}</div>
          {/if}

          <button type="submit" disabled={importing}>
            {importing ? "Importing and testing" : "Import and test"}
          </button>

          {#if importResult}
            <div class="import-result">
              <div class="result-head">
                <span>
                  {importResult.mode === "all-sites" ? "Cross-site draft" : "Sreality-only draft"}
                </span>
                <span>
                  {importResult.draftConfig.expanded.length} generated runs
                </span>
              </div>

              {#if importResult.warnings.length > 0}
                <div class="warning-list">
                  {#each importResult.warnings as warning}
                    <p>{warning}</p>
                  {/each}
                </div>
              {/if}

              <dl>
                <div>
                  <dt>Label</dt>
                  <dd>{importResult.draftConfig.label}</dd>
                </div>
                <div>
                  <dt>Kind</dt>
                  <dd>{importResult.draftConfig.search.propertyKind}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{importResult.draftConfig.search.location?.label ?? "n/a"}</dd>
                </div>
              </dl>

              <div class="expanded-runs">
                {#each importResult.draftConfig.expanded as scrape}
                  <div>
                    <a href={scrape.url} target="_blank" rel="noreferrer">
                      {scrape.type}
                    </a>
                  </div>
                {/each}
              </div>

              <div class="test-output">
                <strong>Import preview</strong>
                {#each importResult.previewResults as result}
                  <div class="result-block">
                    <div class="result-head">
                      <span>{result.label}</span>
                      <span>{result.properties.length}/{result.returnedCount} shown</span>
                    </div>
                    {#if result.error}
                      <p class="error-text">{result.error}</p>
                    {:else}
                      <ul>
                        {#each result.properties.slice(0, 12) as property}
                          <li>
                            <a href={property.url} target="_blank" rel="noreferrer">
                              {property.title}
                            </a>
                            <span>
                              {property.price} - {property.location}
                              {property.area ? ` - ${property.area}` : ""}
                            </span>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </div>
                {/each}
              </div>

              <div class="row-actions">
                <button
                  type="button"
                  disabled={!importResult.previewAttempted || persistingImport}
                  on:click={persistImportedDraft}
                >
                  {persistingImport ? "Saving import" : "Save imported scrape"}
                </button>
                <button type="button" class="secondary" on:click={loadImportedDraftIntoEditor}>
                  Load into editor
                </button>
                <button type="button" class="secondary" on:click={clearImportState}>
                  Clear import
                </button>
              </div>
            </div>
          {/if}
        </form>

        <div class="section-head">
          <h2>Configs</h2>
          <button type="button" on:click={newConfig}>New</button>
        </div>

        {#if loadingConfigs}
          <p class="muted">Loading configs...</p>
        {:else}
          {#each configs as config}
            <article
              class:active={editingOriginalKey === config.key}
              class="config-row"
            >
              <div class="row-main">
                <div>
                  <h3>{config.label}</h3>
                  <code>{config.key}</code>
                </div>
                <span class:off={!config.enabled} class="state">
                  {config.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>

              <dl>
                <div>
                  <dt>Kind</dt>
                  <dd>{config.search.propertyKind ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{config.search.location?.label ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>Scrapers</dt>
                  <dd>
                    {config.scrapers.length > 0
                      ? config.scrapers.join(", ")
                      : "default"}
                  </dd>
                </div>
              </dl>

              <div class="row-actions">
                <button type="button" class="secondary" on:click={() => editConfig(config)}>
                  Edit
                </button>
                <button type="button" class="secondary" on:click={() => duplicateConfig(config)}>
                  Duplicate
                </button>
                <button type="button" class="danger" on:click={() => deleteConfig(config)}>
                  Delete
                </button>
              </div>

              <div class="expanded-runs">
                {#each config.expanded as scrape}
                  <div>
                    <a href={scrape.url} target="_blank" rel="noreferrer">
                      {scrape.type}
                    </a>
                    <button
                      type="button"
                      class="tiny"
                      disabled={testState(config, scrape.type)?.loading}
                      on:click={() => testConfig(config, scrape.type)}
                    >
                      {testState(config, scrape.type)?.loading ? "Testing" : "Test"}
                    </button>
                  </div>
                {/each}
              </div>

              <button
                type="button"
                class="full-test"
                disabled={testState(config)?.loading}
                on:click={() => testConfig(config)}
              >
                {testState(config)?.loading ? "Testing all scrapers" : "Preview test all"}
              </button>

              {#each Object.entries(testStates).filter(([key]) => key.startsWith(`${config.key}:`)) as [stateKey, state]}
                {#if state.error || state.results.length > 0}
                  <div class="test-output">
                    <strong>{stateKey.split(":").at(-1)} preview</strong>
                    {#if state.error}
                      <p class="error-text">{state.error}</p>
                    {/if}
                    {#each state.results as result}
                      <div class="result-block">
                        <div class="result-head">
                          <span>{result.label}</span>
                          <span>
                            {result.properties.length}/{result.returnedCount} shown
                          </span>
                        </div>
                        {#if result.error}
                          <p class="error-text">{result.error}</p>
                        {:else}
                          <ul>
                            {#each result.properties.slice(0, 12) as property}
                              <li>
                                <a href={property.url} target="_blank" rel="noreferrer">
                                  {property.title}
                                </a>
                                <span>
                                  {property.price} - {property.location}
                                  {property.area ? ` - ${property.area}` : ""}
                                </span>
                              </li>
                            {/each}
                          </ul>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              {/each}
            </article>
          {/each}
        {/if}
      </section>

      <section class="editor" aria-label="Scrape config editor">
        <div class="section-head">
          <h2>{editingOriginalKey ? "Edit config" : "New config"}</h2>
          <button type="button" class="secondary" on:click={newConfig}>Clear</button>
        </div>

        <form on:submit|preventDefault={saveConfig}>
          <div class="grid two">
            <label>
              Label
              <input bind:value={form.label} required />
            </label>
            <label>
              Key
              <input bind:value={form.key} placeholder="Auto-generated from label" />
            </label>
          </div>

          <label class="check">
            <input type="checkbox" bind:checked={form.enabled} />
            Enabled for scheduled scraping
          </label>

          <fieldset>
            <legend>Scrapers</legend>
            <div class="chips">
              {#each SCRAPERS as scraper}
                <label class:checked={form.scrapers.includes(scraper)}>
                  <input
                    type="checkbox"
                    checked={form.scrapers.includes(scraper)}
                    on:change={() => toggleScraper(scraper)}
                  />
                  {scraper}
                </label>
              {/each}
            </div>
            <p class="hint">Leave all unchecked to use the app default scraper set.</p>
          </fieldset>

          <fieldset>
            <legend>Search</legend>
            <div class="grid three">
              <label>
                Offer type
                <select bind:value={form.offerType}>
                  <option value="sale">Sale</option>
                  <option value="rent">Rent</option>
                </select>
              </label>
              <label>
                Property kind
                <select bind:value={form.propertyKind}>
                  <option value="apartment">Apartment</option>
                  <option value="land">Land</option>
                  <option value="house">House</option>
                </select>
              </label>
              <label>
                Freshness
                <select bind:value={form.freshness}>
                  <option value="">Any</option>
                  <option value="today">Today</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </label>
            </div>

            <div class="grid four">
              <label>
                Price min
                <input type="number" bind:value={form.priceMin} />
              </label>
              <label>
                Price max
                <input type="number" bind:value={form.priceMax} />
              </label>
              <label>
                Area min
                <input type="number" bind:value={form.areaMin} />
              </label>
              <label>
                Area max
                <input type="number" bind:value={form.areaMax} />
              </label>
            </div>

            <div class="grid four">
              <label>
                CZK/m2 min
                <input type="number" bind:value={form.pricePerSqmMin} />
              </label>
              <label>
                CZK/m2 max
                <input type="number" bind:value={form.pricePerSqmMax} />
              </label>
              <label>
                Room layouts
                <input bind:value={form.roomLayouts} placeholder="2+1, 2+kk" />
              </label>
              <label>
                Room count min
                <input type="number" bind:value={form.roomCountMin} />
              </label>
            </div>

            <div class="grid two">
              <label>
                Ownership
                <select bind:value={form.ownership}>
                  <option value="">Any</option>
                  <option value="personal">Personal</option>
                </select>
              </label>
              <label class="check with-top">
                <input type="checkbox" bind:checked={form.onlyNew} />
                Only new listings
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Location</legend>
            <label>
              Location label
              <input bind:value={form.locationLabel} required />
            </label>

            <div class="grid two">
              <label>
                IDNES city
                <input bind:value={form.idnesCity} placeholder="olomouc" />
              </label>
              <label>
                Sreality location slug
                <input bind:value={form.srealityLocationSlug} placeholder="olomoucky-kraj" />
              </label>
            </div>

            <div class="grid three">
              <label>
                Bezrealitky OSM value
                <input bind:value={form.bezrealitkyOsmValue} />
              </label>
              <label>
                Bezrealitky region OSM IDs
                <input bind:value={form.bezrealitkyRegionOsmIds} placeholder="R441579" />
              </label>
              <label>
                Bezrealitky mode
                <input bind:value={form.bezrealitkyLocation} placeholder="exact" />
              </label>
            </div>

            <div class="grid two">
              <label>
                Bazos location code
                <input bind:value={form.bazosLocationCode} placeholder="77900" />
              </label>
              <label>
                Bazos radius km
                <input type="number" bind:value={form.bazosRadiusKm} />
              </label>
            </div>

            <div class="grid three">
              <label>
                OkDrazby region IDs
                <input bind:value={form.okdrazbyRegionIds} placeholder="11, 12" />
              </label>
              <label>
                OkDrazby county IDs
                <input bind:value={form.okdrazbyCountyIds} placeholder="54" />
              </label>
              <label>
                ExDrazby region IDs
                <input bind:value={form.exdrazbyRegionIds} placeholder="11, 12, 13" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Overrides</legend>
            <textarea bind:value={form.overridesJson} rows="10" spellcheck="false"></textarea>
          </fieldset>

          {#if saveError}
            <div class="notice error">{saveError}</div>
          {/if}

          <button type="submit" disabled={saving}>
            {saving ? "Saving" : editingOriginalKey ? "Save changes" : "Create config"}
          </button>
        </form>
      </section>
    </div>
  </main>
{/if}

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-width: 320px;
    min-height: 100vh;
    color: #1d2520;
    background: #f6f4ed;
    font-family:
      "Avenir Next", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont,
      sans-serif;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    min-height: 38px;
    border: 1px solid #1d2520;
    border-radius: 6px;
    background: #1d2520;
    color: #fffaf0;
    cursor: pointer;
    font-weight: 800;
  }

  button:hover:not(:disabled) {
    background: #33483b;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  button.secondary {
    background: #fffaf0;
    color: #1d2520;
  }

  button.danger {
    border-color: #9d3328;
    background: #9d3328;
  }

  .tiny {
    min-height: 28px;
    padding: 0 9px;
    font-size: 0.78rem;
  }

  .center-shell {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 20px;
  }

  .login-panel {
    width: min(100%, 440px);
    padding: 32px;
    border: 1px solid #d7d0c0;
    border-radius: 8px;
    background: #fffaf0;
    box-shadow: 0 24px 70px rgba(29, 37, 32, 0.14);
  }

  .login-panel h1,
  .topbar h1 {
    margin: 6px 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(2.2rem, 6vw, 4.4rem);
    line-height: 0.95;
  }

  .login-panel p {
    color: #657168;
    line-height: 1.55;
  }

  .kicker {
    color: #667520;
    font-size: 0.76rem;
    font-weight: 900;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .app-shell {
    width: min(1600px, 100%);
    margin: 0 auto;
    padding: 28px;
  }

  .topbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 22px;
  }

  .top-actions,
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    margin-bottom: 22px;
    border: 1px solid #d7d0c0;
    border-radius: 8px;
    background: #d7d0c0;
  }

  .metrics div {
    padding: 17px 18px;
    background: #fffaf0;
  }

  .metrics span,
  dt,
  .hint {
    color: #68746b;
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .metrics strong {
    display: block;
    margin-top: 4px;
    font-size: 1.7rem;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(360px, 0.9fr) minmax(560px, 1.35fr);
    gap: 20px;
    align-items: start;
  }

  .config-list,
  .editor {
    min-width: 0;
  }

  .import-panel {
    margin-bottom: 18px;
    padding: 16px;
    border: 1px solid #d7d0c0;
    border-radius: 8px;
    background: #fffaf0;
  }

  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 12px;
  }

  h2,
  h3 {
    margin: 0;
  }

  .config-row,
  .editor form {
    border: 1px solid #d7d0c0;
    border-radius: 8px;
    background: #fffaf0;
  }

  .config-row {
    padding: 16px;
    margin-bottom: 12px;
  }

  .config-row.active {
    border-color: #667520;
    box-shadow: inset 4px 0 0 #667520;
  }

  .row-main {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  code {
    overflow-wrap: anywhere;
    color: #59645c;
    font-size: 0.82rem;
  }

  .state {
    height: fit-content;
    padding: 4px 8px;
    border-radius: 999px;
    background: #e4efc1;
    color: #405010;
    font-size: 0.75rem;
    font-weight: 900;
  }

  .state.off {
    background: #efe2dc;
    color: #8c3127;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin: 14px 0;
  }

  dd {
    margin: 4px 0 0;
    overflow-wrap: anywhere;
    font-weight: 800;
  }

  .expanded-runs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .expanded-runs div {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px;
    border: 1px solid #e1dbce;
    border-radius: 6px;
    background: #f8f3e7;
  }

  .expanded-runs a,
  .test-output a {
    color: #285f70;
    font-weight: 800;
  }

  .full-test {
    width: 100%;
    margin-top: 12px;
  }

  .test-output {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #d8e0c7;
    border-radius: 8px;
    background: #f4f8e9;
  }

  .import-result {
    margin-top: 14px;
  }

  .warning-list {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #d9c88d;
    border-radius: 8px;
    background: #fbf4d8;
    color: #6e5821;
    font-weight: 800;
  }

  .warning-list p {
    margin: 0 0 8px;
  }

  .warning-list p:last-child {
    margin-bottom: 0;
  }

  .result-block {
    margin-top: 10px;
  }

  .result-head {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: #526158;
    font-size: 0.84rem;
    font-weight: 900;
  }

  ul {
    max-height: 280px;
    overflow: auto;
    padding-left: 18px;
  }

  li {
    margin-bottom: 8px;
  }

  li span {
    display: block;
    color: #68746b;
    font-size: 0.86rem;
  }

  .editor form {
    padding: 18px;
  }

  fieldset {
    margin: 18px 0 0;
    padding: 16px;
    border: 1px solid #ded7c9;
    border-radius: 8px;
  }

  legend {
    padding: 0 6px;
    font-weight: 900;
  }

  label {
    display: grid;
    gap: 7px;
    color: #344139;
    font-size: 0.86rem;
    font-weight: 800;
  }

  input,
  select,
  textarea {
    width: 100%;
    min-height: 38px;
    border: 1px solid #cfc8bb;
    border-radius: 6px;
    background: #fffcf5;
    color: #1d2520;
    padding: 8px 10px;
  }

  textarea {
    font-family: "SFMono-Regular", Consolas, monospace;
    line-height: 1.45;
    resize: vertical;
  }

  .grid {
    display: grid;
    gap: 12px;
    margin-bottom: 12px;
  }

  .two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .check {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .check.with-top {
    padding-top: 26px;
  }

  .check input,
  .chips input {
    width: auto;
    min-height: 0;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chips label {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid #d7d0c0;
    border-radius: 999px;
    background: #f7f1e4;
  }

  .chips label.checked {
    border-color: #667520;
    background: #e7efc8;
  }

  .hint {
    margin: 10px 0 0;
    text-transform: none;
  }

  .notice {
    margin: 12px 0;
    padding: 11px 12px;
    border-radius: 6px;
    font-weight: 800;
  }

  .error,
  .notice.error,
  .error-text {
    color: #8c3127;
  }

  .notice.error {
    border: 1px solid #e0b9ae;
    background: #f8e6df;
  }

  .muted {
    color: #68746b;
  }

  @media (max-width: 1180px) {
    .workspace,
    .metrics,
    .three,
    .four {
      grid-template-columns: 1fr;
    }

    .two {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .app-shell {
      padding: 18px;
    }

    .topbar,
    .row-main {
      align-items: stretch;
      flex-direction: column;
    }

    dl {
      grid-template-columns: 1fr;
    }
  }
</style>
