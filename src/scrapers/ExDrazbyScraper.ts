import { Property, type PropertyType } from "../types";
import { ScrapeOptions } from "./scraper.interface";

interface ExDrazbyListResponse {
  data?: ExDrazbyAuction[];
  total?: number;
}

interface ExDrazbyAuction {
  id: number;
  title?: string | null;
  number?: string | null;
  minimalBid?: number | null;
  winnerBid?: {
    bidPrice?: number | null;
  } | null;
  cautionDeposit?: number | null;
  auctionType?: string | null;
  parentStatus?: string | null;
  statusTranslation?: string | null;
  description?: string | null;
  startDt?: string | null;
  endDt?: string | null;
  auctionCategory?: {
    id?: number | null;
    title?: string | null;
    parentTitle?: string | null;
  } | null;
  auctionAddress?: {
    city?: string | null;
    region?: {
      name?: string | null;
    } | null;
    district?: {
      name?: string | null;
    } | null;
  } | null;
  auctionMedia?: Array<{
    url?: string | null;
    cropImagePath?: string | null;
    media?: {
      hash?: string | null;
    } | null;
  }> | null;
}

interface ParsedSearch {
  status: "prepared" | "ongoing" | "ended";
  page: number;
  perPage: number;
  title?: string;
  priceFrom?: number;
  priceTo?: number;
  mainCategoryId?: number;
  subcategoryIds: number[];
  regionIds: number[];
  districtIds: number[];
  auctionType?: string;
}

interface ExDrazbyPageListResponse {
  data?: ExDrazbyPage[];
}

interface ExDrazbyPage {
  routeName?: string | null;
  fullUrl?: string | null;
}

interface ExDrazbyFilter {
  value: string;
  operator: "eq" | "gte" | "lte" | "like";
  type: "string" | "int";
  property: string;
}

type ExDrazbyFilterQuery = Array<ExDrazbyFilter | ExDrazbyFilter[]>;

const EX_DRAZBY_BASE_URL = "https://exdrazby.cz";
const EX_DRAZBY_API_URL = `${EX_DRAZBY_BASE_URL}/api/web/auction/`;
const EX_DRAZBY_PAGES_URL = `${EX_DRAZBY_BASE_URL}/api/web/page/page-enabled`;
const EX_DRAZBY_DEFAULT_DETAIL_PATHS = {
  auction: "/aukce/:id",
  auctionPublic: "/drazba/:id",
  publicCompetition: "/verejna-soutez/:id",
};

export class ExDrazbyScraper {
  private detailPaths = { ...EX_DRAZBY_DEFAULT_DETAIL_PATHS };

  constructor(private readonly defaultOptions: ScrapeOptions = {}) {}

