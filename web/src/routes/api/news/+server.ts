import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Parser from 'rss-parser';

// Feed configuration (matching the MCP server)
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
		name: 'RÚV (Ríkisútvarpið)',
		baseUrl: 'https://www.ruv.is',
		feeds: {
			frettir: { url: 'https://www.ruv.is/rss/frettir', description: 'All news' },
			innlent: { url: 'https://www.ruv.is/rss/innlent', description: 'Domestic news' },
			erlent: { url: 'https://www.ruv.is/rss/erlent', description: 'International news' },
			ithrottir: { url: 'https://www.ruv.is/rss/ithrottir', description: 'Sports' },
			'menning-og-daegurmal': {
				url: 'https://www.ruv.is/rss/menning-og-daegurmal',
				description: 'Culture & current affairs'
			},
			english: { url: 'https://www.ruv.is/rss/english', description: 'English news' }
		}
	},
	mbl: {
		name: 'Morgunblaðið',
		baseUrl: 'https://www.mbl.is',
		feeds: {
			fp: { url: 'https://www.mbl.is/feeds/fp/', description: 'Front page news' },
			innlent: { url: 'https://www.mbl.is/feeds/innlent/', description: 'Domestic news' },
			erlent: { url: 'https://www.mbl.is/feeds/erlent/', description: 'International news' },
			sport: { url: 'https://www.mbl.is/feeds/sport/', description: 'Sports' },
			vidskipti: { url: 'https://www.mbl.is/feeds/vidskipti/', description: 'Business' },
			menning: { url: 'https://www.mbl.is/feeds/menning/', description: 'Culture' },
			english: { url: 'https://www.mbl.is/feeds/english/', description: 'English news' }
		}
	},
	visir: {
		name: 'Vísir',
		baseUrl: 'https://www.visir.is',
		feeds: {
			frettir: { url: 'https://www.visir.is/rss/allar', description: 'All news' }
		}
	},
	heimildin: {
		name: 'Heimildin',
		baseUrl: 'https://heimildin.is',
		feeds: {
			frettir: { url: 'https://heimildin.is/rss/', description: 'All news' }
		}
	}
};

const parser = new Parser({
	customFields: {
		item: ['dc:creator']
	}
});

interface NewsItem {
	title: string;
	link: string;
	description: string;
	pubDate: string;
	source: string;
	feed: string;
}

async function fetchNews(
	source: string,
	feed: string,
	limit: number = 5
): Promise<NewsItem[]> {
	const sourceInfo = SOURCES[source];
	if (!sourceInfo) {
		throw new Error(`Unknown source: ${source}`);
	}

	const feedInfo = sourceInfo.feeds[feed];
	if (!feedInfo) {
		throw new Error(`Unknown feed "${feed}" for source "${source}"`);
	}

	try {
		const result = await parser.parseURL(feedInfo.url);
		return result.items.slice(0, limit).map((item) => ({
			title: item.title || 'No title',
			link: item.link || '',
			description: item.contentSnippet || item.content || 'No description',
			pubDate: item.pubDate || '',
			source: sourceInfo.name,
			feed: feedInfo.description
		}));
	} catch (error) {
		console.error(`Error fetching ${source}/${feed}:`, error);
		return [];
	}
}

async function fetchAllNews(limit: number = 3): Promise<NewsItem[]> {
	const allNews: NewsItem[] = [];

	// Fetch from main sources in parallel
	const fetches = [
		fetchNews('ruv', 'frettir', limit),
		fetchNews('mbl', 'fp', limit),
		fetchNews('heimildin', 'frettir', limit)
	];

	const results = await Promise.all(fetches);
	for (const news of results) {
		allNews.push(...news);
	}

	// Sort by date (newest first)
	allNews.sort((a, b) => {
		const dateA = new Date(a.pubDate).getTime() || 0;
		const dateB = new Date(b.pubDate).getTime() || 0;
		return dateB - dateA;
	});

	return allNews.slice(0, limit * 3);
}

async function fetchNewsByCategory(category: string, limit: number = 5): Promise<NewsItem[]> {
	const allNews: NewsItem[] = [];

	// Map category to feeds
	const categoryFeeds: Record<string, Array<{ source: string; feed: string }>> = {
		'ithrottir': [
			{ source: 'ruv', feed: 'ithrottir' },
			{ source: 'mbl', feed: 'sport' }
		],
		'sport': [
			{ source: 'ruv', feed: 'ithrottir' },
			{ source: 'mbl', feed: 'sport' }
		],
		'innlent': [
			{ source: 'ruv', feed: 'innlent' },
			{ source: 'mbl', feed: 'innlent' }
		],
		'erlent': [
			{ source: 'ruv', feed: 'erlent' },
			{ source: 'mbl', feed: 'erlent' }
		],
		'vidskipti': [
			{ source: 'mbl', feed: 'vidskipti' }
		],
		'menning': [
			{ source: 'ruv', feed: 'menning-og-daegurmal' },
			{ source: 'mbl', feed: 'menning' }
		]
	};

	const feeds = categoryFeeds[category.toLowerCase()] || [];

	if (feeds.length === 0) {
		// Default to all news
		return fetchAllNews(limit);
	}

	const fetches = feeds.map(f => fetchNews(f.source, f.feed, limit));
	const results = await Promise.all(fetches);

	for (const news of results) {
		allNews.push(...news);
	}

	// Sort by date
	allNews.sort((a, b) => {
		const dateA = new Date(a.pubDate).getTime() || 0;
		const dateB = new Date(b.pubDate).getTime() || 0;
		return dateB - dateA;
	});

	return allNews.slice(0, limit * 2);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, source, feed, category, limit = 5 } = body;

		let news: NewsItem[] = [];

		switch (action) {
			case 'get_news':
				if (source && feed) {
					news = await fetchNews(source, feed, limit);
				} else {
					news = await fetchAllNews(limit);
				}
				break;

			case 'get_news_by_category':
				news = await fetchNewsByCategory(category || 'frettir', limit);
				break;

			case 'get_all_news':
				news = await fetchAllNews(limit);
				break;

			case 'list_sources':
				return json({
					sources: Object.entries(SOURCES).map(([key, info]) => ({
						id: key,
						name: info.name,
						feeds: Object.entries(info.feeds).map(([feedKey, feedInfo]) => ({
							id: feedKey,
							description: feedInfo.description
						}))
					}))
				});

			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}

		return json({ news });
	} catch (error) {
		console.error('News API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	const source = url.searchParams.get('source');
	const feed = url.searchParams.get('feed') || 'frettir';
	const category = url.searchParams.get('category');
	const limit = parseInt(url.searchParams.get('limit') || '5');

	try {
		let news: NewsItem[] = [];

		if (category) {
			news = await fetchNewsByCategory(category, limit);
		} else if (source) {
			news = await fetchNews(source, feed, limit);
		} else {
			news = await fetchAllNews(limit);
		}

		return json({ news });
	} catch (error) {
		console.error('News API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
