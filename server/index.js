import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import say from 'say';
// import loudness from 'node-loudness';

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

// Noise patterns to filter out irrelevant RSS content
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

    // deduplicate by URL
    const uniqueItems = Array.from(new Map(rssItems.map(item => [item.link, item])).values());
    console.log(`[SignalFrame] Total unique articles to process: ${uniqueItems.length}`);

    // Limit to top 500 articles total for performance
    const finalSignals = uniqueItems.slice(0, 500).map(item => ({
        id: item.id,
        source: item.source,
        timestamp: item.timestamp,
        content: `${item.title}. ${item.snippet}`,
        category: item.category,
        title: item.title,
        link: item.link,
        picture: item.picture,
        hasFullContent: false,
        url: item.link
    }));

    console.log(`[SignalFrame] Ingestion complete. Prepared ${finalSignals.length} items from RSS snippets.`);
    res.json(finalSignals);
});

// Health check endpoint
app.get('/api/status', (req, res) => res.json({ status: 'online', service: 'SignalFrame Ingestion' }));

// TTS endpoints using say.js
app.post('/api/tts/speak', (req, res) => {
    const { text, voice, speed = 1.0 } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
    }

    say.speak(text, voice || null, speed, (err) => {
        if (err) {
            console.error('TTS speak error:', err);
            return res.status(500).json({ error: 'Failed to speak text' });
        }
        res.json({ success: true, message: 'Text spoken successfully' });
    });
});

// Volume control endpoints (commented out for now)
// app.get('/api/volume', async (req, res) => {
//     try {
//         const volume = await loudness.getVolume();
//         res.json({ volume: volume / 100 }); // Convert to 0-1 range
//     } catch (error) {
//         console.error('Get volume error:', error);
//         res.status(500).json({ error: 'Failed to get system volume' });
//     }
// });

// app.post('/api/volume', async (req, res) => {
//     const { volume } = req.body;
//     
//     if (typeof volume !== 'number' || volume < 0 || volume > 1) {
//         return res.status(400).json({ error: 'Volume must be a number between 0 and 1' });
//     }

//     try {
//         const volumePercent = Math.round(volume * 100);
//         await loudness.setVolume(volumePercent);
//         res.json({ success: true, message: 'Volume set successfully' });
//     } catch (error) {
//         console.error('Set volume error:', error);
//         res.status(500).json({ error: 'Failed to set system volume' });
//     }
// });

app.post('/api/tts/stop', (req, res) => {
    say.stop((err) => {
        if (err) {
            console.error('TTS stop error:', err);
            return res.status(500).json({ error: 'Failed to stop speech' });
        }
        res.json({ success: true, message: 'Speech stopped successfully' });
    });
});

app.get('/api/tts/voices', (req, res) => {
    say.getInstalledVoices((err, voices) => {
        if (err) {
            console.error('TTS voices error:', err);
            return res.status(500).json({ error: 'Failed to get voices' });
        }
        res.json({ voices });
    });
});

app.post('/api/tts/export', (req, res) => {
    const { text, voice, speed = 1.0, filename } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text is required' });
    }

    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }

    const outputPath = path.join(__dirname, 'exports', filename);

    // Ensure exports directory exists
    const exportsDir = path.dirname(outputPath);
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }

    say.export(text, voice || null, speed, outputPath, (err) => {
        if (err) {
            console.error('TTS export error:', err);
            return res.status(500).json({ error: 'Failed to export audio' });
        }
        res.json({ success: true, message: 'Audio exported successfully', path: outputPath });
    });
});

app.listen(PORT, () => {
    console.log(`SignalFrame COMPREHENSIVE Ingestion Server running at http://localhost:${PORT}`);
});