  async initialize(): Promise<void> {
    try {
      const response = await fetch(EX_DRAZBY_PAGES_URL, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ExDrazbyPageListResponse;
      this.loadDetailPaths(payload.data ?? []);
    } catch {
      // Keep default paths when page metadata is unavailable.
    }
  }

  async close(): Promise<void> {
    // No resources to close
  }

  async scrapeProperties(
    url: string,
    options?: ScrapeOptions,
  ): Promise<Property[]> {
    const resolvedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    if (resolvedOptions.newOnly) {
      console.log(
        "ExDrazbyScraper: newOnly is not supported for this source, scraping all matched auctions",
      );
    }

    const search = this.parseSearchUrl(url);
    const perPage = Math.min(search.perPage, 100);
    const properties: Property[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const pageUrl = this.buildApiUrl(search, page, perPage);
      console.log(`ExDrazbyScraper: Fetching API page ${page}: ${pageUrl}`);

      const response = await fetch(pageUrl, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const payload = (await response.json()) as ExDrazbyListResponse;
      const pageProperties = this.parsePropertiesFromApiResponse(payload);
      properties.push(...pageProperties);

      const total = typeof payload.total === "number" ? payload.total : 0;
      totalPages = total > 0 ? Math.ceil(total / perPage) : 1;

      if (!payload.data || payload.data.length === 0) {
        break;
      }

      page += 1;
    }

    return properties;
  }

  parsePropertiesFromApiResponse(response: ExDrazbyListResponse): Property[] {
    return (response.data ?? [])
      .map((auction) => this.mapAuctionToProperty(auction))
      .filter((property): property is Property => property !== undefined);
  }

  private mapAuctionToProperty(auction: ExDrazbyAuction): Property | undefined {
    const title = this.normalizeWhitespace(auction.title);

    if (!auction.id || !title) {
      return undefined;
    }

    const priceNumeric = this.resolvePriceNumeric(auction);
    const district = this.normalizeWhitespace(
      auction.auctionAddress?.district?.name,
    );
    const region = this.normalizeWhitespace(auction.auctionAddress?.region?.name);
    const city = this.normalizeWhitespace(auction.auctionAddress?.city);
    const location = [city, district, region].filter(Boolean).join(", ");
    const images = this.extractImages(auction);

    return {
      title,
      price:
        typeof priceNumeric === "number"
          ? `${priceNumeric.toLocaleString("cs-CZ").replace(/\u00a0/g, " ")} Kč`
          : "",
      location: location || region || district || city || "",
      district,
      region,
      rooms: this.extractRooms(auction.title) ?? "",
      url: this.getDetailUrl(auction),
      description: this.normalizeWhitespace(auction.description),
      images: images.length > 0 ? images : undefined,
      source: "exdrazby",
      sourceId: String(auction.id),
      priceNumeric,
      propertyType: this.resolvePropertyType(auction),
    };
  }

  private buildApiUrl(search: ParsedSearch, page: number, perPage: number): string {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    params.set(
      "sort",
      JSON.stringify({
        property:
          search.status === "ended" ? "auction.realEndDt" : "auction.startDt",
        direction: search.status === "ended" ? "DESC" : "ASC",
      }),
    );

    const filters = this.buildFilterQuery(search);
    if (filters.length > 0) {
      params.set("filter", JSON.stringify(filters));
    }

    return `${EX_DRAZBY_API_URL}?${params.toString()}`;
  }

  private buildFilterQuery(search: ParsedSearch): ExDrazbyFilterQuery {
    const filters: ExDrazbyFilterQuery = [
      {
        value: search.status,
        operator: "eq",
        type: "string",
        property: "auction.status",
      },
    ];

    if (search.title) {
      filters.push({
        value: `%${search.title}%`,
        operator: "like",
        type: "string",
        property: "auction.title",
      });
    }

    if (typeof search.priceFrom === "number") {
      filters.push({
        value: String(search.priceFrom),
        operator: "gte",
        type: "int",
        property: "auction.minimalBid",
      });
    }

    if (typeof search.priceTo === "number") {
      filters.push({
        value: String(search.priceTo),
        operator: "lte",
        type: "int",
        property: "auction.minimalBid",
      });
    }

    if (typeof search.mainCategoryId === "number") {
      filters.push({
        value: String(search.mainCategoryId),
        operator: "eq",
        type: "int",
        property: "auctionCategory.parent",
      });
    }

    this.pushGroupedFilters(filters, search.regionIds, "auctionAddress.region");
    this.pushGroupedFilters(
      filters,
      search.districtIds,
      "auctionAddress.district",
    );
    this.pushGroupedFilters(filters, search.subcategoryIds, "auctionCategory.id");

    if (search.auctionType) {
      filters.push({
        value: search.auctionType,
        operator: "eq",
        type: "string",
        property: "auction.auctionType",
      });
    }

    return filters;
  }

  private pushGroupedFilters(
    filters: ExDrazbyFilterQuery,
    values: number[],
    property: string,
  ): void {
    if (values.length === 0) {
      return;
    }

    if (values.length === 1) {
      filters.push({
        value: String(values[0]),
        operator: "eq",
        type: "int",
        property,
      });
      return;
    }

    filters.push(
      values.map((value) => ({
        value: String(value),
        operator: "eq" as const,
        type: "int" as const,
        property,
      })),
    );
  }

  private parseSearchUrl(url: string): ParsedSearch {
    const parsedUrl = new URL(url);
    const status = this.parseStatusFromPath(parsedUrl.pathname);

    return {
      status,
      page: this.parseInteger(parsedUrl.searchParams.get("page")) ?? 1,
      perPage: this.parseInteger(parsedUrl.searchParams.get("perPage")) ?? 100,
      title: parsedUrl.searchParams.get("title") || undefined,
      priceFrom: this.parseInteger(parsedUrl.searchParams.get("priceFrom")),
      priceTo: this.parseInteger(parsedUrl.searchParams.get("priceTo")),
      mainCategoryId: this.parseInteger(parsedUrl.searchParams.get("mainCategory")),
      subcategoryIds: this.parseIntegerList(
        parsedUrl.searchParams.getAll("subCategories"),
      ),
      regionIds: this.parseIntegerList(parsedUrl.searchParams.getAll("regions")),
      districtIds: this.parseIntegerList(
        parsedUrl.searchParams.getAll("districts"),
      ),
      auctionType: parsedUrl.searchParams.get("auctionType") || undefined,
    };
  }

  private parseStatusFromPath(pathname: string): ParsedSearch["status"] {
    if (pathname.includes("/ukoncene")) {
      return "ended";
    }

    if (pathname.includes("/probihajici")) {
      return "ongoing";
    }

    return "prepared";
  }

  private parseInteger(value: string | null): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseIntegerList(values: string[]): number[] {
    return values
      .map((value) => this.parseInteger(value))
      .filter((value): value is number => typeof value === "number");
  }

  private resolvePriceNumeric(auction: ExDrazbyAuction): number | undefined {
    const winnerBid = auction.winnerBid?.bidPrice;
    if (typeof winnerBid === "number") {
      return winnerBid;
    }

    return typeof auction.minimalBid === "number"
      ? auction.minimalBid
      : undefined;
  }

  private extractImages(auction: ExDrazbyAuction): string[] {
    return (auction.auctionMedia ?? [])
      .map((item) => item.url ?? item.cropImagePath ?? undefined)
      .filter((value): value is string => Boolean(value));
  }

  private resolvePropertyType(auction: ExDrazbyAuction): PropertyType | undefined {
    const title = `${auction.auctionCategory?.parentTitle ?? ""} ${
      auction.auctionCategory?.title ?? ""
    }`.toLowerCase();

    if (title.includes("pozem")) {
      return "land";
    }

    if (title.includes("byt")) {
      return "apartment";
    }

    if (title.includes("dům") || title.includes("dum")) {
      return "house";
    }

    return undefined;
  }

  private extractRooms(title?: string | null): string | undefined {
    return title?.match(/\b\d\+(?:kk|1)\b/i)?.[0];
  }

  private loadDetailPaths(pages: ExDrazbyPage[]): void {
    for (const page of pages) {
      switch (page.routeName) {
        case "auction-detail":
          if (page.fullUrl) {
            this.detailPaths.auction = page.fullUrl;
          }
          break;
        case "auction-public-detail":
          if (page.fullUrl) {
            this.detailPaths.auctionPublic = page.fullUrl;
          }
          break;
        case "auction-public-competition-detail":
          if (page.fullUrl) {
            this.detailPaths.publicCompetition = page.fullUrl;
          }
          break;
      }
    }
  }

  private getDetailUrl(auction: ExDrazbyAuction): string {
    const template =
      auction.auctionType === "auction"
        ? this.detailPaths.auction
        : auction.auctionType === "public_competition"
          ? this.detailPaths.publicCompetition
          : this.detailPaths.auctionPublic;

    return `${EX_DRAZBY_BASE_URL}${template.replace(":id", String(auction.id))}`;
  }

  private normalizeWhitespace(value?: string | null): string | undefined {
    const normalized = value?.replace(/\s+/g, " ").trim();
    return normalized || undefined;
  }

  private getHeaders(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: EX_DRAZBY_BASE_URL,
    };
  }
}
