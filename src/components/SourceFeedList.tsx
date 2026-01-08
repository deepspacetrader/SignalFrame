
import { useSituationStore } from '../state/useSituationStore'

export function SourceFeedList() {
    const { feeds, isProcessing } = useSituationStore()

    // Group feeds by category
    const categories = feeds.reduce((acc, feed) => {
        if (!acc[feed.category]) acc[feed.category] = []
        acc[feed.category].push(feed)
        return acc
    }, {} as Record<string, typeof feeds>)

    if (!isProcessing && feeds.length === 0) {
        return null
    }

    return (
        <section className="bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-3 text-text-primary font-display">
                <div className="w-1 h-5 bg-text-secondary rounded-full"></div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 11a9 9 0 0 1 9 9"></path>
                    <path d="M4 4a16 16 0 0 1 16 16"></path>
                    <circle cx="5" cy="19" r="1"></circle>
                </svg>
                Raw Intelligence Feeds
            </h2>

            <div className="space-y-8">
                {Object.entries(categories).map(([category, items]) => (
                    <div key={category}>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-text-secondary mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary"></span>
                            {category}
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {items.map((item) => (
                                <a
                                    key={item.id}
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group block bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-3 rounded-lg transition-all"
                                >
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-text-primary group-hover:text-accent-primary transition-colors line-clamp-2 leading-snug">
                                                {item.content.split('. ')[0]}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-[0.65rem] font-bold text-accent-secondary uppercase tracking-tight">
                                                    {item.source}
                                                </span>
                                                <span className="text-[0.6rem] text-text-secondary">
                                                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                                                </span>
                                            </div>
                                        </div>
                                        <svg className="opacity-0 group-hover:opacity-50 transition-opacity mt-1 flex-shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                            <polyline points="15 3 21 3 21 9"></polyline>
                                            <line x1="10" y1="14" x2="21" y2="3"></line>
                                        </svg>
                                    </div>
                                </a>
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
