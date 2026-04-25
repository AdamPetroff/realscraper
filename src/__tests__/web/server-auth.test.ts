import { afterEach, describe, expect, it } from "vitest";
import type { Server } from "http";
import { startWebServer } from "../../web/server";

describe("web server auth", () => {
  const originalPassword = process.env.SCRAPE_ADMIN_PASSWORD;
  let server: Server | undefined;

  afterEach(async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = originalPassword;

    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("rejects protected API routes without a session", async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = "secret";
    server = await startWebServer(0, "127.0.0.1");

    const response = await fetch(`${baseUrl(server)}/api/scrape-configs`);

    expect(response.status).toBe(401);
  });

  it("creates a session cookie after login", async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = "secret";
    server = await startWebServer(0, "127.0.0.1");

    const loginResponse = await fetch(`${baseUrl(server)}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });

    expect(loginResponse.status).toBe(204);
    expect(loginResponse.headers.get("set-cookie")).toContain(
      "reality_scraper_admin=",
    );
  });

  it("reports the authenticated session", async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = "secret";
    server = await startWebServer(0, "127.0.0.1");

    const loginResponse = await fetch(`${baseUrl(server)}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "secret" }),
    });
    const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];

    const meResponse = await fetch(`${baseUrl(server)}/api/auth/me`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const payload = await meResponse.json();

    expect(payload).toEqual({
      authenticated: true,
      configured: true,
    });
  });
});

function baseUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
