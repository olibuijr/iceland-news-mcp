#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Parser from "rss-parser";

// =============================================================================
// Feed Configuration
// =============================================================================

interface FeedInfo {
  url: string;
  description: string;
}

interface SourceInfo {
  name: string;
  baseUrl: string;
  feeds: Record<string, FeedInfo>;
}

const SOURCES: Record<string, SourceInfo> = {
  ruv: {
    name: "RÚV (Ríkisútvarpið)",
    baseUrl: "https://www.ruv.is",
    feeds: {
      frettir: { url: "https://www.ruv.is/rss/frettir", description: "All news" },
      innlent: { url: "https://www.ruv.is/rss/innlent", description: "Domestic news" },
      erlent: { url: "https://www.ruv.is/rss/erlent", description: "International news" },
      ithrottir: { url: "https://www.ruv.is/rss/ithrottir", description: "Sports" },
      "menning-og-daegurmal": { url: "https://www.ruv.is/rss/menning-og-daegurmal", description: "Culture & current affairs" },
      audskilid: { url: "https://www.ruv.is/rss/audskilid", description: "Plain language Icelandic" },
      english: { url: "https://www.ruv.is/rss/english", description: "English news" },
      polski: { url: "https://www.ruv.is/rss/polski", description: "Polish news" },
    },
  },
  mbl: {
    name: "Morgunblaðið",
    baseUrl: "https://www.mbl.is",
    feeds: {
      // Main news
      fp: { url: "https://www.mbl.is/feeds/fp/", description: "Front page news" },
      innlent: { url: "https://www.mbl.is/feeds/innlent/", description: "Domestic news" },
      erlent: { url: "https://www.mbl.is/feeds/erlent/", description: "International news" },
      togt: { url: "https://www.mbl.is/feeds/togt/", description: "Tech & science" },
      english: { url: "https://www.mbl.is/feeds/english/", description: "English news" },
      helst: { url: "https://www.mbl.is/feeds/helst/", description: "Top stories" },
      nyjast: { url: "https://www.mbl.is/feeds/nyjast/", description: "Latest news" },
      sjonvarp: { url: "https://www.mbl.is/feeds/sjonvarp/", description: "TV news" },
      // Culture
      menning: { url: "https://www.mbl.is/feeds/menning/", description: "Culture" },
      // Business
      vidskipti: { url: "https://www.mbl.is/feeds/vidskipti/", description: "Business" },
      // Marine/Fishing
      "200milur": { url: "https://www.mbl.is/feeds/200milur/", description: "Marine & fishing" },
      // Sports
      sport: { url: "https://www.mbl.is/feeds/sport/", description: "Sports" },
      fotbolti: { url: "https://www.mbl.is/feeds/fotbolti/", description: "Football" },
      enski: { url: "https://www.mbl.is/feeds/enski/", description: "English Premier League" },
      golf: { url: "https://www.mbl.is/feeds/golf/", description: "Golf" },
      handbolti: { url: "https://www.mbl.is/feeds/handbolti/", description: "Handball" },
      korfubolti: { url: "https://www.mbl.is/feeds/korfubolti/", description: "Basketball" },
      pepsideild: { url: "https://www.mbl.is/feeds/pepsideild/", description: "Pepsi league (Icelandic football)" },
      formula: { url: "https://www.mbl.is/feeds/formula/", description: "Formula 1" },
      hestar: { url: "https://www.mbl.is/feeds/hestar/", description: "Horses" },
      rafithrottir: { url: "https://www.mbl.is/feeds/rafithrottir/", description: "Esports" },
      // People & lifestyle
      folk: { url: "https://www.mbl.is/feeds/folk/", description: "People" },
      verold: { url: "https://www.mbl.is/feeds/verold/", description: "World/Celebrities" },
      // Food & Travel
      matur: { url: "https://www.mbl.is/feeds/matur/", description: "Food" },
      ferdalog: { url: "https://www.mbl.is/feeds/ferdalog/", description: "Travel" },
      // Smartland (lifestyle)
      smartland: { url: "https://www.mbl.is/feeds/smartland/", description: "Smartland" },
      stars: { url: "https://www.mbl.is/feeds/stars/", description: "Celebrities" },
      tiska: { url: "https://www.mbl.is/feeds/tiska/", description: "Fashion" },
      heimili: { url: "https://www.mbl.is/feeds/heimili/", description: "Home & design" },
      utlit: { url: "https://www.mbl.is/feeds/utlit/", description: "Beauty" },
      heilsa: { url: "https://www.mbl.is/feeds/heilsa/", description: "Health & nutrition" },
      frami: { url: "https://www.mbl.is/feeds/frami/", description: "Success stories" },
      samkvaemislifid: { url: "https://www.mbl.is/feeds/samkvaemislifid/", description: "Social life" },
      fjolskyldan: { url: "https://www.mbl.is/feeds/fjolskyldan/", description: "Family" },
      // Cars
      bill: { url: "https://www.mbl.is/feeds/bill/", description: "Cars" },
      // K100
      k100: { url: "https://www.mbl.is/feeds/k100/", description: "K100 radio" },
      // Morgunblaðið newspaper
      "mogginn-idag": { url: "https://www.mbl.is/feeds/mogginn/idag/", description: "Today's paper" },
      "mogginn-featured": { url: "https://www.mbl.is/feeds/mogginn/featured/", description: "Featured articles" },
      "mogginn-leidarar": { url: "https://www.mbl.is/feeds/mogginn/leidarar/", description: "Editorials" },
      "mogginn-sunnudagur": { url: "https://www.mbl.is/feeds/mogginn/sunnudagur/", description: "Sunday edition" },
      "mogginn-netgreinar": { url: "https://www.mbl.is/feeds/mogginn/netgreinar/", description: "Selected articles" },
      // Other
      fasteignir: { url: "https://www.mbl.is/feeds/fasteignir/", description: "Real estate" },
      smaaugl: { url: "https://www.mbl.is/feeds/smaaugl/", description: "Classifieds" },
      blog: { url: "https://www.mbl.is/feeds/blog/", description: "Blog discussions" },
    },
  },
  heimildin: {
    name: "Heimildin",
    baseUrl: "https://heimildin.is",
    feeds: {
      frettir: { url: "https://heimildin.is/rss/", description: "All news" },
    },
  },
  mannlif: {
    name: "Mannlíf",
    baseUrl: "https://mannlif.is",
    feeds: {
      frettir: { url: "https://mannlif.is/rss/", description: "All news" },
    },
  },
  landsbankinn: {
    name: "Landsbankinn",
    baseUrl: "https://www.landsbankinn.is",
    feeds: {
      frettir: { url: "https://www.landsbankinn.is/api/rss", description: "News & announcements" },
    },
  },
  hi: {
    name: "Háskóli Íslands (University of Iceland)",
    baseUrl: "https://hi.is",
    feeds: {
      // University-wide
      frettir: { url: "https://hi.is/frettir/18556/feed", description: "University news" },
      vidburdir: { url: "https://hi.is/vidburdir/18556/feed", description: "University events" },
      // School of Social Sciences
      "felagsvisindasvid-frettir": { url: "https://hi.is/frettir/18551/feed", description: "Social Sciences news" },
      "felagsvisindasvid-vidburdir": { url: "https://hi.is/vidburdir/18551/feed", description: "Social Sciences events" },
      // School of Health Sciences
      "heilbrigdisvisindasvid-frettir": { url: "https://hi.is/frettir/18552/feed", description: "Health Sciences news" },
      "heilbrigdisvisindasvid-vidburdir": { url: "https://hi.is/vidburdir/18552/feed", description: "Health Sciences events" },
      // School of Humanities
      "hugvisindasvid-frettir": { url: "https://hi.is/frettir/18553/feed", description: "Humanities news" },
      "hugvisindasvid-vidburdir": { url: "https://hi.is/vidburdir/18553/feed", description: "Humanities events" },
      // School of Education
      "menntavisindasvid-frettir": { url: "https://hi.is/frettir/18554/feed", description: "Education news" },
      "menntavisindasvid-vidburdir": { url: "https://hi.is/vidburdir/18554/feed", description: "Education events" },
      // School of Engineering and Natural Sciences
      "verkfraedi-natturuvisindasvid-frettir": { url: "https://hi.is/frettir/18555/feed", description: "Engineering & Natural Sciences news" },
      "verkfraedi-natturuvisindasvid-vidburdir": { url: "https://hi.is/vidburdir/18555/feed", description: "Engineering & Natural Sciences events" },
    },
  },
  // Additional Icelandic news sources
  visir: {
    name: "Vísir",
    baseUrl: "https://www.visir.is",
    feeds: {
      frettir: { url: "https://www.visir.is/rss/allt", description: "All news" },
      innlent: { url: "https://www.visir.is/rss/innlent", description: "Domestic news" },
      erlent: { url: "https://www.visir.is/rss/erlent", description: "International news" },
      ithrottir: { url: "https://www.visir.is/rss/ithrottir", description: "Sports" },
      lifid: { url: "https://www.visir.is/rss/lifid", description: "Lifestyle" },
      spilavinir: { url: "https://www.visir.is/rss/spilavinir", description: "Gaming" },
    },
  },
  dv: {
    name: "DV (Dagblaðið Vísir)",
    baseUrl: "https://www.dv.is",
    feeds: {
      frettir: { url: "https://www.dv.is/feed/", description: "All news" },
    },
  },
  stundin: {
    name: "Stundin",
    baseUrl: "https://stundin.is",
    feeds: {
      frettir: { url: "https://stundin.is/rss/", description: "All news" },
    },
  },
  frettabladid: {
    name: "Fréttablaðið",
    baseUrl: "https://www.frettabladid.is",
    feeds: {
      frettir: { url: "https://www.frettabladid.is/rss/", description: "All news" },
    },
  },
  kjarninn: {
    name: "Kjarninn",
    baseUrl: "https://kjarninn.is",
    feeds: {
      frettir: { url: "https://kjarninn.is/rss/", description: "All news" },
    },
  },
  icelandreview: {
    name: "Iceland Review",
    baseUrl: "https://www.icelandreview.com",
    feeds: {
      frettir: { url: "https://www.icelandreview.com/feed/", description: "English news about Iceland" },
    },
  },
  grapevine: {
    name: "Reykjavík Grapevine",
    baseUrl: "https://grapevine.is",
    feeds: {
      frettir: { url: "https://grapevine.is/feed/", description: "English news and culture" },
    },
  },
  vedur: {
    name: "Veðurstofa Íslands (Icelandic Met Office)",
    baseUrl: "https://www.vedur.is",
    feeds: {
      frettir: { url: "https://www.vedur.is/rss/frettir", description: "Weather news and alerts" },
    },
  },
};

