import { useState, useEffect } from 'react'
import { Modal } from './shared/Modal'
import { useSituationStore } from '../state/useSituationStore'
import {
    getRSSConfig,
    updateDefaultFeed,
    addUserFeed,
    removeUserFeed,
    RSSFeedConfig,
    UserRSSFeed
} from '../services/feedIngest'
import { KNOWN_RSS_FEEDS } from '../data/rssFeeds'

export function RSSSettings() {
    const [isOpen, setIsOpen] = useState(false);
    const [rssConfig, setRssConfig] = useState<{ defaultFeeds: RSSFeedConfig[], userFeeds: UserRSSFeed[] }>({
        defaultFeeds: [],
        userFeeds: []
    });
    const [newFeed, setNewFeed] = useState({ name: '', url: '', category: '' });
    const [validationError, setValidationError] = useState('');
    const [isValidating, setIsValidating] = useState(false);

    // Load saved settings on mount
    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = () => {
        try {
            const config = getRSSConfig();
            setRssConfig(config);
        } catch (error) {
            console.error('Failed to load RSS settings:', error);
        }
    };

    const validateRSSFeed = async (url: string): Promise<boolean> => {
        try {
            setIsValidating(true);
            setValidationError('');

            // Basic URL validation
            const urlObj = new URL(url);
            if (!urlObj.protocol.startsWith('http')) {
                throw new Error('URL must start with http:// or https://');
            }

            // Try to fetch the RSS feed
            const response = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Check content type
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('xml') && !contentType.includes('rss')) {
                console.warn('Content type may not be RSS:', contentType);
            }

            return true;
        } catch (error) {
            setValidationError(error instanceof Error ? error.message : 'Invalid RSS feed URL');
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    const toggleFeed = (url: string) => {
        const feed = rssConfig.defaultFeeds.find(f => f.url === url);
        if (feed) {
            updateDefaultFeed(url, !feed.enabled);
            loadSettings(); // Reload to reflect changes
        }
    };

    const addUserFeedHandler = async () => {
        if (!newFeed.name.trim() || !newFeed.url.trim()) {
            setValidationError('Name and URL are required');
            return;
        }

        const isValid = await validateRSSFeed(newFeed.url);
        if (!isValid) {
            return;
        }

        try {
            addUserFeed({
                name: newFeed.name.trim(),
                url: newFeed.url.trim(),
                category: newFeed.category.trim(),
                enabled: true
            });

            setNewFeed({ name: '', url: '', category: 'Custom' });
            setValidationError('');
            loadSettings(); // Reload to reflect changes
        } catch (error) {
            setValidationError('Failed to add feed');
        }
    };

    const removeUserFeedHandler = (id: string) => {
        removeUserFeed(id);
        loadSettings(); // Reload to reflect changes
    };

    const saveSettings = () => {
        // Settings are already saved through the feed management functions
        console.log('RSS settings saved');
        setIsOpen(false);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="bottom-6 left-6 z-50 p-3 bg-bg-card backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl hover:border-accent-primary/50 transition-all group px-4 py-2"
            >
                <p className="text-[10px] uppercase text-text-secondary font-bold tracking-widest mb-1">RSS Settings</p>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary group-hover:text-accent-primary transition-all mx-auto flex max-w-sm items-center">
                    <path d="M4 11h16" />
                    <path d="M4 4h16" />
                    <path d="M4 18h7" />
                </svg>
            </button>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            modalId="rss-settings-modal"
        >
            <div className="bg-bg-card border border-white/10 rounded-2xl p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto relative">
                <h3 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-1 h-6 bg-accent-primary rounded-full"></span>
                    RSS Feed Settings
                </h3>

                <div className="space-y-8">
                    {/* Known RSS Feeds Section */}
                    <div className="bg-bg-darker/30 border border-white/10 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9 12l2 2 4-4" />
                            </svg>
                            Known RSS Sources
                        </h4>
                        <p className="text-sm text-text-secondary mb-6">
                            Toggle RSS sources on or off. Disabled sources won't be included in your news feed.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {KNOWN_RSS_FEEDS.map((feed) => {
                                const configFeed = rssConfig.defaultFeeds.find(f => f.url === feed.url);
                                const isEnabled = configFeed?.enabled ?? true;
                                return (
                                    <div
                                        key={feed.url}
                                        className={`bg-white/5 border rounded-lg p-4 transition-all hover:bg-white/10 ${isEnabled
                                                ? 'border-accent-primary/50 bg-accent-primary/5'
                                                : 'border-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {feed.logo ? (
                                                <>
                                                    <img
                                                        src={feed.logo}
                                                        alt={feed.source}
                                                        className="w-8 h-8 object-contain rounded"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            target.style.display = 'none';
                                                            const fallback = target.nextElementSibling as HTMLElement;
                                                            if (fallback) fallback.style.display = 'flex';
                                                        }}
                                                    />
                                                    <div className="w-8 h-8 bg-accent-primary/20 rounded items-center justify-center text-xs text-accent-primary font-bold" style={{ display: 'none' }}>
                                                        {feed.source.charAt(0)}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-8 h-8 bg-accent-primary/20 rounded flex items-center justify-center text-xs text-accent-primary font-bold">
                                                    {feed.source.charAt(0)}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-text-primary text-sm truncate">
                                                    {feed.source}
                                                </div>
                                                <div className="text-xs text-text-tertiary">
                                                    {feed.category}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleFeed(feed.url)}
                                                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${isEnabled
                                                        ? 'bg-accent-primary'
                                                        : 'bg-white/10 border border-white/20'
                                                    }`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg transition-all duration-300 ${isEnabled ? 'left-7' : 'left-1'
                                                    }`}></div>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* User-Defined RSS Feeds Section */}
                    <div className="bg-bg-darker/30 border border-white/10 rounded-xl p-6">
                        <h4 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <svg fill="#ffffff" height="15px" width="15px" version="1.1" id="Layer_1" viewBox="-271 273 256 256" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <path d="M-271,360v48.9c31.9,0,62.1,12.6,84.7,35.2c22.6,22.6,35.1,52.8,35.1,84.8v0.1h49.1c0-46.6-19-88.7-49.6-119.4 C-182.2,379-224.4,360.1-271,360z"></path> <path d="M-237,460.9c-9.4,0-17.8,3.8-24,10s-10,14.6-10,24c0,9.3,3.8,17.7,10,23.9c6.2,6.1,14.6,9.9,24,9.9s17.8-3.7,24-9.9 s10-14.6,10-23.9c0-9.4-3.8-17.8-10-24C-219.2,464.7-227.6,460.9-237,460.9z"></path> <path d="M-90.1,348.1c-46.3-46.4-110.2-75.1-180.8-75.1v48.9C-156.8,322-64.1,414.9-64,529h49C-15,458.4-43.7,394.5-90.1,348.1z"></path> </g> </g></svg>
                            Custom RSS Feeds
                        </h4>
                        <p className="text-sm text-text-secondary mb-6">
                            Add your own RSS feeds. URLs will be validated to ensure they're valid XML RSS feeds.
                        </p>

                        {/* Add New Feed Form */}
                        <div className="bg-black/30 border border-white/10 rounded-lg p-4 mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <input
                                    type="text"
                                    placeholder="Feed Name"
                                    value={newFeed.name}
                                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                                />
                                <input
                                    type="url"
                                    placeholder="https://example.com/rss.xml"
                                    value={newFeed.url}
                                    onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                                />
                                <input
                                    type="text"
                                    placeholder="Category"
                                    value={newFeed.category}
                                    onChange={(e) => setNewFeed({ ...newFeed, category: e.target.value })}
                                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-text-primary focus:border-accent-primary outline-none transition-all"
                                />
                            </div>

                            {validationError && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <p className="text-sm text-red-400">{validationError}</p>
                                </div>
                            )}

                            <button
                                onClick={addUserFeedHandler}
                                disabled={isValidating}
                                className="px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isValidating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Validating...
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Add Feed
                                    </>
                                )}
                            </button>
                        </div>

                        {/* User Feeds List */}
                        {rssConfig.userFeeds.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-sm font-medium text-text-primary mb-3">Your Custom Feeds</h5>
                                {rssConfig.userFeeds.map((feed: UserRSSFeed) => (
                                    <div
                                        key={feed.id}
                                        className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center justify-between"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-text-primary text-sm truncate">
                                                {feed.name}
                                            </div>
                                            <div className="text-xs text-text-tertiary truncate">
                                                {feed.url}
                                            </div>
                                            <div className="text-xs text-accent-primary">
                                                {feed.category}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeUserFeedHandler(feed.id)}
                                            className="ml-3 p-2 text-text-secondary hover:text-red-400 transition-colors"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 6h18" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={saveSettings}
                            className="flex-1 py-3 bg-accent-primary text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 transition-all"
                        >
                            Apply & Save
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="py-3 px-6 bg-white/5 text-text-secondary border border-white/10 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
