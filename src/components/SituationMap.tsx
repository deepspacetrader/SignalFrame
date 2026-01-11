
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useSituationStore, MapPoint } from '../state/useSituationStore'
import 'leaflet/dist/leaflet.css'

const categoryColors: Record<string, string> = {
    'Tech / AI': '#3b82f6',
    'Financial': '#ec4899',
    'Conflicts': '#eab308',
    'Geopolitical': '#94a3b8'
}

const categoryIcons: Record<string, string> = {
    'Tech / AI': '🤖',
    'Financial': '💲',
    'Conflicts': '⚔️',
    'Geopolitical': '🌍'
}

const sentimentColors: Record<string, string> = {
    'extremely-negative': '#ff1f1f',
    'very-negative': '#ef4444',
    'negative': '#f97316',
    'somewhat-negative': '#facc15',
    'neutral': '#64748b',
    'interesting': '#3b82f6',
    'positive': '#22c55e',
    'very-positive': '#10b981'
}

const resolveSentiment = (s: string) => {
    const sentiment = String(s || 'neutral').toLowerCase().trim()
    const mapping: Record<string, string> = {
        '1': 'extremely-negative', '2': 'very-negative', '3': 'negative', '4': 'somewhat-negative',
        '5': 'neutral', '6': 'interesting', '7': 'positive', '8': 'very-positive',
        'tension': 'negative', 'conflict': 'extremely-negative'
    }
    return mapping[sentiment] || sentiment
}


// Custom marker factory based on category and sentiment
const createCustomIcon = (point: MapPoint) => {
    const color = categoryColors[point.category] || '#94a3b8'
    const sentiment = resolveSentiment(point.sentiment)
    const outline = sentimentColors[sentiment] || sentimentColors.neutral
    const iconChar = categoryIcons[point.category] || '📍'

    return L.divIcon({
        className: 'custom-map-pin',
        html: `
      <div style="
        width: 24px; 
        height: 24px; 
        background-color: ${outline}; 
        border: 2px solid white; 
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        position: relative;
      ">
        <span style="z-index: 2; line-height: 1;">${iconChar}</span>
         <div style="
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid ${outline};
            opacity: 0.6;
         "></div>
      </div>
    `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    })
}

export function SituationMap() {
    const { mapPoints, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
    const isLoading = isProcessingSection.map && !isProcessing;

    return (
        <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 h-[500px] flex flex-col ${isLoading ? 'section-loading' : ''}`}>
            {isLoading && (
                <div className="section-loading-overlay rounded-2xl z-10">
                    <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-[0.6rem] uppercase tracking-widest font-bold text-accent-primary text-center px-4">Recalculating Geo-Coordinates...</span>
                </div>
            )}

            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold m-0 flex items-center gap-3 text-text-primary font-display">
                    <div className="w-1 h-5 bg-accent-primary rounded-full"></div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Geospatial Awareness
                </h2>

                {mapPoints.length > 0 && !isProcessing && (
                    <button
                        onClick={() => refreshSection('map')}
                        className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
                    >
                        Regenerate
                    </button>
                )}
            </div>

            <div className="flex-1 rounded-xl overflow-hidden border border-white/5 bg-[#0a0c10]">
                <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%', background: '#0a0c10' }}
                    zoomControl={true}
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    />
                    {(mapPoints || []).map((point) => (
                        <Marker
                            key={point.id}
                            position={[point.lat || 0, point.lng || 0]}
                            icon={createCustomIcon(point)}
                        >
                            <Tooltip direction="top" offset={[0, -12]} opacity={1} className="custom-tooltip">
                                <span className="font-bold text-xs">{point.title}</span> <span className="text-[10px] opacity-70">({point.category})</span>
                            </Tooltip>

                            <Popup className="custom-popup">
                                <div className="p-1.5 max-w-[200px]">
                                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-0.5">{point.title}</h4>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span
                                            className="text-[8px] font-bold px-1 py-0.5 rounded"
                                            style={{
                                                color: (sentimentColors as any)[resolveSentiment(point.sentiment)] || '#64748b',
                                                backgroundColor: `${(sentimentColors as any)[resolveSentiment(point.sentiment)] || '#64748b'}20`
                                            }}
                                        >
                                            {resolveSentiment(point.sentiment).replace('-', ' ').toUpperCase()}
                                        </span>
                                        <span className="text-[8px] uppercase text-slate-400 tracking-wider">
                                            {point.category}
                                        </span>
                                    </div>
                                    {point.description && (
                                        <p className="text-[10px] text-slate-600 leading-snug mb-1.5">
                                            {point.description}
                                        </p>
                                    )}
                                    {point.sourceLink && (
                                        <a
                                            href={point.sourceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                        >
                                            Read article
                                        </a>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </section>
    )
}