type SourceName = keyof typeof SOURCES;

// =============================================================================
// NewsItem Schema (Zod schema for MCP structured content)
// =============================================================================

const NewsItemSchema = z.object({
  title: z.string().describe("News headline"),
  link: z.string().url().describe("URL to full article"),
  description: z.string().describe("Article summary or excerpt"),
  pubDate: z.string().describe("Publication date (ISO 8601)"),
  creator: z.string().nullable().optional().describe("Author name if available"),
  source: z.string().describe("Source identifier (ruv, mbl, etc.)"),
  sourceName: z.string().describe("Human-readable source name"),
  feed: z.string().describe("Feed identifier within the source"),
  feedDescription: z.string().describe("Human-readable feed description"),
});

const NewsResponseSchema = z.object({
  source: z.string(),
  sourceName: z.string(),
  feed: z.string(),
  feedDescription: z.string(),
  fetchedAt: z.string(),
  count: z.number(),
  items: z.array(NewsItemSchema),
});

type NewsItem = z.infer<typeof NewsItemSchema>;
type NewsResponse = z.infer<typeof NewsResponseSchema>;

// =============================================================================
// Caching with Stats
// =============================================================================

interface CacheEntry {
  data: NewsResponse;
  expires: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;

function getCacheKey(source: string, feed: string): string {
  return `${source}:${feed}`;
}

function getFromCache(source: string, feed: string): NewsResponse | null {
  const key = getCacheKey(source, feed);
  const entry = cache.get(key);

  if (!entry) {
    cacheMisses++;
    return null;
  }

  if (Date.now() > entry.expires) {
    cache.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  return entry.data;
}

function setCache(source: string, feed: string, data: NewsResponse): void {
  const key = getCacheKey(source, feed);
  const now = Date.now();
  cache.set(key, {
    data,
    expires: now + CACHE_TTL,
    createdAt: now,
  });
}

function getCacheStats(): CacheStats {
  let oldestEntry: number | null = null;
  let newestEntry: number | null = null;

  for (const entry of cache.values()) {
    if (oldestEntry === null || entry.createdAt < oldestEntry) {
      oldestEntry = entry.createdAt;
    }
    if (newestEntry === null || entry.createdAt > newestEntry) {
      newestEntry = entry.createdAt;
    }
  }

  return {
    hits: cacheHits,
    misses: cacheMisses,
    entries: cache.size,
    oldestEntry,
    newestEntry,
  };
}

function clearCache(): void {
  cache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

// =============================================================================
// News Fetching
// =============================================================================

const parser = new Parser({
  customFields: {
    item: ["dc:creator"],
  },
});

async function fetchNews(
  source: SourceName,
  feed: string,
  limit: number = 10,
  useCache: boolean = true
): Promise<NewsResponse> {
  const sourceInfo = SOURCES[source];
  const feedInfo = sourceInfo.feeds[feed];

  if (!feedInfo) {
    throw new Error(`Unknown feed "${feed}" for source "${source}"`);
  }

  // Check cache first (cache stores max items, we slice later)
  if (useCache) {
    const cached = getFromCache(source, feed);
    if (cached) {
      // Return cached data with limit applied
      return {
        ...cached,
        count: Math.min(cached.items.length, limit),
        items: cached.items.slice(0, limit),
      };
    }
  }

  const result = await parser.parseURL(feedInfo.url);
  const fetchedAt = new Date().toISOString();

  // Fetch more items for cache (up to 50)
  const maxItems = 50;
  const items: NewsItem[] = result.items.slice(0, maxItems).map((item) => ({
    title: item.title || "No title",
    link: item.link || "",
    description: item.contentSnippet || item.content || "No description",
    pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : fetchedAt,
    creator: (item["dc:creator"] as string | undefined) || null,
    source,
    sourceName: sourceInfo.name,
    feed,
    feedDescription: feedInfo.description,
  }));

  const fullResponse: NewsResponse = {
    source,
    sourceName: sourceInfo.name,
    feed,
    feedDescription: feedInfo.description,
    fetchedAt,
    count: items.length,
    items,
  };

  // Store full response in cache
  setCache(source, feed, fullResponse);

  // Return with requested limit
  return {
    ...fullResponse,
    count: Math.min(items.length, limit),
    items: items.slice(0, limit),
  };
}

// Helper to format news as markdown (for backwards compatibility)
function formatNewsAsMarkdown(response: NewsResponse): string {
  const header = `# ${response.feedDescription} from ${response.sourceName}\n\n` +
    `*Fetched: ${response.fetchedAt} | ${response.count} items*\n\n`;

  const items = response.items
    .map(
      (item, i) =>
        `## ${i + 1}. ${item.title}\n` +
        `**Published:** ${item.pubDate}\n` +
        (item.creator ? `**Author:** ${item.creator}\n` : "") +
        `**Link:** ${item.link}\n\n` +
        `${item.description}\n`
    )
    .join("\n---\n\n");

  return header + items;
}

// =============================================================================
// MCP Server
// =============================================================================

const server = new McpServer({
  name: "iceland-news",
  version: "2.1.0",
});

const sourceNames = Object.keys(SOURCES) as [SourceName, ...SourceName[]];

// =============================================================================
// MCP Resources - Expose feeds as structured, discoverable data
// =============================================================================

// Resource template for dynamic feed access: news://{source}/{feed}
server.resource(
  "news-feed",
  new ResourceTemplate("news://{source}/{feed}", {
    list: async () => {
      // Generate resource list for all feeds
      const resources: Array<{
        uri: string;
        name: string;
        description: string;
        mimeType: string;
      }> = [];

      for (const [sourceKey, sourceInfo] of Object.entries(SOURCES)) {
        for (const [feedKey, feedInfo] of Object.entries(sourceInfo.feeds)) {
          resources.push({
            uri: `news://${sourceKey}/${feedKey}`,
            name: `${sourceInfo.name} - ${feedInfo.description}`,
            description: `RSS feed: ${feedInfo.description} from ${sourceInfo.name}`,
            mimeType: "application/json",
          });
        }
      }

      return { resources };
    },
    complete: {
      source: async () => Object.keys(SOURCES),
      feed: async (value, context) => {
        const source = context?.arguments?.source;
        if (source && SOURCES[source]) {
          return Object.keys(SOURCES[source].feeds);
        }
        // Return all feeds from all sources
        const allFeeds = new Set<string>();
        for (const sourceInfo of Object.values(SOURCES)) {
          for (const feedKey of Object.keys(sourceInfo.feeds)) {
            allFeeds.add(feedKey);
          }
        }
        return Array.from(allFeeds);
      },
    },
  }),
  async (uri: URL, variables: Record<string, string | string[]>) => {
    try {
      const source = Array.isArray(variables.source) ? variables.source[0] : variables.source;
      const feed = Array.isArray(variables.feed) ? variables.feed[0] : variables.feed;
      const newsResponse = await fetchNews(source as SourceName, feed, 20);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(newsResponse, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `Error fetching feed: ${message}`,
          },
        ],
      };
    }
  }
);

// =============================================================================
// MCP Tools - Dynamic queries with structured output
// =============================================================================

server.registerTool(
  "get_news",
  {
    description: "Fetch the latest Icelandic news from various sources including RÚV, Morgunblaðið, Vísir, Stundin, and more. Supports date filtering. Returns structured NewsItem data.",
    inputSchema: {
      source: z
        .enum(sourceNames)
        .default("ruv")
        .describe("News source: ruv, mbl, visir, dv, stundin, frettabladid, kjarninn, heimildin, mannlif, landsbankinn, hi, icelandreview, grapevine, vedur"),
      feed: z
        .string()
        .default("frettir")
        .describe(
          "The feed to fetch. Most sources have 'frettir' (news). " +
          "RÚV: frettir, innlent, erlent, ithrottir, english, polski. " +
          "MBL: fp, innlent, erlent, sport, vidskipti, and 30+ more. " +
          "Vísir: frettir, innlent, erlent, ithrottir, lifid. " +
          "Use list_feeds tool to see all available feeds."
        ),
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe("Maximum number of news items to return (1-50)"),
      format: z
        .enum(["structured", "markdown", "both"])
        .default("both")
        .describe("Output format: 'structured' for JSON, 'markdown' for readable text, 'both' for both"),
      since: z
        .string()
        .optional()
        .describe("Only return articles published after this date/time. Accepts ISO 8601 format or relative like 'today', 'yesterday', '1 hour ago', '3 days ago'"),
      until: z
        .string()
        .optional()
        .describe("Only return articles published before this date/time. Accepts ISO 8601 format or relative like 'today', 'yesterday', '1 hour ago'"),
    },
    outputSchema: NewsResponseSchema,
  },
  async ({ source, feed, limit, format, since, until }) => {
    try {
      const sourceInfo = SOURCES[source];

      // Validate feed exists for source
      if (!sourceInfo.feeds[feed]) {
        const availableFeeds = Object.entries(sourceInfo.feeds)
          .map(([key, info]) => `${key} (${info.description})`)
          .join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown feed "${feed}" for ${sourceInfo.name}.\n\nAvailable feeds: ${availableFeeds}`,
            },
          ],
          isError: true,
        };
      }

      // Fetch more items to allow for filtering
      const fetchLimit = (since || until) ? 50 : limit;
      let newsResponse = await fetchNews(source, feed, fetchLimit);

      // Parse relative date strings
      const parseDate = (dateStr: string): Date | null => {
        if (!dateStr) return null;

        const now = new Date();
        const lower = dateStr.toLowerCase().trim();

        if (lower === 'today') {
          return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        if (lower === 'yesterday') {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          d.setDate(d.getDate() - 1);
          return d;
        }

        // Match patterns like "1 hour ago", "3 days ago", "2 weeks ago"
        const relativeMatch = lower.match(/^(\d+)\s*(hour|hours|day|days|week|weeks|minute|minutes)\s*ago$/);
        if (relativeMatch) {
          const amount = parseInt(relativeMatch[1]);
          const unit = relativeMatch[2];
          const d = new Date(now);

          if (unit.startsWith('minute')) d.setMinutes(d.getMinutes() - amount);
          else if (unit.startsWith('hour')) d.setHours(d.getHours() - amount);
          else if (unit.startsWith('day')) d.setDate(d.getDate() - amount);
          else if (unit.startsWith('week')) d.setDate(d.getDate() - (amount * 7));

          return d;
        }

        // Try parsing as ISO date
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
      };

      // Apply date filtering
      const sinceDate = since ? parseDate(since) : null;
      const untilDate = until ? parseDate(until) : null;

      if (sinceDate || untilDate) {
        newsResponse = {
          ...newsResponse,
          items: newsResponse.items.filter(item => {
            const itemDate = new Date(item.pubDate);
            if (sinceDate && itemDate < sinceDate) return false;
            if (untilDate && itemDate > untilDate) return false;
            return true;
          }).slice(0, limit),
          count: 0, // Will be updated below
        };
        newsResponse.count = newsResponse.items.length;
      }

      // Build response based on format preference
      const content: Array<{ type: "text"; text: string }> = [];

      if (format === "markdown" || format === "both") {
        content.push({
          type: "text" as const,
          text: formatNewsAsMarkdown(newsResponse),
        });
      }

      if (format === "structured" || format === "both") {
        content.push({
          type: "text" as const,
          text: "```json\n" + JSON.stringify(newsResponse, null, 2) + "\n```",
        });
      }

      return {
        content,
        structuredContent: newsResponse,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching news: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

const FeedListResponseSchema = z.object({
  sources: z.array(z.object({
    source: z.string(),
    sourceName: z.string(),
    baseUrl: z.string(),
    feeds: z.array(z.object({
      id: z.string(),
      description: z.string(),
      resourceUri: z.string(),
    })),
  })),
  totalFeeds: z.number(),
});

server.registerTool(
  "list_feeds",
  {
    description: "List all available news feeds from Icelandic news sources. Returns structured feed metadata.",
    inputSchema: {
      source: z
        .enum([...sourceNames, "all"] as [string, ...string[]])
        .default("all")
        .describe("News source to list feeds for: ruv, mbl, heimildin, mannlif, landsbankinn, hi, or all"),
    },
    outputSchema: FeedListResponseSchema,
  },
  async ({ source }) => {
    const sourcesToList = source === "all" ? sourceNames : [source as SourceName];

    // Build structured response
    const feedList: Array<{
      source: string;
      sourceName: string;
      baseUrl: string;
      feeds: Array<{
        id: string;
        description: string;
        resourceUri: string;
      }>;
    }> = [];

    let markdownOutput = "";

    for (const src of sourcesToList) {
      const sourceInfo = SOURCES[src];

      const feeds = Object.entries(sourceInfo.feeds).map(([feedKey, feedInfo]) => ({
        id: feedKey,
        description: feedInfo.description,
        resourceUri: `news://${src}/${feedKey}`,
      }));

      feedList.push({
        source: src,
        sourceName: sourceInfo.name,
        baseUrl: sourceInfo.baseUrl,
        feeds,
      });

      // Markdown format
      markdownOutput += `# ${sourceInfo.name}\n\n`;
      markdownOutput += `| Feed | Description | Resource URI |\n|------|-------------|---------------|\n`;

      for (const feed of feeds) {
        markdownOutput += `| \`${feed.id}\` | ${feed.description} | \`${feed.resourceUri}\` |\n`;
      }

      markdownOutput += "\n";
    }

