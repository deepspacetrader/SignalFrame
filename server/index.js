import express from 'express';
import cors from 'cors';
import { PlaywrightCrawler } from 'crawlee';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3001;

// Blacklist strictly for non-news/noise to keep the focus wide but relevant
const NOISE_PATTERNS = [
    /NFL|NBA|MLB|NHL|FIFA|UEFA|vs\.|FA Cup|Super Bowl|World Cup/i,
    /\bFootball\b|\bBasketball\b|\bBaseball\b|\bSoccer\b|\bTennis\b/i,
    /Kardashian|Taylor Swift|Beyonce|Hollywood|Celebrity|Gossip|Red Carpet/i,
    /Grammy|Oscar|Emmy|TV Review|Film Review|Season \d+|Spoiler/i,
    /Vacation|Resort|\bHotel\b|\bCruise\b|Fashion|Style|Beauty|Makeup/i,
    /Lottery|Powerball|Mega Millions|Horoscope|Astrology/i
];

function isNoise(text) {
    return NOISE_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Robust Native RSS Parser
 */
function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];
        const title = (itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
        const link = (itemContent.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
        const desc = (itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '';
        const pubDate = (itemContent.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/) || [])[1] || '';
        const guid = (itemContent.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/) || [])[1] || link;

        const mediaMatch = itemContent.match(/<media:content[^>]*url="([^"]+)"/) ||
            itemContent.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/);
        const picture = mediaMatch ? mediaMatch[1] : '';

        items.push({ title, link, desc, pubDate, guid, picture });
    }
    return items;
}

app.post('/api/ingest', async (req, res) => {
    const { feeds, targetDate } = req.body;

    if (!feeds || !Array.isArray(feeds)) {
        return res.status(400).json({ error: 'Feeds array is required' });
    }

    console.log(`[SignalFrame] 🚀 Comprehensive Ingestion Started for ${targetDate || 'Today'}...`);

    let rssItems = [];

    // 1. Fetch and Parse ALL RSS Feeds
    for (const feed of feeds) {
        try {
            const response = await axios.get(feed.url, { timeout: 10000 });
            const items = parseRSS(response.data);

            const processed = items.map(item => {
                // Skip if it's clearly non-news noise
                if (isNoise(item.title) || isNoise(item.desc)) return null;

                // Date filtering if applicable
                if (targetDate) {
                    try {
                        const itemDate = new Date(item.pubDate).toLocaleDateString('en-CA');
                        if (itemDate !== targetDate) return null;
                    } catch (e) { return null; }
                }

                return {
                    id: item.guid,
                    source: feed.source,
                    category: feed.category,
                    timestamp: item.pubDate,
                    title: item.title.trim(),
                    link: item.link.trim(),
                    snippet: item.desc.replace(/<[^>]*>/g, ' ').trim().substring(0, 800),
                    picture: item.picture
                };
            }).filter(Boolean);

            rssItems.push(...processed);
            console.log(`[RSS] ${feed.source}: Fetched ${processed.length} valid articles`);
        } catch (error) {
            console.error(`[RSS] Failed ${feed.source}:`, error.message);
        }
    }

    // Deduplicate by URL
    const uniqueItems = Array.from(new Map(rssItems.map(item => [item.link, item])).values());
    console.log(`[SignalFrame] Total unique articles to process: ${uniqueItems.length}`);

    // Limit to top 100 articles total for performance (standard for a daily sweep)
    const itemsToProcess = uniqueItems.slice(0, 100);
    const fullContentMap = new Map();

    // 2. High-Concurrency Crawl for FULL Articles
    console.log(`[Crawler] Deep crawling ${itemsToProcess.length} articles with high concurrency...`);
    const crawler = new PlaywrightCrawler({
        headless: true,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 20,
        // Increased concurrency to handle many items faster
        minConcurrency: 5,
        maxConcurrency: 15,
        launchContext: {
            launchOptions: {
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            }
        },
        async requestHandler({ request, page, log }) {
            try {
                // Quickly wait for text to be present
                await page.waitForLoadState('domcontentloaded');

                const content = await page.evaluate(() => {
                    // Deep clean the page to target core narrative
                    const selectorsToDrop = [
                        'script', 'style', 'nav', 'footer', 'header', 'aside',
                        '.ads', '.comments', '.sidebar', '.menu', '.social-share',
                        '.related-posts', '.newsletter-signup', '.cookie-banner'
                    ];
                    selectorsToDrop.forEach(s => document.querySelectorAll(s).forEach(el => el.remove()));

                    // Look for typical article content hubs
                    const articleBody = document.querySelector('article, [itemprop="articleBody"], .article-content, .post-content, main');
                    const target = articleBody || document.body;

                    const paragraphs = Array.from(target.querySelectorAll('p'));
                    return paragraphs
                        .map(p => p.textContent.trim())
                        .filter(text => text.length > 60) // High-quality content only
                        .slice(0, 25) // Capture deep context (up to ~25 paragraphs)
                        .join('\n\n');
                });

                if (content && content.length > 200) {
                    fullContentMap.set(request.url, content);
                } else {
                    log.debug(`Insufficient content for ${request.url}`);
                }
            } catch (err) {
                log.error(`Crawl failed for ${request.url}: ${err.message}`);
            }
        }
    });

    if (itemsToProcess.length > 0) {
        await crawler.run(itemsToProcess.map(it => it.link));
    }

    // 3. Finalize Enriched Signals
    const finalSignals = itemsToProcess.map(item => {
        const fullContent = fullContentMap.get(item.link);
        // We provide a massive 5000 char window for the AI if content is found
        const content = fullContent
            ? `${item.title}. ${fullContent}`.substring(0, 5000)
            : `${item.title}. ${item.snippet}`;

        return {
            id: item.id,
            source: item.source,
            timestamp: item.timestamp,
            content,
            category: item.category,
            title: item.title,
            link: item.link,
            picture: item.picture
        };
    });

    console.log(`[SignalFrame] Ingestion complete. enriched ${fullContentMap.size}/${finalSignals.length} items with full crawls.`);
    res.json(finalSignals);
});

// Health check endpoint
app.get('/api/status', (req, res) => res.json({ status: 'online', service: 'SignalFrame Ingestion' }));

app.listen(PORT, () => {
    console.log(`SignalFrame COMPREHENSIVE Ingestion Server running at http://localhost:${PORT}`);
});
