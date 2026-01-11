
import { useState, useRef, useEffect } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { RawSignal } from '../services/feedIngest'

interface TrendTooltipProps {
    item: RawSignal;
}

function TrendTooltip({ item }: TrendTooltipProps) {
    if (!item.relatedNews || item.relatedNews.length === 0) return null;

    return (
        <div className="absolute z-50 top-0 ml-3 w-80 bg-[#1a1a2e]/100 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
            {/* Arrow pointer */}
            <div className="absolute left-0 top-4 -translate-x-full">
                <div className="w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white/20"></div>
            </div>

            {/* Header with traffic info */}
            <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-accent-primary/20 to-transparent">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent-primary uppercase tracking-wider">
                        🔥 Related Stories
                    </span>
                    {item.approxTraffic && (
                        <span className="text-[0.65rem] px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary rounded-full font-medium">
                            {item.approxTraffic} searches
                        </span>
                    )}
                </div>
            </div>

            {/* Related news list */}
            <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
                {item.relatedNews.map((news, idx) => (
                    <a
                        key={idx}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/10 transition-all group/news border border-transparent hover:border-accent-primary/30"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {news.picture && (
                            <img
                                src={news.picture}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover/news:opacity-100 transition-opacity"
                            />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary group-hover/news:text-accent-primary transition-colors line-clamp-2 leading-snug">
                                {news.title}
                            </p>
                            <span className="text-[0.6rem] text-accent-secondary mt-1 block font-semibold uppercase">
                                {news.source}
                            </span>
                        </div>
                        <svg className="w-3.5 h-3.5 text-accent-primary opacity-0 group-hover/news:opacity-100 transition-opacity flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02]">
                <span className="text-[0.6rem] text-text-secondary">
                    Click trend to Google search • Click article to read
                </span>
            </div>
        </div>
    );
}

function FeedItem({ item, activeTooltipId, onSetActiveTooltip }: { item: RawSignal, activeTooltipId: string | null, onSetActiveTooltip: (id: string | null) => void }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isTrend = item.category === 'Trends' && item.relatedNews && item.relatedNews.length > 0;
    const showTooltip = isTrend && activeTooltipId === item.id;

    // For trends, get just the trend term (before the colon)
    const displayTitle = isTrend
        ? item.content.split(':')[0].trim()
        : item.content.split('. ')[0];

    // Handle mouse events on the entire container (item + tooltip)
    const handleMouseEnter = () => {
        if (isTrend) onSetActiveTooltip(item.id);
    };

    const handleMouseLeave = (e: React.MouseEvent) => {
        if (!isTrend) return;
        // Check if we're still within the container
        const container = containerRef.current;
        if (container) {
            const rect = container.getBoundingClientRect();
            const { clientX, clientY } = e;
            // Add some padding for the tooltip on the right
            if (clientX >= rect.left && clientX <= rect.right + 340 &&
                clientY >= rect.top && clientY <= rect.bottom) {
                return; // Still within bounds, don't close
            }
        }
        onSetActiveTooltip(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={`group block bg-white/[0.03] hover:bg-white/[0.08] border p-3 rounded-lg transition-all ${showTooltip ? 'border-accent-primary/40 bg-white/[0.06] ring-1 ring-accent-primary/20' : 'border-white/5'
                    }`}
            >
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 flex items-start gap-3">
                        {/* Thumbnail for all feeds if available */}
                        {item.picture ?
                            <img
                                src={item.picture}
                                alt=""
                                className="w-32 h-32 rounded-lg object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            : (
                                <div className="w-32 h-32 rounded-lg object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                    <svg className="text-white/10 w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                            )}
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug">
                                    {displayTitle}
                                </p>
                                {/* Traffic badge for trends */}
                                {isTrend && item.approxTraffic && (
                                    <span className="text-[0.55rem] px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary rounded-full font-medium whitespace-nowrap flex-shrink-0">
                                        {item.approxTraffic}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-[0.65rem] font-bold text-accent-secondary uppercase tracking-tight">
                                            {item.source}
                                        </span>
                                        <span className="text-[0.6rem] text-text-secondary">
                                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                        </span>
                                        {isTrend && (
                                            <span className="text-[0.55rem] text-accent-primary/80 flex items-center gap-1">
                                                <span className="inline-block w-1 h-1 rounded-full bg-accent-primary animate-pulse"></span>
                                                {item.relatedNews?.length} articles
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">{item.content.replace(item.title + '.' || '', '')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </a>

            {/* Side tooltip for trends */}
            {
                showTooltip && isTrend && (
                    <TrendTooltip item={item} />
                )
            }
        </div >
    );
}

export function SourceFeedList() {
    const { feeds, isProcessing, refreshFeeds } = useSituationStore()
    const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

    if (!isProcessing && feeds.length === 0) {
        return null
    }

    // Split feeds
    const trendFeeds = feeds.filter(f => f.category === 'Trends');
    const rssFeeds = feeds.filter(f => f.category !== 'Trends');

    // Group RSS feeds by category
    const rssCategories = rssFeeds.reduce((acc, feed) => {
        if (!acc[feed.category]) acc[feed.category] = []
        acc[feed.category].push(feed)
        return acc
    }, {} as Record<string, typeof feeds>)

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
                <button
                    onClick={() => refreshFeeds()}
                    disabled={isProcessing}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <path d="M3 3v5h5"></path>
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                        <path d="M16 21h5v-5"></path>
                    </svg>
                    {isProcessing ? 'Refreshing...' : 'Regenerate'}
                </button>
            </h2>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* LEFT COLUMN: RSS Feeds (Standard) */}
                <div className="w-full lg:w-2/3 space-y-8 order-1 lg:order-1">
                    {Object.entries(rssCategories).map(([category, items]) => (
                        <div key={category}>
                            <h3 className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 flex items-center gap-2">
                                <span className="w-4 h-4">
                                    {category === 'World' && "🌍"}
                                    {category === 'Business' && "💲"}
                                    {category === 'Technology' && "🤖"}
                                    {category === 'Health' && "💊"}
                                    {category === 'Science' && "🔬"}
                                    {category === 'Politics' && "🏦"}
                                </span>
                                {category}
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {items.map((item) => (
                                    <FeedItem
                                        key={item.id}
                                        item={item}
                                        activeTooltipId={activeTooltipId}
                                        onSetActiveTooltip={setActiveTooltipId}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* RIGHT COLUMN: Google Trends (Sticky/Separate) */}
                {trendFeeds.length > 0 && (
                    <div className="w-full lg:w-1/3 order-2 lg:order-2">
                        <div className="lg:sticky lg:top-6">
                            <h3 className="text-xs uppercase tracking-[0.2em] text-accent-primary mb-4 flex items-center gap-2">
                                <span className="w-4 h-4">🗣️</span>
                                Global Trends
                            </h3>
                            <div className="flex flex-col gap-3">
                                {trendFeeds.map((item) => (
                                    <FeedItem
                                        key={item.id}
                                        item={item}
                                        activeTooltipId={activeTooltipId}
                                        onSetActiveTooltip={setActiveTooltipId}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isProcessing && (
                <div className="mt-6 flex items-center justify-center gap-2 text-text-secondary text-xs italic animate-pulse">
                    Ingesting live data streams...
                </div>
            )}
        </section>
    )
}