    const structuredResponse = {
      sources: feedList,
      totalFeeds: feedList.reduce((sum, s) => sum + s.feeds.length, 0),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: markdownOutput,
        },
      ],
      structuredContent: structuredResponse,
    };
  }
);

// =============================================================================
// Additional Tools - Search, Health Check, Cache Stats
// =============================================================================

// Search results schema
const SearchResultSchema = z.object({
  query: z.string(),
  searchedAt: z.string(),
  sourcesSearched: z.number(),
  totalMatches: z.number(),
  items: z.array(NewsItemSchema),
});

server.registerTool(
  "search_news",
  {
    description: "Search across all Icelandic news sources for articles matching a keyword or phrase. Searches titles and descriptions.",
    inputSchema: {
      query: z
        .string()
        .describe("The search query - keyword or phrase to find in news articles"),
      sources: z
        .array(z.string())
        .optional()
        .describe("Specific sources to search (e.g., ['ruv', 'mbl']). If not specified, searches all sources."),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximum number of results to return (1-100)"),
      caseSensitive: z
        .boolean()
        .default(false)
        .describe("Whether to perform case-sensitive search"),
    },
    outputSchema: SearchResultSchema,
  },
  async ({ query, sources, limit, caseSensitive }) => {
    const searchedAt = new Date().toISOString();
    const sourcesToSearch = sources && sources.length > 0
      ? sources.filter(s => s in SOURCES) as SourceName[]
      : (Object.keys(SOURCES) as SourceName[]);

    const allMatches: NewsItem[] = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    // Search through each source's main feed
    for (const source of sourcesToSearch) {
      try {
        // Get main feed (usually 'frettir' or 'fp')
        const feeds = Object.keys(SOURCES[source].feeds);
        const mainFeed = feeds.includes('frettir') ? 'frettir' : feeds[0];

        const response = await fetchNews(source, mainFeed, 50);

        for (const item of response.items) {
          const titleToSearch = caseSensitive ? item.title : item.title.toLowerCase();
          const descToSearch = caseSensitive ? item.description : item.description.toLowerCase();

          if (titleToSearch.includes(searchQuery) || descToSearch.includes(searchQuery)) {
            allMatches.push(item);
          }
        }
      } catch {
        // Skip sources that fail
        continue;
      }
    }

    // Sort by date (newest first) and limit
    allMatches.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const results = allMatches.slice(0, limit);

    const searchResult = {
      query,
      searchedAt,
      sourcesSearched: sourcesToSearch.length,
      totalMatches: results.length,
      items: results,
    };

    // Format as markdown
    let markdown = `# Search Results for "${query}"\n\n`;
    markdown += `*Searched ${sourcesToSearch.length} sources at ${searchedAt} | Found ${results.length} matches*\n\n`;

    if (results.length === 0) {
      markdown += "No articles found matching your search query.\n";
    } else {
      for (const item of results) {
        markdown += `## ${item.title}\n`;
        markdown += `**Source:** ${item.sourceName} | **Published:** ${item.pubDate}\n`;
        markdown += `**Link:** ${item.link}\n\n`;
        markdown += `${item.description}\n\n---\n\n`;
      }
    }

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent: searchResult,
    };
  }
);

