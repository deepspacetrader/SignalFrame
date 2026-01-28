import { KNOWN_RSS_FEEDS, type KnownRSSFeed } from '../data/rssFeeds';

export interface RawSignal {
    id: string;
    source: string;
    timestamp: string;
    content: string;
    category: string;
    // Optional display title, falls back to content
    title?: string;
    link?: string;
    picture?: string;
}

export interface RSSFeedConfig {
    url: string;
    category: string;
    source: string;
    logo?: string;
    enabled: boolean;
}

export interface UserRSSFeed {
    id: string;
    name: string;
    url: string;
    category: string;
    enabled: boolean;
}

// Optimize image URLs by adding size parameters for supported services
function optimizeImageUrl(url: string, targetWidth: number = 128, targetHeight: number = 128, baseUrl?: string): string {
    if (!url) return '';

    try {
        let absoluteUrl = url;

        // Check if URL is relative (starts with / or doesn't have a protocol)
        const isRelativeUrl = url.startsWith('/') || (!url.includes('://') && !url.startsWith('data:'));

        if (isRelativeUrl) {
            // Try to resolve relative URL against the base URL
            if (baseUrl) {
                try {
                    const base = new URL(baseUrl);
                    absoluteUrl = new URL(url, base.origin).toString();
                } catch (e) {
                    // baseUrl is also invalid, can't resolve
                    console.warn('Could not resolve relative image URL:', url, 'with base:', baseUrl);
                    return '';
                }
            } else {
                // No base URL provided for a relative URL - can't use it
                console.warn('Relative image URL without base URL:', url);
                return '';
            }
        }

        const urlObj = new URL(absoluteUrl);

        // BBC iChef (ichef.bbci.co.uk) - supports size parameters
        if (urlObj.hostname.includes('ichef.bbci.co.uk')) {
            // Replace /standard/240/ with /standard/128/ or add size parameter
            if (urlObj.pathname.includes('/standard/')) {
                urlObj.pathname = urlObj.pathname.replace(/\/standard\/\d+\//, `/standard/${targetWidth}/`);
                return urlObj.toString();
            }
            // Fallback: add size parameter
            urlObj.searchParams.set('resize', `${targetWidth}`);
            return urlObj.toString();
        }

        // The Verge platform.theverge.com - supports WordPress-style parameters
        if (urlObj.hostname.includes('platform.theverge.com')) {
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            urlObj.searchParams.set('crop', '1');
            return urlObj.toString();
        }

        // Ars Technica (cdn.arstechnica.net) - WordPress style
        if (urlObj.hostname.includes('cdn.arstechnica.net')) {
            // Replace -1152x648 with -128x128 or add resize parameters
            if (urlObj.pathname.includes('-1152x648')) {
                urlObj.pathname = urlObj.pathname.replace(/-\d+x\d+/, `-${targetWidth}x${targetHeight}`);
                return urlObj.toString();
            }
            // Fallback: add WordPress parameters
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            urlObj.searchParams.set('crop', '1');
            return urlObj.toString();
        }

        // NY Times images (static01.nyt.com) - use multithumb
        if (urlObj.hostname.includes('static01.nyt.com')) {
            // NY Times supports multithumb parameters
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            urlObj.searchParams.set('q', '75'); // quality
            urlObj.searchParams.set('auto', 'webp'); // format
            return urlObj.toString();
        }

        // Guardian images (i.guim.co.uk) - supports width/height parameters
        if (urlObj.hostname.includes('i.guim.co.uk')) {
            urlObj.searchParams.set('width', targetWidth.toString());
            urlObj.searchParams.set('height', targetHeight.toString());
            urlObj.searchParams.set('quality', '85');
            return urlObj.toString();
        }

        // Al Jazeera images (cdn.aljazeera.net) - try common parameters
        if (urlObj.hostname.includes('aljazeera.net')) {
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            return urlObj.toString();
        }

        // CNBC/MarketWatch images - try common parameters
        if (urlObj.hostname.includes('cnbc.com') || urlObj.hostname.includes('marketwatch.com') || urlObj.hostname.includes('wsj.net')) {
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            return urlObj.toString();
        }

        // Economist images
        if (urlObj.hostname.includes('economist.com')) {
            urlObj.searchParams.set('w', targetWidth.toString());
            urlObj.searchParams.set('h', targetHeight.toString());
            return urlObj.toString();
        }

        return urlObj.toString();
    } catch (e) {
        // If URL parsing fails, return empty string to hide broken image
        console.warn('Failed to parse image URL:', url);
        return '';
    }
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

        if (!response.ok) {
            throw new Error(`RSS2JSON HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.status === 'ok' && data.items) {
            return data;
        }

        throw new Error('RSS2JSON returned malformed payload');
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

            // Extract image from media:content, media:thumbnail, enclosure, or description
            let picture = '';
            const mediaContent = item.getElementsByTagName('media:content')[0];
            const mediaThumbnail = item.getElementsByTagName('media:thumbnail')[0];
            const enclosure = item.querySelector('enclosure');
            const articleLink = item.querySelector('link')?.textContent || '';

            if (mediaContent && mediaContent.getAttribute('url')) {
                picture = optimizeImageUrl(mediaContent.getAttribute('url') || '', 128, 128, articleLink);
            } else if (mediaThumbnail && mediaThumbnail.getAttribute('url')) {
                picture = optimizeImageUrl(mediaThumbnail.getAttribute('url') || '', 128, 128, articleLink);
            } else if (enclosure && enclosure.getAttribute('url')) {
                // Check enclosure - some feeds don't specify type correctly
                const encUrl = enclosure.getAttribute('url') || '';
                const encType = enclosure.getAttribute('type') || '';
                // Only use if it's an image type or if the URL looks like an image
                if (encType.startsWith('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(encUrl)) {
                    picture = optimizeImageUrl(encUrl, 128, 128, articleLink);
                }
            } else if (description) {
                const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch) {
                    picture = optimizeImageUrl(imgMatch[1], 128, 128, articleLink);
                }
            }

            return {
                title: item.querySelector('title')?.textContent || '',
                link: item.querySelector('link')?.textContent || '',
                description: description,
                pubDate: item.querySelector('pubDate')?.textContent || new Date().toISOString(),
                guid: item.querySelector('guid')?.textContent || item.querySelector('link')?.textContent || '',
                enclosure: { url: picture } // Use .url for consistency with RSS2JSON format
            };
        })
    };
}

// In-memory storage for RSS configuration (in a real app, this would be persisted)
let rssConfig: {
    defaultFeeds: RSSFeedConfig[];
    userFeeds: UserRSSFeed[];
} = {
    defaultFeeds: mapKnownFeedsToConfig(KNOWN_RSS_FEEDS),
    userFeeds: []
};

function mapKnownFeedsToConfig(feeds: KnownRSSFeed[]): RSSFeedConfig[] {
    return feeds.map(feed => ({
        url: feed.url,
        category: feed.category,
        source: feed.source,
        logo: feed.logo,
        enabled: feed.enabled ?? true
    }));
}

// Functions to manage RSS configuration
export function getRSSConfig() {
    return { ...rssConfig };
}

export function updateRSSConfig(config: Partial<typeof rssConfig>) {
    rssConfig = { ...rssConfig, ...config };
}

export function updateDefaultFeed(url: string, enabled: boolean) {
    rssConfig.defaultFeeds = rssConfig.defaultFeeds.map(feed =>
        feed.url === url ? { ...feed, enabled } : feed
    );
}

export function addUserFeed(feed: Omit<UserRSSFeed, 'id'>) {
    const newFeed: UserRSSFeed = {
        ...feed,
        id: Date.now().toString(),
        enabled: true
    };
    rssConfig.userFeeds.push(newFeed);
    return newFeed;
}

export function removeUserFeed(id: string) {
    rssConfig.userFeeds = rssConfig.userFeeds.filter(feed => feed.id !== id);
}

export function updateUserFeed(id: string, updates: Partial<UserRSSFeed>) {
    rssConfig.userFeeds = rssConfig.userFeeds.map(feed =>
        feed.id === id ? { ...feed, ...updates } : feed
    );
}

// Get active feeds (enabled default feeds + enabled user feeds)
function getActiveFeeds(): RSSFeedConfig[] {
    const activeDefaultFeeds = rssConfig.defaultFeeds.filter(feed => feed.enabled);
    const activeUserFeeds = rssConfig.userFeeds
        .filter(feed => feed.enabled)
        .map(feed => ({
            url: feed.url,
            category: feed.category,
            source: feed.name,
            enabled: true,
            logo: undefined
        }));

    return [...activeDefaultFeeds, ...activeUserFeeds];
}

// Regex patterns for stricter matching (word boundaries)
const BLACKLIST_PATTERNS = [
    // Non English characters
    /┬┐/i, /├í/i, /├⌐/i, /├¡/i, /├│/i, /├║/i, /├º/i, /├╝/i, /├ƒ/i, /├▒/i, /├ñ/i, /├╢/i, /├╝/i, /├╕/i, /├Ñ/i, /├╕/i, /├╝/i,

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

const INGEST_SERVER_URL = 'http://localhost:3001/api/ingest';

export async function fetchLatestFeeds(targetDate?: string): Promise<RawSignal[]> {
    const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const isToday = !targetDate || targetDate === todayStr;

    console.log(`Fetching ${isToday ? 'latest' : 'historical'} feeds for ${targetDate || 'Today'}...`);

    let activeFeeds = getActiveFeeds();

    // If historical, add a targeted Google News Search
    if (!isToday && targetDate) {
        const [y, m, d] = targetDate.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        date.setDate(date.getDate() + 1);

        const nextY = date.getFullYear();
        const nextM = String(date.getMonth() + 1).padStart(2, '0');
        const nextD = String(date.getDate()).padStart(2, '0');
        const nextDayStr = `${nextY}-${nextM}-${nextD}`;

        activeFeeds = [...activeFeeds, {
            url: `https://news.google.com/rss/search?q=after:${targetDate}+before:${nextDayStr}&hl=en-US&gl=US&ceid=US:en`,
            category: 'Geopolitical',
            source: 'Google News Archive',
            enabled: true
        }];
    }

    // Try to use the local ingestion server first (for deep crawling)
    try {
        console.log(`Attempting deep ingestion via ${INGEST_SERVER_URL}...`);
        const response = await fetch(INGEST_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feeds: activeFeeds, targetDate }),
            signal: AbortSignal.timeout(120000) // 2 minute timeout for crawling
        });

        if (response.ok) {
            const signals = await response.json();
            console.log(`Deep ingestion successful. Received ${signals.length} signals.`);
            return signals;
        }
        throw new Error(`Ingest server returned ${response.status}`);
    } catch (error) {
        console.warn('Deep ingestion server unreachable or failed, falling back to browser-based RSS fetch:', error);
    }

    // FALLBACK: Browser-based RSS fetch (same as before)
    const allSignals: RawSignal[] = [];

    // Fetch in parallel
    const feedPromises = activeFeeds.map(async (feed) => {
        try {
            const data = await fetchRssFeed(feed.url);

            if (data.status === 'ok' && data.items) {
                return data.items.map((item: any) => {
                    const rawDesc = item.description || '';
                    const cleanDesc = rawDesc
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\s+/g, ' ')
                        .trim();

                    const description = cleanDesc.length > 1500
                        ? cleanDesc.substring(0, 1500) + '...'
                        : cleanDesc;

                    const pubDate = item.pubDate || new Date().toISOString();
                    const timestamp = pubDate.includes('UTC') || pubDate.includes('Z') ? pubDate : `${pubDate} UTC`;

                    let rawPicture = item.enclosure?.url || item.thumbnail || '';
                    if (!rawPicture && item.description) {
                        const imgMatch = item.description.match(/<img[^>]+src=["']([^"']+)["']/i);
                        if (imgMatch) {
                            rawPicture = imgMatch[1];
                        }
                    }

                    const picture = optimizeImageUrl(rawPicture, 128, 128, item.link);

                    return {
                        id: item.guid || item.link,
                        source: feed.source,
                        timestamp,
                        content: description ? `${item.title}. ${description}` : item.title,
                        category: feed.category,
                        title: item.title || '',
                        link: item.link,
                        picture
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

    const filteredSignals = allSignals.filter(s => {
        if (isBlacklisted(s.content) || (s.title && isBlacklisted(s.title))) {
            return false;
        }
        if (targetDate) {
            try {
                const signalDate = new Date(s.timestamp).toLocaleDateString('en-CA');
                return signalDate === targetDate;
            } catch (e) { return false; }
        }
        return true;
    });

    console.log(`Ingested ${filteredSignals.length} signals for ${targetDate || 'Today'}. (Fallback mode)`);
    return filteredSignals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

