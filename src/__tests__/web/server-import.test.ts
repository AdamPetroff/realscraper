import { afterEach, describe, expect, it, vi } from "vitest";
import type { Server } from "http";
import { startWebServer } from "../../web/server";

describe("web server import", () => {
  const originalPassword = process.env.SCRAPE_ADMIN_PASSWORD;
  let server: Server | undefined;

  afterEach(async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = originalPassword;

    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it("returns a draft config and preview results for Sreality imports", async () => {
    process.env.SCRAPE_ADMIN_PASSWORD = "secret";
    const scheduler = {
      runPreviewScrape: vi.fn().mockResolvedValue([
        {
          id: "sreality-imported-brno",
          label: "Sreality Imported Brno",
          type: "sreality",
          url: "https://www.sreality.cz/example",
          returnedCount: 1,
          filteredOutCount: 0,
          properties: [],
        },
      ]),
    };

    server = await startWebServer(0, "127.0.0.1", scheduler as any);
    const cookie = await login(server);

    const response = await fetch(`${baseUrl(server)}/api/scrape-configs/import-sreality`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Imported Brno",
        url: "https://www.sreality.cz/hledani/prodej/byty/brno?cena-do=6000000",
      }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.previewAttempted).toBe(true);
    expect(payload.mode).toBe("all-sites");
    expect(payload.draftConfig.label).toBe("Imported Brno");
    expect(payload.previewResults).toHaveLength(1);
    expect(scheduler.runPreviewScrape).toHaveBeenCalledTimes(1);
  });
});

async function login(server: Server): Promise<string> {
  const response = await fetch(`${baseUrl(server)}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "secret" }),
  });

  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    throw new Error("Expected auth cookie");
  }

  return cookie;
}

function baseUrl(server: Server): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}
