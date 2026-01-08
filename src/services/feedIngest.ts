
export interface RawSignal {
    id: string;
    source: string;
    timestamp: string;
    content: string;
    category: string;
    link?: string;
}

const FEEDS = [
    // Tech / AI
    { url: 'https://techcrunch.com/feed/', category: 'Tech / AI', source: 'TechCrunch' },
    { url: 'https://www.theverge.com/rss/index.xml', category: 'Tech / AI', source: 'The Verge' },

    // World Geopolitical
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'Geopolitical', source: 'BBC World' },
    { url: 'https://www.theguardian.com/world/rss', category: 'Geopolitical', source: 'The Guardian' },

    // Financial
    { url: 'https://search.cnbc.com/rs/search/view.xml?partnerId=2000&keywords=finance', category: 'Financial', source: 'CNBC' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', category: 'Financial', source: 'MarketWatch' },

    // Conflicts
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'Conflicts', source: 'Al Jazeera' },
    { url: 'https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best', category: 'Conflicts', source: 'Reuters' }
];

export async function fetchLatestFeeds(): Promise<RawSignal[]> {
    console.log('Fetching latest feeds from across the web...');

    const allSignals: RawSignal[] = [];

    // Fetch in parallel
    const feedPromises = FEEDS.map(async (feed) => {
        try {
            // Using rss2json to bypass CORS and get clean JSON
            const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items) {
                return data.items.slice(0, 5).map((item: any) => ({
                    id: item.guid || item.link,
                    source: feed.source,
                    timestamp: item.pubDate.includes('UTC') || item.pubDate.includes('Z') ? item.pubDate : `${item.pubDate} UTC`,
                    content: `${item.title}. ${item.description?.substring(0, 150) || ''}`,
                    category: feed.category,
                    link: item.link
                }));
            }
        } catch (error) {
            console.warn(`Failed to fetch feed ${feed.source}:`, error);
        }
        return [];
    });

    const results = await Promise.all(feedPromises);
    results.forEach(signals => allSignals.push(...signals));

    console.log(`Ingested ${allSignals.length} raw news items.`);
    return allSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
