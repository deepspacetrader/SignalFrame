
export interface TrendNewsItem {
    title: string;
    url: string;
    source: string;
    picture?: string;
}

export interface RawSignal {
    id: string;
    source: string;
    timestamp: string;
    content: string;
    category: string;
    link?: string;
    // Google Trends specific fields
    approxTraffic?: string;
    picture?: string;
    pictureSource?: string;
    relatedNews?: TrendNewsItem[];
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
    { url: 'https://www.reutersagency.com/feed/?best-topics=world-news&post_type=best', category: 'Conflicts', source: 'Reuters' },

    // Trends
    { url: 'https://trends.google.com/trending/rss?geo=CA', category: 'Trends', source: 'Google Trends Canada' },
    { url: 'https://trends.google.com/trending/rss?geo=US', category: 'Trends', source: 'Google Trends USA' },
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
            // Check if this is a Google Trends feed - requires special parsing
            const isGoogleTrends = feed.url.includes('trends.google.com/trending/rss');

            if (isGoogleTrends) {
                // Use allorigins as CORS proxy to get raw XML
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
                const response = await fetch(proxyUrl);
                const xmlText = await response.text();

                // Parse the XML
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                const items = xmlDoc.querySelectorAll('item');

                return Array.from(items).map((item) => {
                    const title = item.querySelector('title')?.textContent || '';
                    const pubDate = item.querySelector('pubDate')?.textContent || '';
                    const link = item.querySelector('link')?.textContent || '';

                    // Extract ht: namespace elements
                    const approxTraffic = item.getElementsByTagName('ht:approx_traffic')[0]?.textContent || '';
                    const picture = item.getElementsByTagName('ht:picture')[0]?.textContent || '';
                    const pictureSource = item.getElementsByTagName('ht:picture_source')[0]?.textContent || '';

                    // Extract related news items
                    const newsItems = item.getElementsByTagName('ht:news_item');
                    const relatedNews: TrendNewsItem[] = Array.from(newsItems).map((newsItem) => ({
                        title: newsItem.getElementsByTagName('ht:news_item_title')[0]?.textContent || '',
                        url: newsItem.getElementsByTagName('ht:news_item_url')[0]?.textContent || '',
                        source: newsItem.getElementsByTagName('ht:news_item_source')[0]?.textContent || '',
                        picture: newsItem.getElementsByTagName('ht:news_item_picture')[0]?.textContent || ''
                    })).filter(n => n.title && n.url);

                    // Build a richer content string from related news
                    const newsContext = relatedNews.slice(0, 3).map(n => n.title).join('. ');
                    const content = newsContext ? `${title}: ${newsContext}` : title;

                    // Generate Google search link for the trending term
                    const searchLink = `https://www.google.com/search?q=${encodeURIComponent(title)}`;

                    return {
                        id: `trend-${title}-${pubDate}`,
                        source: feed.source,
                        timestamp: pubDate.includes('UTC') || pubDate.includes('Z') ? pubDate : `${pubDate}`,
                        content,
                        category: feed.category,
                        link: searchLink,
                        approxTraffic,
                        picture,
                        pictureSource,
                        relatedNews
                    };
                });
            }

            // Regular RSS feed - use rss2json
            // Note: count parameter removed as it causes 422 Unprocessable Entity on free tier
            const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (data.status === 'ok' && data.items) {
                // Return all items, we'll filter by date after aggregation
                return data.items.map((item: any) => {
                    // Extract and clean description - strip HTML tags for cleaner AI input
                    const rawDesc = item.description || '';
                    const cleanDesc = rawDesc
                        .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\s+/g, ' ')      // Normalize whitespace
                        .trim();

                    // Use full description (up to 1500 chars) for much richer context
                    const description = cleanDesc.length > 1500
                        ? cleanDesc.substring(0, 1500) + '...'
                        : cleanDesc;

                    return {
                        id: item.guid || item.link,
                        source: feed.source,
                        timestamp: item.pubDate.includes('UTC') || item.pubDate.includes('Z') ? item.pubDate : `${item.pubDate} UTC`,
                        content: description ? `${item.title}. ${description}` : item.title,
                        category: feed.category,
                        link: item.link
                    };
                });
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
