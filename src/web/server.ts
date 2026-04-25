import { createHmac, timingSafeEqual } from "crypto";
import { createReadStream, existsSync, statSync } from "fs";
import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { extname, join, normalize, resolve, sep } from "path";
import {
  buildUrlForScrape,
  createStoredScrapeKey,
  expandSharedScrape,
  type ScraperType,
  type StoredSharedScrapeConfig,
} from "../scrape-configs";
import { importStoredScrapeConfigFromSrealityUrl } from "../sreality-import";
import type { PropertyScheduler } from "../scheduler";
import {
  createStoredSharedScrapeConfig,
  deleteStoredSharedScrapeConfig,
  getStoredSharedScrapeConfig,
  listStoredSharedScrapeConfigs,
  updateStoredSharedScrapeConfig,
} from "../db";

type HealthPayload = {
  ok: true;
  app: string;
  environment: string;
  timestamp: string;
};

type JsonPayload = HealthPayload | Record<string, unknown> | unknown[];

const SESSION_COOKIE = "reality_scraper_admin";
const SESSION_VALUE = "admin";
const MAX_BODY_BYTES = 512 * 1024;
const SCRAPER_TYPES: ScraperType[] = [
  "idnes",
  "bezrealitky",
  "sreality",
  "bazos",
  "okdrazby",
  "exdrazby",
];

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

export function startWebServer(
  port: number,
  host = "0.0.0.0",
  scheduler?: PropertyScheduler,
): Promise<Server> {
  const staticRoot = resolve(process.cwd(), "ui", "dist");

  const server = createServer((request, response) => {
    void handleRequest(request, response, staticRoot, scheduler);
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      console.log(`🌐 Web UI/API listening on http://${host}:${port}`);
      resolveServer(server);
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  staticRoot: string,
  scheduler?: PropertyScheduler,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  try {
    if (url.pathname === "/api/health") {
      sendJson(response, {
        ok: true,
        app: "reality-scraper",
        environment: process.env.NODE_ENV ?? "development",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, url, scheduler);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method Not Allowed");
      return;
    }

    serveStaticAsset(request, response, staticRoot, url.pathname);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, { error: message }, 500);
  }
}

async function handleApiRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  scheduler?: PropertyScheduler,
): Promise<void> {
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    sendJson(response, {
      authenticated: isAuthenticated(request),
      configured: Boolean(getAdminPassword()),
    });
    return;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    await handleLogin(request, response);
    return;
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    response.writeHead(204, {
      "Set-Cookie": clearSessionCookie(),
    });
    response.end();
    return;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, { error: "Authentication required" }, 401);
    return;
  }

  if (url.pathname === "/api/scrape-configs" && request.method === "GET") {
    const configs = await listStoredSharedScrapeConfigs();
    sendJson(response, { configs: configs.map(toScrapeConfigPayload) });
    return;
  }

  if (url.pathname === "/api/scrape-configs" && request.method === "POST") {
    const body = await readJsonBody(request);
    const created = await createStoredSharedScrapeConfig(parseStoredConfig(body));
    await refreshScheduler(scheduler);
    sendJson(response, { config: toScrapeConfigPayload(created) }, 201);
    return;
  }

  if (
    url.pathname === "/api/scrape-configs/import-sreality" &&
    request.method === "POST"
  ) {
    if (!scheduler) {
      sendJson(response, { error: "Scheduler is not available" }, 503);
      return;
    }

    const body = await readJsonBody(request);
    const { name, url: importUrl } = parseSrealityImportRequest(body);
    const importResult = importStoredScrapeConfigFromSrealityUrl({
      name,
      url: importUrl,
    });
    const previewResults = await scheduler.runPreviewScrape(
      importResult.draftConfig,
    );

    sendJson(response, {
      mode: importResult.mode,
      warnings: importResult.warnings,
      draftConfig: toScrapeConfigPayload(importResult.draftConfig),
      previewResults,
      previewAttempted: true,
    });
    return;
  }

  const configMatch = url.pathname.match(/^\/api\/scrape-configs\/([^/]+)$/);
  if (configMatch) {
    const key = decodeURIComponent(configMatch[1]);

    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      const updated = await updateStoredSharedScrapeConfig(
        key,
        parseStoredConfig(body),
      );
      await refreshScheduler(scheduler);
      sendJson(response, { config: toScrapeConfigPayload(updated) });
      return;
    }

    if (request.method === "DELETE") {
      await deleteStoredSharedScrapeConfig(key);
      await refreshScheduler(scheduler);
      response.writeHead(204);
      response.end();
      return;
    }
  }

  const testMatch = url.pathname.match(/^\/api\/scrape-configs\/([^/]+)\/test$/);
  if (testMatch && request.method === "POST") {
    const key = decodeURIComponent(testMatch[1]);
    const storedConfig = await getStoredSharedScrapeConfig(key);
    if (!storedConfig) {
      sendJson(response, { error: "Scrape config not found" }, 404);
      return;
    }

    if (!scheduler) {
      sendJson(response, { error: "Scheduler is not available" }, 503);
      return;
    }

    const body = await readJsonBody(request);
    const scraperType = parseOptionalScraperType(body);
    const results = await scheduler.runPreviewScrape(storedConfig, scraperType);
    sendJson(response, {
      previewOnly: true,
      configKey: key,
      results,
    });
    return;
  }

  sendJson(response, { error: "Not found" }, 404);
}