// Feed health check schema
const FeedHealthSchema = z.object({
  checkedAt: z.string(),
  totalFeeds: z.number(),
  healthyFeeds: z.number(),
  failedFeeds: z.number(),
  results: z.array(z.object({
    source: z.string(),
    sourceName: z.string(),
    feed: z.string(),
    feedDescription: z.string(),
    status: z.enum(["healthy", "failed"]),
    itemCount: z.number().optional(),
    error: z.string().optional(),
    responseTimeMs: z.number().optional(),
  })),
});

server.registerTool(
  "check_feeds",
  {
    description: "Check the health and availability of RSS feeds. Useful for debugging and monitoring.",
    inputSchema: {
      sources: z
        .array(z.string())
        .optional()
        .describe("Specific sources to check. If not specified, checks all sources."),
      timeout: z
        .number()
        .min(1000)
        .max(30000)
        .default(10000)
        .describe("Timeout in milliseconds for each feed check (1000-30000)"),
    },
    outputSchema: FeedHealthSchema,
  },
  async ({ sources, timeout }) => {
    const checkedAt = new Date().toISOString();
    const sourcesToCheck = sources && sources.length > 0
      ? sources.filter(s => s in SOURCES) as SourceName[]
      : (Object.keys(SOURCES) as SourceName[]);

    const results: Array<{
      source: string;
      sourceName: string;
      feed: string;
      feedDescription: string;
      status: "healthy" | "failed";
      itemCount?: number;
      error?: string;
      responseTimeMs?: number;
    }> = [];

    for (const source of sourcesToCheck) {
      const sourceInfo = SOURCES[source];

      for (const [feedKey, feedInfo] of Object.entries(sourceInfo.feeds)) {
        const startTime = Date.now();

        try {
          // Use AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetchNews(source, feedKey, 5, false);
          clearTimeout(timeoutId);

          results.push({
            source,
            sourceName: sourceInfo.name,
            feed: feedKey,
            feedDescription: feedInfo.description,
            status: "healthy",
            itemCount: response.count,
            responseTimeMs: Date.now() - startTime,
          });
        } catch (error) {
          results.push({
            source,
            sourceName: sourceInfo.name,
            feed: feedKey,
            feedDescription: feedInfo.description,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
            responseTimeMs: Date.now() - startTime,
          });
        }
      }
    }

    const healthyFeeds = results.filter(r => r.status === "healthy").length;
    const failedFeeds = results.filter(r => r.status === "failed").length;

    const healthResult = {
      checkedAt,
      totalFeeds: results.length,
      healthyFeeds,
      failedFeeds,
      results,
    };

    // Format as markdown
    let markdown = `# Feed Health Check\n\n`;
    markdown += `*Checked at ${checkedAt}*\n\n`;
    markdown += `| Status | Count |\n|--------|-------|\n`;
    markdown += `| ✅ Healthy | ${healthyFeeds} |\n`;
    markdown += `| ❌ Failed | ${failedFeeds} |\n`;
    markdown += `| Total | ${results.length} |\n\n`;

    if (failedFeeds > 0) {
      markdown += `## Failed Feeds\n\n`;
      for (const result of results.filter(r => r.status === "failed")) {
        markdown += `- **${result.sourceName}** / ${result.feedDescription}: ${result.error}\n`;
      }
      markdown += "\n";
    }

    markdown += `## All Results\n\n`;
    markdown += `| Source | Feed | Status | Items | Time (ms) |\n|--------|------|--------|-------|------------|\n`;
    for (const result of results) {
      const status = result.status === "healthy" ? "✅" : "❌";
      const items = result.itemCount ?? "-";
      const time = result.responseTimeMs ?? "-";
      markdown += `| ${result.sourceName} | ${result.feed} | ${status} | ${items} | ${time} |\n`;
    }

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent: healthResult,
    };
  }
);

