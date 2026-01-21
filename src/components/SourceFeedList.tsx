import { useState, useRef, useMemo, useCallback, memo } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { RawSignal } from '../services/feedIngest'


const FeedItem = memo(({ item }: { item: RawSignal }) => {
    // Memoize expensive computations
    const displayTitle = useMemo(() => {
        return item.title || item.content.split('. ')[0];
    }, [item.title, item.content]);

    const formattedTime = useMemo(() => {
        return new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    }, [item.timestamp]);

    const contentWithoutTitle = useMemo(() => {
        return item.content.replace(item.title + '.' || '', '');
    }, [item.content, item.title]);

    const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        e.currentTarget.style.display = 'none';
    }, []);

    const [imageLoaded, setImageLoaded] = useState(false);
    const imageRef = useRef<HTMLImageElement>(null);

    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
    }, []);

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-3 rounded-lg transition-all duration-200 hover:border-white/10 will-change-transform"
        >
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 flex items-start gap-3">
                    {/* Thumbnail if available */}
                    {item.picture ? (
                        <div className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                            <img
                                ref={imageRef}
                                src={item.picture}
                                alt=""
                                loading="lazy"
                                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-70 group-hover:opacity-100' : 'opacity-0'}`}
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                            />
                            {!imageLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                                    <svg className="text-white/10 w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-32 h-32 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center">
                            <svg className="text-white/10 w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    )}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[0.65rem] font-bold text-accent-secondary uppercase tracking-tight">
                                {item.source}
                            </span>
                            <span className="text-[0.6rem] text-text-secondary">
                                {formattedTime}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors duration-200 line-clamp-2 leading-snug mb-2">
                            {displayTitle}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                            {contentWithoutTitle}
                        </p>
                    </div>
                </div>
            </div>
        </a>
    );
});

FeedItem.displayName = 'FeedItem';

export function SourceFeedList({ onAIRequired }: { onAIRequired?: () => void }) {
    const { feeds, isProcessing, refreshFeeds, exportSnapshot } = useSituationStore()

    // Memoize RSS feed grouping to prevent recalculation on every render
    const rssCategories = useMemo(() => {
        return feeds.reduce((acc, feed) => {
            if (!acc[feed.category]) acc[feed.category] = []
            acc[feed.category].push(feed)
            return acc
        }, {} as Record<string, typeof feeds>)
    }, [feeds])

    // Virtualization: Limit initial render to first few items per category
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const ITEMS_PER_CATEGORY = 6;

    const toggleCategory = useCallback((category: string) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(category)) {
                newSet.delete(category);
            } else {
                newSet.add(category);
            }
            return newSet;
        });
    }, []);

    // Always show the component, even if feeds are empty
    // This allows users to see the export button and regenerate feeds

    return (
        <section className="bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-text-primary font-display">
                <div className="w-1 h-5 bg-text-secondary rounded-full"></div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9"></path>
                    <path d="M4 4a16 16 0 0 1 16 16"></path>
                    <circle cx="5" cy="19" r="1"></circle>
                </svg>
                Data Feeds
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => {
                            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                            if (!isLocalhost) {
                                onAIRequired?.();
                                return;
                            }
                            exportSnapshot();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export snapshot with feeds to JSON file"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export
                    </button>
                    <button
                        onClick={() => {
                            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                            if (!isLocalhost) {
                                onAIRequired?.();
                                return;
                            }
                            refreshFeeds();
                        }}
                        disabled={isProcessing}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Refreshing...' : 'Regenerate'}
                    </button>
                </div>
            </h2>

            <div className="space-y-8">
                {Object.entries(rssCategories).length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-text-secondary text-sm">
                            {isProcessing ? 'Loading feeds...' : 'No RSS feeds available for this date.'}
                        </p>
                        {!isProcessing && (
                            <p className="text-text-secondary text-xs mt-2">
                                {window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
                                    ? 'Run "SCAN WITH AI" to fetch live RSS feeds. They will be automatically saved to snapshot files for the demo website.'
                                    : 'RSS feeds will appear here when available in the snapshot.'}
                            </p>
                        )}
                    </div>
                )}
                {Object.entries(rssCategories).map(([category, items]) => (
                    <div key={category}>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 flex items-center gap-2">
                            <span className="w-4 h-4">
                                {category === 'World' && "🌍"}
                                {category === 'Business' && "💲"}
                                {category === 'Technology' && "🤖"}
                                {category === 'Health' && "💊"}
                                {category === 'Science' && "🔬"}
                                {category === 'Geopolitical' && "🏛️"}
                                {category === 'Local' && "🏡"}
                            </span>
                            {category}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {items.slice(0, expandedCategories.has(category) ? items.length : ITEMS_PER_CATEGORY).map((item) => (
                                <FeedItem
                                    key={item.id}
                                    item={item}
                                />
                            ))}
                        </div>
                        {items.length > ITEMS_PER_CATEGORY && (
                            <button
                                onClick={() => toggleCategory(category)}
                                className="mt-3 text-xs text-white hover:text-accent-tertiary/80 transition-colors font-medium"
                            >
                                {expandedCategories.has(category) ? `Show less (${items.length - ITEMS_PER_CATEGORY} items hidden)` : `Show ${items.length - ITEMS_PER_CATEGORY} more items`}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {isProcessing && (
                <div className="mt-6 flex items-center justify-center gap-2 text-text-secondary text-xs italic animate-pulse">
                    Ingesting live data streams...
                </div>
            )}
        </section>
    )
}