async function handleLogin(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    sendJson(response, { error: "SCRAPE_ADMIN_PASSWORD is not configured" }, 503);
    return;
  }

  const body = await readJsonBody(request);
  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password?: unknown }).password
      : undefined;

  if (typeof password !== "string" || password !== adminPassword) {
    sendJson(response, { error: "Invalid password" }, 401);
    return;
  }

  response.writeHead(204, {
    "Set-Cookie": createSessionCookie(adminPassword),
  });
  response.end();
}

function toScrapeConfigPayload(config: StoredSharedScrapeConfig): Record<string, unknown> {
  const expanded = expandSharedScrape(config).map((scrape) => ({
    id: scrape.id,
    label: scrape.label,
    type: scrape.type,
    enabled: scrape.enabled !== false,
    url: buildUrlForScrape(scrape),
  }));

  return {
    ...config,
    enabled: config.enabled ?? true,
    scrapers: config.scrapers ?? [],
    overrides: config.overrides ?? null,
    expanded,
  };
}

function parseStoredConfig(value: unknown): StoredSharedScrapeConfig {
  if (!value || typeof value !== "object") {
    throw new Error("Expected scrape config object");
  }

  const record = value as Partial<StoredSharedScrapeConfig>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) {
    throw new Error("Scrape config label is required");
  }
  if (!record.search || typeof record.search !== "object") {
    throw new Error("Scrape config search is required");
  }

  const config: StoredSharedScrapeConfig = {
    key:
      typeof record.key === "string" && record.key.trim()
        ? record.key.trim()
        : createStoredScrapeKey(label),
    label,
    enabled:
      typeof record.enabled === "boolean" ? record.enabled : true,
    scrapers: parseScraperList(record.scrapers),
    search: record.search,
    overrides: record.overrides ?? undefined,
  };

  expandSharedScrape(config);
  return config;
}

function parseScraperList(value: unknown): ScraperType[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("scrapers must be an array");
  }

  const scrapers = value.filter((entry): entry is ScraperType =>
    SCRAPER_TYPES.includes(entry as ScraperType),
  );

  if (scrapers.length !== value.length) {
    throw new Error("scrapers contains an unsupported scraper type");
  }

  return scrapers.length > 0 ? scrapers : undefined;
}

function parseOptionalScraperType(value: unknown): ScraperType | undefined {
  if (!value || typeof value !== "object" || !("scraperType" in value)) {
    return undefined;
  }

  const scraperType = (value as { scraperType?: unknown }).scraperType;
  if (scraperType === undefined || scraperType === null || scraperType === "") {
    return undefined;
  }

  if (
    typeof scraperType !== "string" ||
    !SCRAPER_TYPES.includes(scraperType as ScraperType)
  ) {
    throw new Error("Unsupported scraperType");
  }

  return scraperType as ScraperType;
}

function parseSrealityImportRequest(value: unknown): {
  name: string;
  url: string;
} {
  if (!value || typeof value !== "object") {
    throw new Error("Expected import request object");
  }

  const record = value as { name?: unknown; url?: unknown };
  if (typeof record.name !== "string" || !record.name.trim()) {
    throw new Error("Import name is required");
  }
  if (typeof record.url !== "string" || !record.url.trim()) {
    throw new Error("Sreality URL is required");
  }

  return {
    name: record.name.trim(),
    url: record.url.trim(),
  };
}

async function refreshScheduler(scheduler?: PropertyScheduler): Promise<void> {
  if (!scheduler) {
    return;
  }

  try {
    await scheduler.reloadScrapes();
  } catch (error) {
    console.warn("Unable to refresh scheduler scrape configs:", error);
  }
}

function getAdminPassword(): string | undefined {
  const value = process.env.SCRAPE_ADMIN_PASSWORD;
  return value && value.length > 0 ? value : undefined;
}

function isAuthenticated(request: IncomingMessage): boolean {
  const password = getAdminPassword();
  if (!password) {
    return false;
  }

  const cookies = parseCookies(request.headers.cookie ?? "");
  const session = cookies[SESSION_COOKIE];
  if (!session) {
    return false;
  }

  const expected = signSession(password);
  return timingSafeStringEqual(session, expected);
}

function createSessionCookie(password: string): string {
  return `${SESSION_COOKIE}=${signSession(password)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function signSession(password: string): string {
  const signature = createHmac("sha256", password)
    .update(SESSION_VALUE)
    .digest("base64url");
  return `${SESSION_VALUE}.${signature}`;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name || rest.length === 0) {
      continue;
    }
    cookies[name] = rest.join("=");
  }
  return cookies;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const body = await readBody(request);
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large"));
        request.destroy();
        return;
      }

      body += chunk;
    });
    request.on("end", () => resolveBody(body));
    request.on("error", reject);
  });
}

function sendJson(
  response: ServerResponse,
  payload: JsonPayload,
  statusCode = 200,
): void {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function serveStaticAsset(
  request: IncomingMessage,
  response: ServerResponse,
  staticRoot: string,
  pathname: string,
): void {
  const relativePath = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.(\/|\\|$))+/,
    "",
  );
  const requestedPath = resolve(staticRoot, `.${sep}${relativePath}`);
  const indexPath = join(staticRoot, "index.html");

  if (!requestedPath.startsWith(staticRoot)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const filePath =
    existsSync(requestedPath) && statSync(requestedPath).isFile()
      ? requestedPath
      : indexPath;

  if (!existsSync(filePath)) {
    response.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("UI build is missing. Run npm run build:ui.");
    return;
  }

  response.writeHead(200, {
    "Cache-Control":
      filePath === indexPath ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}
