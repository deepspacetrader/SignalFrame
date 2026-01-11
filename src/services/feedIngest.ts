
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
    // Optional display title, falls back to content
    title?: string;
    link?: string;
    // Google Trends specific fields
    approxTraffic?: string;
    picture?: string;
    pictureSource?: string;
    relatedNews?: TrendNewsItem[];
}

// Multiple CORS proxy options for fallback reliability
const CORS_PROXIES = [
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://cors.eu.org/${url}`,
];

// RSS to JSON conversion proxies with fallbacks
const RSS_TO_JSON_PROXIES = [
    (url: string) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`,
    // Fallback: Use CORS proxy + local parsing
    null, // Signals to use raw XML parsing instead
];

// Fetch with proxy fallback - tries multiple proxies until one works
async function fetchWithFallback(url: string, isXml: boolean = false): Promise<Response> {
    let lastError: Error | null = null;

    for (const proxyFn of CORS_PROXIES) {
        try {
            const proxyUrl = proxyFn(url);
            const response = await fetch(proxyUrl, {
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            if (response.ok) {
                return response;
            }
        } catch (error) {
            lastError = error as Error;
            console.warn(`Proxy failed for ${url}, trying next...`);
        }
    }

    throw lastError || new Error(`All proxies failed for ${url}`);
}

// Fetch RSS feed with JSON conversion fallback
async function fetchRssFeed(feedUrl: string): Promise<any> {
    // Try RSS-to-JSON service first
    try {
        const proxyUrl = RSS_TO_JSON_PROXIES[0]!(feedUrl);
        const response = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'ok' && data.items) {
                return data;
            }
        }
    } catch (error) {
        console.warn(`RSS2JSON failed for ${feedUrl}, falling back to raw XML parsing...`);
    }

    // Fallback: Fetch raw XML and parse locally
    const response = await fetchWithFallback(feedUrl, true);
    const xmlText = await response.text();

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');

    return {
        status: 'ok',
        items: Array.from(items).map(item => {
            const description = item.querySelector('description')?.textContent || '';

            // Extract image from media:content, enclosure, or description
            let picture = '';
            const mediaContent = item.getElementsByTagName('media:content')[0];
            const enclosure = item.querySelector('enclosure');

            if (mediaContent && mediaContent.getAttribute('url')) {
                picture = mediaContent.getAttribute('url') || '';
            } else if (enclosure && enclosure.getAttribute('type')?.startsWith('image') && enclosure.getAttribute('url')) {
                picture = enclosure.getAttribute('url') || '';
            } else if (description) {
                const imgMatch = description.match(/<img[^>]+src="([^">]+)"/);
                if (imgMatch) {
                    picture = imgMatch[1];
                }
            }

            return {
                title: item.querySelector('title')?.textContent || '',
                link: item.querySelector('link')?.textContent || '',
                description: description,
                pubDate: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
                guid: item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || '',
                enclosure: { link: picture } // Mock RSS2JSON structure for consistency
            };
        })
    };
}

const NEWS_FEEDS = [
    // World / Geopolitical
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'World', source: 'BBC World' },
    { url: 'https://www.theguardian.com/world/rss', category: 'World', source: 'The Guardian' },
    { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'World', source: 'Al Jazeera' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'World', source: 'NY Times World' },

    // Business / Financial
    { url: 'https://search.cnbc.com/rs/search/view.xml?partnerId=2000&keywords=finance', category: 'Business', source: 'CNBC' },
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', category: 'Business', source: 'MarketWatch' },
    { url: 'https://www.economist.com/finance-and-economics/rss.xml', category: 'Business', source: 'The Economist' },

    // Technology
    { url: 'https://techcrunch.com/feed/', category: 'Technology', source: 'TechCrunch' },
    { url: 'https://www.theverge.com/rss/index.xml', category: 'Technology', source: 'The Verge' },
    { url: 'https://arstechnica.com/feed/', category: 'Technology', source: 'Ars Technica' },

    // Science
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', category: 'Science', source: 'NY Times Science' },
    { url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'Science', source: 'BBC Science' },

    // Health
    { url: 'http://feeds.bbci.co.uk/news/health/rss.xml', category: 'Health', source: 'BBC Health' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml', category: 'Health', source: 'NY Times Health' },
];

const TRENDS_FEEDS = [
    // Trends - Grouped under "Trends" category to keep separate from RSS feeds.
    // Enforcing English (hl=en-US) to avoid foreign sports results.

    // USA
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=10&hl=en-US', category: 'Trends', source: 'Google Trends (Gov US)' },
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=3&hl=en-US', category: 'Trends', source: 'Google Trends (Biz US)' },
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=18&hl=en-US', category: 'Trends', source: 'Google Trends (Tech US)' },
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=15&hl=en-US', category: 'Trends', source: 'Google Trends (Science US)' },
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=7&hl=en-US', category: 'Trends', source: 'Google Trends (Health US)' },
    { url: 'https://trends.google.com/trending/rss?geo=US&cat=14&hl=en-US', category: 'Trends', source: 'Google Trends (Politics US)' },

    // Canada
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=10&hl=en-US', category: 'Trends', source: 'Google Trends (Gov CA)' },
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=3&hl=en-US', category: 'Trends', source: 'Google Trends (Biz CA)' },
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=18&hl=en-US', category: 'Trends', source: 'Google Trends (Tech CA)' },
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=15&hl=en-US', category: 'Trends', source: 'Google Trends (Science CA)' },
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=7&hl=en-US', category: 'Trends', source: 'Google Trends (Health CA)' },
    { url: 'https://trends.google.com/trending/rss?geo=CA&cat=14&hl=en-US', category: 'Trends', source: 'Google Trends (Politics CA)' },
];

// Regex patterns for stricter matching (word boundaries)
const BLACKLIST_PATTERNS = [
    // Non English characters
    /¿/i, /á/i, /é/i, /í/i, /ó/i, /ú/i, /ç/i, /ü/i, /ß/i, /ñ/i, /ä/i, /ö/i, /ü/i, /ø/i, /å/i, /ø/i, /ü/i,

    // Sports
    /NFL/i, /NBA/i, /MLB/i, /NHL/i, /FIFA/i, /UEFA/i, /vs./i, /FA Cup/i,
    /\bFootball\b/i, /\bBasketball\b/i, /\bBaseball\b/i, /\bSoccer\b/i,
    /\bTennis\b/i, /\bGolf\b/i, /\bCricket\b/i, /\bRugby\b/i,
    /\bF1\b/i, /Formula 1/i, /NASCAR/i, /Olympics/i, /Olympiad/i, /Super Bowl/i, /World Cup/i,
    /Touchdown/i, /Quarterback/i,
    // Note: 'Score' and 'Match' are too generic (e.g. "Credit Score", "Match found"), excluding them or being very specific
    /Playoff/i, /Championship/i,

    // Entertainment / Celebrity
    /Kardashian/i, /Taylor\s?Swift/i, /Beyonce/i, /Hollywood/i,
    /\bMovie\b/i, /\bCinema\b/i, /Film Review/i, /Box Office/i,
    /Celebrity/i, /Gossip/i, /Red Carpet/i, /Grammy/i, /Oscar/i, /Emmy/i,
    /Reality TV/i, /Sitcom/i, /Netflix Series/i, /Spoiler/i, /Trailer/i,

    // Lifestyle / Travel
    /Vacation/i, /Resort/i, /\bHotel\b/i, /\bCruise\b/i, /Airline Deals/i, /Travel Guide/i,
    /\bFashion\b/i, /\bStyle\b/i, /\bBeauty\b/i, /Makeup/i, /Skincare/i,
    /\bDiet\b/i, /\bRecipe\b/i, /Dating/i, /Horoscope/i, /Astrology/i,

    // Other Noise
    /Lottery/i, /Powerball/i, /Mega Millions/i
];

function isBlacklisted(text: string): boolean {
    return BLACKLIST_PATTERNS.some(pattern => pattern.test(text));
}

export async function fetchLatestFeeds(targetDate?: string): Promise<RawSignal[]> {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const isToday = !targetDate || targetDate === todayStr;

    console.log(`Fetching ${isToday ? 'latest' : 'historical'} feeds for ${targetDate || 'Today'}...`);

    const allSignals: RawSignal[] = [];
    // const activeFeeds = [...NEWS_FEEDS, ...TRENDS_FEEDS];
    const activeFeeds = [...NEWS_FEEDS];

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
                console.log(`Fetching Google Trends feed for ${feed.source}...`);
                // Use fetchWithFallback for robust CORS proxy handling
                const response = await fetchWithFallback(feed.url);
                const xmlText = await response.text();

                // Parse the XML
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
                const items = xmlDoc.querySelectorAll('item');

                return Array.from(items).map((item) => {
                    const title = item.querySelector('title')?.textContent || '';
                    const pubDate = item.querySelector('pubDate')?.textContent || '';
                    const link = item.querySelector('link')?.textContent || '';

                    // helper to get text from potential namespace tags
                    const getTagText = (tagName: string) => {
                        const withNs = item.getElementsByTagName(`ht:${tagName}`)[0];
                        if (withNs) return withNs.textContent || '';
                        const withoutNs = item.getElementsByTagName(tagName)[0];
                        if (withoutNs) return withoutNs.textContent || '';
                        return '';
                    };

                    const approxTraffic = getTagText('approx_traffic');
                    const picture = getTagText('picture');
                    const pictureSource = getTagText('picture_source');

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
                        title: title,
                        link: searchLink,
                        approxTraffic,
                        picture,
                        pictureSource,
                        relatedNews
                    };
                });
            }

            // Regular RSS feed - use fetchRssFeed with fallback support
            const data = await fetchRssFeed(feed.url);

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

                    // Handle missing pubDate gracefully
                    const pubDate = item.pubDate || new Date().toISOString();
                    const timestamp = pubDate.includes('UTC') || pubDate.includes('Z') ? pubDate : `${pubDate} UTC`;

                    // Attempt to find image
                    const picture = item.enclosure?.link || item.thumbnail || '';

                    return {
                        id: item.guid || item.link,
                        source: feed.source,
                        timestamp,
                        content: description ? `${item.title}. ${description}` : item.title,
                        category: feed.category,
                        title: item.title || '',
                        link: item.link,
                        picture // Include the extracted picture
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

    // DEDUPLICATION STEP
    const seenTrendTopics = new Set<string>();
    const uniqueSignals: RawSignal[] = [];

    allSignals.forEach(signal => {
        if (signal.source.includes('Google Trends')) {
            // Deduplicate trends based on Title (Topic)
            // Use title if present, fall back to parsing content or just content
            // We added 'title' property specifically for this purpose in the map above.
            const topic = signal.title ? signal.title.toLowerCase().trim() : signal.content.toLowerCase().trim();

            if (seenTrendTopics.has(topic)) {
                return; // Skip duplicate
            }
            seenTrendTopics.add(topic);
        }
        uniqueSignals.push(signal);
    });

    // Filter by date AND Blacklist
    const filteredSignals = uniqueSignals.filter(s => {
        // 1. Blacklist Check
        if (isBlacklisted(s.content) || (s.title && isBlacklisted(s.title))) {
            return false;
        }

        // 2. Date Check (if targetDate provided)
        if (targetDate) {
            try {
                const signalDate = new Date(s.timestamp).toLocaleDateString('en-CA');
                return signalDate === targetDate;
            } catch (e) { return false; }
        }
        return true;
    });

    console.log(`Ingested ${filteredSignals.length} signals for ${targetDate || 'Today'}. (Filtered out noise and duplicates)`);
    return filteredSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
