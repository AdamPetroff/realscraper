import TelegramBot from "node-telegram-bot-api";
import { Property } from "./types";

export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.bot = new TelegramBot(token, { polling: false });
    this.chatId = chatId;
  }

  async sendPropertiesUpdate(properties: Property[]): Promise<void> {
    if (properties.length === 0) {
      await this.sendMessage("🏠 No new properties found today.");
      return;
    }

    const message = this.formatPropertiesMessage(properties);
    await this.sendMessage(message);
  }

  private formatPropertiesMessage(properties: Property[]): string {
    const header = `🏠 <b>Daily Property Update</b>\n\n`;
    const count = `Found <b>${properties.length}</b> new properties:\n\n`;

    const propertiesList = properties
      .slice(0, 10)
      .map((property, index) => {
        const title = this.escapeHtml(property.title || "No title");
        const price = this.escapeHtml(property.price || "N/A");
        const location = this.escapeHtml(
          property.area || property.location || "N/A"
        );

        return [
          `<b>${index + 1}. ${title}</b>`,
          `💰 ${price}`,
          `📍 ${location}`,
          `🔗 <a href="${property.url}">View Details</a>`,
          "",
        ].join("\n");
      })
      .join("\n");

    const footer =
      properties.length > 10
        ? `\n<i>... and ${properties.length - 10} more properties</i>`
        : "";

    return header + count + propertiesList + footer;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

  async testConnection(): Promise<boolean> {
    try {
      await this.sendMessage("🤖 <b>Reality Scraper Bot</b> is online!");
      return true;
    } catch (error) {
      console.error("❌ Telegram connection test failed:", error);
      return false;
    }
  }
}
