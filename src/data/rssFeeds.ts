const bbcNewsLogo = new URL('../images/logo-bbc-news.gif', import.meta.url).href;
const nyTimesLogo = new URL('../images/logo-ny-times.png', import.meta.url).href;
const techcrunchLogo = new URL('../images/logo-techcrunch.webp', import.meta.url).href;

export interface KnownRSSFeed {
    url: string;
    category: string;
    source: string;
    logo?: string;
    enabled?: boolean;
}

export const KNOWN_RSS_FEEDS: KnownRSSFeed[] = [
    // World / Geopolitical
    {
        url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        category: 'World',
        source: 'BBC World',
        logo: bbcNewsLogo,
        enabled: true,
    },
    {
        url: 'https://www.theguardian.com/world/rss',
        category: 'World',
        source: 'The Guardian',
        logo: '../images/logo-guardian.png',
        enabled: true,
    },
    {
        url: 'https://www.aljazeera.com/xml/rss/all.xml',
        category: 'World',
        source: 'Al Jazeera',
        logo: '../images/logo-al-jazeera.png',
        enabled: true,
    },
    {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
        category: 'World',
        source: 'NY Times World',
        logo: nyTimesLogo,
        enabled: true,
    },

    // Business / Financial
    {
        url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
        category: 'Business',
        source: 'MarketWatch',
        logo: '../images/logo-marketwatch.png',
        enabled: true,
    },

    // Technology
    {
        url: 'https://techcrunch.com/feed/',
        category: 'Technology',
        source: 'TechCrunch',
        logo: techcrunchLogo,
        enabled: true,
    },
    {
        url: 'https://www.theverge.com/rss/index.xml',
        category: 'Technology',
        source: 'The Verge',
        logo: '../images/logo-verge.png',
        enabled: true,
    },
    {
        url: 'https://arstechnica.com/feed/',
        category: 'Technology',
        source: 'Ars Technica',
        logo: '../images/logo-ars-technica.png',
        enabled: true,
    },

    // Science
    {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml',
        category: 'Science',
        source: 'NY Times Science',
        logo: nyTimesLogo,
        enabled: true,
    },
    {
        url: 'http://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
        category: 'Science',
        source: 'BBC Science',
        logo: '../images/logo-bbc-news.gif',
        enabled: true,
    },

    // Health
    {
        url: 'http://feeds.bbci.co.uk/news/health/rss.xml',
        category: 'Health',
        source: 'BBC Health',
        logo: '../images/logo-bbc-news.gif',
        enabled: true,
    },
    {
        url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml',
        category: 'Health',
        source: 'NY Times Health',
        logo: nyTimesLogo,
        enabled: true,
    },
];
