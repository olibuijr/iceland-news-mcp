#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
};

type SourceName = keyof typeof SOURCES;

// =============================================================================
// News Fetching
// =============================================================================

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  creator?: string;
}

const parser = new Parser({
  customFields: {
    item: ["dc:creator"],
  },
});

async function fetchNews(
  source: SourceName,
  feed: string,
  limit: number = 10
): Promise<NewsItem[]> {
  const sourceInfo = SOURCES[source];
  const feedInfo = sourceInfo.feeds[feed];

  if (!feedInfo) {
    throw new Error(`Unknown feed "${feed}" for source "${source}"`);
  }

  const result = await parser.parseURL(feedInfo.url);

  return result.items.slice(0, limit).map((item) => ({
    title: item.title || "No title",
    link: item.link || "",
    description: item.contentSnippet || item.content || "No description",
    pubDate: item.pubDate || "",
    creator: item["dc:creator"] as string | undefined,
  }));
}

// =============================================================================
// MCP Server
// =============================================================================

const server = new McpServer({
  name: "iceland-news",
  version: "1.0.0",
});

const sourceNames = Object.keys(SOURCES) as [SourceName, ...SourceName[]];

// Helper to get all feed names for a source
function getFeedNames(source: SourceName): string[] {
  return Object.keys(SOURCES[source].feeds);
}

// Helper to get feed description
function getFeedDescription(source: SourceName, feed: string): string {
  return SOURCES[source].feeds[feed]?.description || feed;
}

server.tool(
  "get_news",
  "Fetch the latest Icelandic news from various sources including RÚV, Morgunblaðið, Heimildin, Mannlíf, Landsbankinn, and University of Iceland",
  {
    source: z
      .enum(sourceNames)
      .default("ruv")
      .describe("News source: ruv, mbl, heimildin, mannlif, landsbankinn, or hi (University of Iceland)"),
    feed: z
      .string()
      .default("frettir")
      .describe(
        "The feed to fetch. Most sources have 'frettir' (news). " +
        "RÚV: frettir, innlent, erlent, ithrottir, english, polski. " +
        "MBL: fp, innlent, erlent, sport, vidskipti, and 30+ more. " +
        "HI: frettir, vidburdir, plus feeds for each school. " +
        "Use list_feeds tool to see all available feeds."
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(10)
      .describe("Maximum number of news items to return (1-50)"),
  },
  async ({ source, feed, limit }) => {
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

      const news = await fetchNews(source, feed, limit);
      const feedDescription = getFeedDescription(source, feed);

      const formatted = news
        .map(
          (item, i) =>
            `## ${i + 1}. ${item.title}\n` +
            `**Published:** ${item.pubDate}\n` +
            (item.creator ? `**Author:** ${item.creator}\n` : "") +
            `**Link:** ${item.link}\n\n` +
            `${item.description}\n`
        )
        .join("\n---\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `# ${feedDescription} from ${sourceInfo.name}\n\n${formatted}`,
          },
        ],
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

server.tool(
  "list_feeds",
  "List all available news feeds from Icelandic news sources",
  {
    source: z
      .enum([...sourceNames, "all"] as [string, ...string[]])
      .default("all")
      .describe("News source to list feeds for: ruv, mbl, heimildin, mannlif, landsbankinn, hi, or all"),
  },
  async ({ source }) => {
    let output = "";

    const sourcesToList = source === "all" ? sourceNames : [source as SourceName];

    for (const src of sourcesToList) {
      const sourceInfo = SOURCES[src];
      output += `# ${sourceInfo.name}\n\n`;
      output += `| Feed | Description |\n|------|-------------|\n`;

      for (const [feedKey, feedInfo] of Object.entries(sourceInfo.feeds)) {
        output += `| \`${feedKey}\` | ${feedInfo.description} |\n`;
      }

      output += "\n";
    }

    return {
      content: [
        {
          type: "text" as const,
          text: output,
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
  console.error("Iceland News MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