// Cache stats schema
const CacheStatsSchema = z.object({
  hits: z.number(),
  misses: z.number(),
  hitRate: z.number(),
  entries: z.number(),
  ttlMinutes: z.number(),
  oldestEntryAge: z.number().nullable(),
  newestEntryAge: z.number().nullable(),
});

server.registerTool(
  "cache_stats",
  {
    description: "Get cache statistics including hit/miss rates and entry counts. Useful for monitoring performance.",
    inputSchema: {
      clearCache: z
        .boolean()
        .default(false)
        .describe("If true, clears the cache after returning stats"),
    },
    outputSchema: CacheStatsSchema,
  },
  async ({ clearCache: shouldClear }) => {
    const stats = getCacheStats();
    const now = Date.now();

    const hitRate = stats.hits + stats.misses > 0
      ? (stats.hits / (stats.hits + stats.misses)) * 100
      : 0;

    const oldestAge = stats.oldestEntry ? Math.round((now - stats.oldestEntry) / 1000) : null;
    const newestAge = stats.newestEntry ? Math.round((now - stats.newestEntry) / 1000) : null;

    const cacheStatsResult = {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      entries: stats.entries,
      ttlMinutes: CACHE_TTL / 60000,
      oldestEntryAge: oldestAge,
      newestEntryAge: newestAge,
    };

    let markdown = `# Cache Statistics\n\n`;
    markdown += `| Metric | Value |\n|--------|-------|\n`;
    markdown += `| Cache Hits | ${stats.hits} |\n`;
    markdown += `| Cache Misses | ${stats.misses} |\n`;
    markdown += `| Hit Rate | ${cacheStatsResult.hitRate}% |\n`;
    markdown += `| Cached Entries | ${stats.entries} |\n`;
    markdown += `| TTL | ${CACHE_TTL / 60000} minutes |\n`;
    markdown += `| Oldest Entry Age | ${oldestAge !== null ? `${oldestAge}s` : "N/A"} |\n`;
    markdown += `| Newest Entry Age | ${newestAge !== null ? `${newestAge}s` : "N/A"} |\n`;

    if (shouldClear) {
      clearCache();
      markdown += `\n*Cache has been cleared.*\n`;
    }

    return {
      content: [{ type: "text" as const, text: markdown }],
      structuredContent: cacheStatsResult,
    };
  }
);

