import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { Property } from "../types";
import { IScraper } from "./scraper.interface";

export abstract class BaseScraper implements IScraper {
  protected browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
      ],
    });
  }

  abstract scrapeProperties(url: string): Promise<Property[]>;

  protected async getPage(url: string): Promise<Page> {
    if (!this.browser) {
      throw new Error("Scraper not initialized. Call initialize() first.");
    }

    const page: Page = await this.browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1920, height: 1080 });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
    });

    console.log(`Navigating to: ${url}`);

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
    } catch (error) {
      console.log(
        "First navigation attempt failed, trying with networkidle0..."
      );
      await page.goto(url, {
        waitUntil: "networkidle0",
        timeout: 60000,
      });
    }

    // Wait for content to load
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return page;
  }

  protected extractText(
    $item: cheerio.Cheerio<any>,
    selectors: string[]
  ): string {
    for (const selector of selectors) {
      const text = $item.find(selector).first().text().trim();
      if (text) {
        return text;
      }
    }
    return "";
  }

  protected extractUrl($item: cheerio.Cheerio<any>, baseUrl: string): string {
    const link = $item.find("a").first().attr("href");
    if (!link) return "";

    if (link.startsWith("http")) {
      return link;
    } else if (link.startsWith("/")) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${link}`;
    }
    return link;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
