
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

export async function fetchLatestFeeds(targetDate?: string): Promise<RawSignal[]> {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const isToday = !targetDate || targetDate === todayStr;

    console.log(`Fetching ${isToday ? 'latest' : 'historical'} feeds for ${targetDate || 'Today'}...`);

    const allSignals: RawSignal[] = [];
    const activeFeeds = [...FEEDS];

    // If historical, add a targeted Google News Search to ensure we find data for that specific day
    if (!isToday && targetDate) {
        const [y, m, d] = targetDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + 1);

        const nextY = date.getFullYear();
        const nextM = String(date.getMonth() + 1).padStart(2, '0');
        const nextD = String(date.getDate()).padStart(2, '0');
        const nextDayStr = `${nextY}-${nextM}-${nextD}`;

        activeFeeds.push({
            url: `https://news.google.com/rss/search?q=after:${targetDate}+before:${nextDayStr}&hl=en-US&gl=US&ceid=US:en`,
            category: 'Geopolitical',
            source: 'Google News Archive'
        });
    }

    // Fetch in parallel
    const feedPromises = activeFeeds.map(async (feed) => {
        try {
            // Using rss2json to bypass CORS and get clean JSON
            // Note: count parameter removed as it causes 422 Unprocessable Entity on free tier
            const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items) {
                // Return all items, we'll filter by date after aggregation
                return data.items.map((item: any) => ({
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

    // Filter by date if a specific target date was requested
    const filteredSignals = targetDate
        ? allSignals.filter(s => {
            try {
                const signalDate = new Date(s.timestamp).toLocaleDateString('en-CA');
                return signalDate === targetDate;
            } catch (e) { return false; }
        })
        : allSignals;

    console.log(`Ingested ${filteredSignals.length} signals for ${targetDate || 'Today'}.`);
    return filteredSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
