import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Parser from 'rss-parser';

// Feed configuration (matching the MCP server v2.1.0)
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
		name: 'RÚV',
		baseUrl: 'https://www.ruv.is',
		feeds: {
			frettir: { url: 'https://www.ruv.is/rss/frettir', description: 'All news' },
			innlent: { url: 'https://www.ruv.is/rss/innlent', description: 'Domestic news' },
			erlent: { url: 'https://www.ruv.is/rss/erlent', description: 'International news' },
			ithrottir: { url: 'https://www.ruv.is/rss/ithrottir', description: 'Sports' },
			english: { url: 'https://www.ruv.is/rss/english', description: 'English news' }
		}
	},
	mbl: {
		name: 'Morgunblaðið',
		baseUrl: 'https://www.mbl.is',
		feeds: {
			fp: { url: 'https://www.mbl.is/feeds/fp/', description: 'Front page' },
			innlent: { url: 'https://www.mbl.is/feeds/innlent/', description: 'Domestic' },
			erlent: { url: 'https://www.mbl.is/feeds/erlent/', description: 'International' },
			sport: { url: 'https://www.mbl.is/feeds/sport/', description: 'Sports' },
			vidskipti: { url: 'https://www.mbl.is/feeds/vidskipti/', description: 'Business' },
			english: { url: 'https://www.mbl.is/feeds/english/', description: 'English' }
		}
	},
	visir: {
		name: 'Vísir',
		baseUrl: 'https://www.visir.is',
		feeds: {
			frettir: { url: 'https://www.visir.is/rss/allt', description: 'All news' },
			innlent: { url: 'https://www.visir.is/rss/innlent', description: 'Domestic' },
			erlent: { url: 'https://www.visir.is/rss/erlent', description: 'International' }
		}
	},
	dv: {
		name: 'DV',
		baseUrl: 'https://www.dv.is',
		feeds: {
			frettir: { url: 'https://www.dv.is/feed/', description: 'All news' }
		}
	},
	stundin: {
		name: 'Stundin',
		baseUrl: 'https://stundin.is',
		feeds: {
			frettir: { url: 'https://stundin.is/rss/', description: 'All news' }
		}
	},
	frettabladid: {
		name: 'Fréttablaðið',
		baseUrl: 'https://www.frettabladid.is',
		feeds: {
			frettir: { url: 'https://www.frettabladid.is/rss/', description: 'All news' }
		}
	},
	kjarninn: {
		name: 'Kjarninn',
		baseUrl: 'https://kjarninn.is',
		feeds: {
			frettir: { url: 'https://kjarninn.is/rss/', description: 'All news' }
		}
	},
	heimildin: {
		name: 'Heimildin',
		baseUrl: 'https://heimildin.is',
		feeds: {
			frettir: { url: 'https://heimildin.is/rss/', description: 'All news' }
		}
	},
	icelandreview: {
		name: 'Iceland Review',
		baseUrl: 'https://www.icelandreview.com',
		feeds: {
			frettir: { url: 'https://www.icelandreview.com/feed/', description: 'English news' }
		}
	},
	grapevine: {
		name: 'Grapevine',
		baseUrl: 'https://grapevine.is',
		feeds: {
			frettir: { url: 'https://grapevine.is/feed/', description: 'English news' }
		}
	},
	vedur: {
		name: 'Veðurstofa',
		baseUrl: 'https://www.vedur.is',
		feeds: {
			frettir: { url: 'https://www.vedur.is/rss/frettir', description: 'Weather news' }
		}
	}
};

const parser = new Parser({
	customFields: {
		item: ['dc:creator']
	},
	timeout: 10000
});

