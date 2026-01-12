import { useState, useRef } from 'react'
import { useSituationStore } from '../state/useSituationStore'
import { RawSignal } from '../services/feedIngest'

function FeedItem({ item }: { item: RawSignal }) {
    // Get the first sentence or title
    const displayTitle = item.title || item.content.split('. ')[0];

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-3 rounded-lg transition-all hover:border-white/10"
        >
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 flex items-start gap-3">
                    {/* Thumbnail if available */}
                    {item.picture ? (
                        <img
                            src={item.picture}
                            alt=""
                            className="w-32 h-32 rounded-lg object-cover flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-lg object-cover flex-shrink-0 opacity-70 group-hover:opacity-100">
                            <svg className="text-white/10 w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug mb-2">
                            {displayTitle}
                        </p>
                        <p className="text-xs text-text-secondary line-clamp-3 leading-relaxed">
                            {item.content.replace(item.title + '.' || '', '')}
                        </p>
                    </div>
                </div>
            </div>
        </a>
    );
}

export function SourceFeedList() {
    const { feeds, isProcessing, refreshFeeds } = useSituationStore()

    if (!isProcessing && feeds.length === 0) {
        return null
    }

    // Group RSS feeds by category
    const rssCategories = feeds.reduce((acc, feed) => {
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

            <div className="space-y-8">
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
                            </span>
                            {category}
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {items.map((item) => (
                                <FeedItem
                                    key={item.id}
                                    item={item}
                                />
                            ))}
                        </div>
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
