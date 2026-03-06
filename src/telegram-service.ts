import TelegramBot from "node-telegram-bot-api";
import type { Property, PropertyWithPriceChange, ScrapeResult } from "./types";

export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;
  private readonly numberFormatter = new Intl.NumberFormat("cs-CZ");

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  async sendPropertiesUpdate(
    properties: Property[],
    contextLabel?: string
  ): Promise<void> {
    if (properties.length === 0) {
      await this.sendMessage(this.buildEmptyMessage(contextLabel));
      return;
    }

    const summaryMessage = this.buildSummaryMessage(properties, contextLabel);
    await this.sendMessage(summaryMessage);
    await this.sendPropertyImages(properties);
  }

  async sendCombinedPropertiesUpdate(
    scrapeResults: ScrapeResult[]
  ): Promise<void> {
    // Send property images with city labels
    for (const result of scrapeResults) {
      await this.sendPropertyImages(result.properties, result.label);
    }
  }

  private buildEmptyMessage(contextLabel?: string): string {
    const title = contextLabel
      ? `🏠 <b>${this.escapeHtml(contextLabel)}</b>\n\n`
      : `🏠 <b>Daily Property Update</b>\n\n`;

    return `${title}No new properties found today.`;
  }

  private buildSummaryMessage(
    properties: Property[],
    contextLabel?: string
  ): string {
    const title = contextLabel
      ? `🏠 <b>${this.escapeHtml(contextLabel)}</b>\n\n`
      : `🏠 <b>Daily Property Update</b>\n\n`;
    const count = `Found <b>${properties.length}</b> new properties:\n\n`;

    const propertiesList = "";
    // const propertiesList = properties
    //   .slice(0, 10)
    //   .map((property, index) => {
    //     const title = this.escapeHtml(property.title || "No title");
    //     const price = this.escapeHtml(property.price || "N/A");
    //     const location = this.escapeHtml(
    //       property.area || property.location || "N/A"
    //     );
    //     const url = this.escapeHtml(property.url);

    //     return [
    //       `<b>${index + 1}. ${title}</b>`,
    //       `💰 ${price}`,
    //       `📍 ${location}`,
    //       `🔗 <a href="${url}">View Details</a>`,
    //       "",
    //     ].join("\n");
    //   })
    //   .join("\n");

    const footer =
      properties.length > 10
        ? `\n<i>... and ${properties.length - 10} more properties</i>`
        : "";

    return title + count + propertiesList + footer;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async sendMessage(message: string): Promise<void> {
    try {
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      console.log("✅ Telegram message sent successfully");
    } catch (error) {
      console.error("❌ Error sending Telegram message:", error);
      throw error;
    }
  }

  async sendPhoto(photo: Buffer | string, caption?: string): Promise<void> {
    try {
      await this.bot.sendPhoto(this.chatId, photo, { caption });
      console.log("✅ Telegram photo sent successfully");
    } catch (error) {
      console.error("❌ Error sending Telegram photo:", error);
    }
  }

  private async sendPropertyImages(
    properties: (Property | PropertyWithPriceChange)[],
    city?: string
  ): Promise<void> {
    const mediaItems = this.buildMediaItems(properties, city);
    if (mediaItems.length === 0) {
      console.log("❌ No media items to send");
      return;
    }

    try {
      for (const mediaItem of mediaItems) {
        await this.bot.sendPhoto(this.chatId, mediaItem.media, {
          caption: mediaItem.caption,
          parse_mode: "HTML",
        });
      }
      console.log("✅ Telegram property images sent successfully");
    } catch (error) {
      console.error("❌ Error sending Telegram media group:", error);
    }
  }

  private buildMediaItems(
    properties: (Property | PropertyWithPriceChange)[],
    city?: string
  ): TelegramBot.InputMediaPhoto[] {
    return properties
      .slice(0, 10)
      .map((property, index) => {
        const imageUrl = property.images?.find(Boolean);

        if (!imageUrl) {
          return null;
        }

        const captionBody = this.formatPropertyCaption(property, index, city);

        return {
          type: "photo" as const,
          media: imageUrl,
          caption: captionBody,
          parse_mode: "HTML" as const,
        };
      })
      .filter((item) => item !== null);
  }

  private formatPropertyCaption(
    property: Property | PropertyWithPriceChange,
    index: number,
    city?: string
  ): string {
    const title = this.escapeHtml(property.title || "No title");
    const price = this.escapeHtml(property.price || "N/A");
    const location = this.escapeHtml(property.location || "N/A");
    const formattedArea = this.formatAreaWithUnit(property.area);
    const pricePerSqm = this.formatPricePerSqm(property.pricePerSqm);
    const url = this.escapeHtml(property.url);

    const lines = [`<b>${index + 1}. ${title}</b>`];

    if (city) {
      lines.push(`🏙️ ${this.escapeHtml(city)}`);
    }

    // Check if this is a price change
    const priceChangeProperty = property as PropertyWithPriceChange;
    if (
      priceChangeProperty.isPriceChange &&
      priceChangeProperty.previousPrice
    ) {
      const oldPrice = this.escapeHtml(priceChangeProperty.previousPrice);
      const changePercent = priceChangeProperty.priceChangePercent || 0;
      const changeIcon = changePercent < 0 ? "📉" : "📈";
      const changeSign = changePercent > 0 ? "+" : "";

      lines.push(
        `${changeIcon} <s>${oldPrice}</s> → <b>${price}</b> (${changeSign}${changePercent}%)`
      );
    } else {
      lines.push(`💰 ${price}`);
    }

    if (pricePerSqm) {
      lines.push(`📊 ${this.escapeHtml(pricePerSqm)}`);
    }

    if (formattedArea) {
      lines.push(`📐 ${this.escapeHtml(formattedArea)}`);
    }

    lines.push(`📍 ${location}`);
    lines.push(`🔗 <a href="${url}">View Details</a>`);

    return lines.join("\n");
  }

  private formatPricePerSqm(pricePerSqm?: number): string | undefined {
    if (
      typeof pricePerSqm !== "number" ||
      !Number.isFinite(pricePerSqm) ||
      pricePerSqm <= 0
    ) {
      return undefined;
    }

    return `${this.numberFormatter.format(Math.round(pricePerSqm))} Kč/m²`;
  }

  private formatAreaWithUnit(area?: string): string | undefined {
    if (!area) return undefined;

    const normalized = area.trim().replace(",", ".");
    const numericMatch = normalized.match(/^(\d+(?:\.\d+)?)(?:\s*m(?:2|²))?$/i);
    if (!numericMatch) return normalized;

    const value = Number.parseFloat(numericMatch[1]);
    if (!Number.isFinite(value) || value <= 0) return normalized;

    const formattedNumber = Number.isInteger(value)
      ? value.toString()
      : value.toFixed(1).replace(/\.0$/, "");

    return `${formattedNumber} m²`;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.sendMessage("🤖 <b>Reality Scraper Bot</b> is online!!");
      return true;
    } catch (error) {
      console.error("❌ Telegram connection test failed:", error);
      return false;
    }
  }
}