interface NewsItem {
	title: string;
	link: string;
	description: string;
	pubDate: string;
	source: string;
	sourceId: string;
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
		// Try default feed
		const defaultFeed = Object.keys(sourceInfo.feeds)[0];
		return fetchNews(source, defaultFeed, limit);
	}

	try {
		const result = await parser.parseURL(feedInfo.url);
		return result.items.slice(0, limit).map((item) => ({
			title: item.title || 'No title',
			link: item.link || '',
			description: (item.contentSnippet || item.content || 'No description').slice(0, 300),
			pubDate: item.pubDate || '',
			source: sourceInfo.name,
			sourceId: source,
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
		fetchNews('visir', 'frettir', limit),
		fetchNews('heimildin', 'frettir', limit)
	];

	const results = await Promise.allSettled(fetches);
	for (const result of results) {
		if (result.status === 'fulfilled') {
			allNews.push(...result.value);
		}
	}

	// Sort by date (newest first)
	allNews.sort((a, b) => {
		const dateA = new Date(a.pubDate).getTime() || 0;
		const dateB = new Date(b.pubDate).getTime() || 0;
		return dateB - dateA;
	});

	return allNews.slice(0, limit * 4);
}

async function searchNews(query: string, limit: number = 20): Promise<NewsItem[]> {
	const allNews: NewsItem[] = [];
	const searchLower = query.toLowerCase();

	// Search across all main sources
	const sources = ['ruv', 'mbl', 'visir', 'heimildin', 'stundin', 'kjarninn'];
	const fetches = sources.map(source => fetchNews(source, 'frettir', 30));

	const results = await Promise.allSettled(fetches);

	for (const result of results) {
		if (result.status === 'fulfilled') {
			for (const item of result.value) {
				// Search in title and description
				if (
					item.title.toLowerCase().includes(searchLower) ||
					item.description.toLowerCase().includes(searchLower)
				) {
					allNews.push(item);
				}
			}
		}
	}

	// Sort by date
	allNews.sort((a, b) => {
		const dateA = new Date(a.pubDate).getTime() || 0;
		const dateB = new Date(b.pubDate).getTime() || 0;
		return dateB - dateA;
	});

	return allNews.slice(0, limit);
}

async function fetchNewsByCategory(category: string, limit: number = 5): Promise<NewsItem[]> {
	const allNews: NewsItem[] = [];

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
			{ source: 'mbl', feed: 'innlent' },
			{ source: 'visir', feed: 'innlent' }
		],
		'erlent': [
			{ source: 'ruv', feed: 'erlent' },
			{ source: 'mbl', feed: 'erlent' },
			{ source: 'visir', feed: 'erlent' }
		],
		'vidskipti': [
			{ source: 'mbl', feed: 'vidskipti' }
		],
		'english': [
			{ source: 'ruv', feed: 'english' },
			{ source: 'mbl', feed: 'english' },
			{ source: 'icelandreview', feed: 'frettir' },
			{ source: 'grapevine', feed: 'frettir' }
		]
	};

	const feeds = categoryFeeds[category.toLowerCase()] || [];

	if (feeds.length === 0) {
		return fetchAllNews(limit);
	}

	const fetches = feeds.map(f => fetchNews(f.source, f.feed, limit));
	const results = await Promise.allSettled(fetches);

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allNews.push(...result.value);
		}
	}

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
		const { action, source, feed, category, query, limit = 5 } = body;

		let news: NewsItem[] = [];

		switch (action) {
			case 'get_news':
				if (source) {
					news = await fetchNews(source, feed || 'frettir', limit);
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

			case 'search_news':
				if (!query) {
					return json({ error: 'Query required for search' }, { status: 400 });
				}
				const results = await searchNews(query, limit);
				return json({ results });

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
	const query = url.searchParams.get('query');
	const limit = parseInt(url.searchParams.get('limit') || '5');

	try {
		if (query) {
			const results = await searchNews(query, limit);
			return json({ results });
		} else if (category) {
			const news = await fetchNewsByCategory(category, limit);
			return json({ news });
		} else if (source) {
			const news = await fetchNews(source, feed, limit);
			return json({ news });
		} else {
			const news = await fetchAllNews(limit);
			return json({ news });
		}
	} catch (error) {
		console.error('News API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