// =============================================================================
// MCP Prompts - Pre-built templates for common queries
// =============================================================================

// Language instruction that ensures responses match the user's language
const LANGUAGE_INSTRUCTION = `
IMPORTANT: Always respond in the same language the user is speaking.
If the user asks in Icelandic, respond in Icelandic.
If the user asks in English, respond in English.
If the user asks in German, respond in German.
Match the user's language exactly.
`;

server.prompt(
  "daily-briefing",
  "Get a daily briefing of top Icelandic news headlines. Responds in your language.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${LANGUAGE_INSTRUCTION}

You are a news assistant for Icelandic news. Please provide a daily briefing with the most important headlines from Iceland.

Use the get_news tool to fetch news from these sources:
1. RÚV (ruv) - frettir feed for national news
2. Morgunblaðið (mbl) - fp feed for front page news

Summarize the top 5 most important stories across both sources. Group related stories together.
Present the briefing in a clear, organized format with:
- A brief headline for each story
- 1-2 sentence summary
- The source

End with any notable trends or themes you notice in today's news.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "topic-summary",
  "Get a summary of news about a specific topic. Responds in your language.",
  {
    topic: z.string().describe("The topic to search for in the news"),
  },
  async ({ topic }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${LANGUAGE_INSTRUCTION}

You are a news research assistant for Icelandic news. Please find and summarize all recent news about: "${topic}"

Use the get_news tool to search through multiple sources:
1. RÚV (ruv) - frettir feed
2. Morgunblaðið (mbl) - fp and nyjast feeds
3. Heimildin (heimildin) - frettir feed

Look through the headlines and descriptions for any mentions of "${topic}" or related terms.

Provide:
1. A summary of the main developments related to this topic
2. List of relevant articles found (title, source, date)
3. Any different perspectives or angles from different sources
4. Timeline of events if applicable

If no news is found about this topic, let the user know and suggest related topics that might have coverage.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "compare-sources",
  "Compare how different Icelandic news sources cover a topic. Responds in your language.",
  {
    topic: z.string().describe("The topic to compare coverage of"),
  },
  async ({ topic }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${LANGUAGE_INSTRUCTION}

You are a media analyst comparing Icelandic news coverage. Please compare how different sources are covering: "${topic}"

Use the get_news tool to fetch from these sources:
1. RÚV (ruv) - the national broadcaster (frettir feed)
2. Morgunblaðið (mbl) - major newspaper (fp feed)
3. Heimildin (heimildin) - independent news (frettir feed)

For each source, analyze:
1. How prominently they cover this topic (if at all)
2. The angle or framing they use
3. Key quotes or facts they emphasize
4. Any notable differences in coverage

Provide a balanced comparison highlighting:
- Areas of agreement between sources
- Notable differences in perspective or emphasis
- Any information unique to one source
- Overall assessment of coverage balance`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "sports-update",
  "Get the latest Icelandic sports news. Responds in your language.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${LANGUAGE_INSTRUCTION}

You are a sports news reporter covering Icelandic sports. Please provide a comprehensive sports update.

Use the get_news tool to fetch from:
1. RÚV (ruv) - ithrottir feed (sports)
2. Morgunblaðið (mbl) - sport feed
3. Morgunblaðið (mbl) - fotbolti feed (football)
4. Morgunblaðið (mbl) - handbolti feed (handball)

Organize the update by sport:
- Football (Icelandic league and national team)
- Handball
- Other sports

For each major story provide:
- What happened
- Key players/teams involved
- Scores or results if applicable
- What's coming up next

Include any breaking news or major upcoming events.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "business-finance",
  "Get the latest Icelandic business and financial news. Responds in your language.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `${LANGUAGE_INSTRUCTION}

You are a financial news analyst covering the Icelandic economy. Please provide a business and finance update.

Use the get_news tool to fetch from:
1. Morgunblaðið (mbl) - vidskipti feed (business)
2. Landsbankinn (landsbankinn) - frettir feed (bank news/economic analysis)
3. RÚV (ruv) - frettir feed (for any major economic news)

Cover:
1. Market movements and economic indicators
2. Major business news (mergers, expansions, layoffs)
3. Banking and finance sector updates
4. Real estate and property market
5. Tourism and key industries

Highlight any news that could affect:
- The Icelandic króna
- Interest rates
- Employment
- Cost of living`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "english-news",
  "Get Icelandic news available in English. Perfect for non-Icelandic speakers.",
  async () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `You are a news assistant helping English speakers stay informed about Iceland.

Use the get_news tool to fetch English-language news from:
1. RÚV (ruv) - english feed
2. Morgunblaðið (mbl) - english feed

These are official English translations/versions from Icelandic media.

Provide a summary of:
1. Top headlines available in English
2. Brief summary of each major story
3. Any stories that might be of particular interest to tourists or expats

Note: These English feeds may have fewer stories than the Icelandic versions. For comprehensive coverage, the Icelandic feeds have more content.`,
          },
        },
      ],
    };
  }
);

// =============================================================================
// Main
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Iceland News MCP server v2.1.0 running on stdio");
  console.error(`Sources: ${Object.keys(SOURCES).length} (${Object.keys(SOURCES).join(", ")})`);
  console.error("Resources: news://{source}/{feed} - Structured RSS feed data");
  console.error("Tools: get_news, list_feeds, search_news, check_feeds, cache_stats");
  console.error("Prompts: daily-briefing, topic-summary, compare-sources, sports-update, business-finance, english-news");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
