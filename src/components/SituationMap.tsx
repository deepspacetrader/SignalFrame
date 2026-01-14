
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { useSituationStore, MapPoint } from '../state/useSituationStore'
import { JsonErrorDisplay } from './JsonErrorDisplay'
import 'leaflet/dist/leaflet.css'
import { formatTime } from '../utils/timeUtils'


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
        width: 32px; 
        height: 32px; 
        background: linear-gradient(135deg, ${outline} 0%, ${color} 100%); 
        border: 3px solid white; 
        border-radius: 50%;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4), 0 0 20px ${outline}40;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        position: relative;
        transition: all 0.3s ease;
        cursor: pointer;
      " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
        <span style="z-index: 2; line-height: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">${iconChar}</span>
         <div style="
            position: absolute;
            inset: -6px;
            border-radius: 50%;
            border: 2px solid ${outline};
            opacity: 0.8;
            animation: pulse 2s infinite;
         "></div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 0.4; }
          100% { transform: scale(1); opacity: 0.8; }
        }
      </style>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    })
}

export function SituationMap() {
    const { mapPoints, isProcessing, isProcessingSection, refreshSection, jsonError, clearJsonError, retryJsonSection, sectionGenerationTimes } = useSituationStore()
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
                    <>
                        <button
                            onClick={() => refreshSection('map')}
                            className="text-[0.6rem] uppercase tracking-widest font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all opacity-60 hover:opacity-100"
                        >
                            Regenerate
                        </button>
                        {sectionGenerationTimes.map && (
                            <span className="text-[0.55rem] uppercase tracking-widest text-text-tertiary px-2 py-1">
                                {formatTime(sectionGenerationTimes.map)}
                            </span>
                        )}
                    </>
                )}
            </div>

            {/* JSON Error Display */}
            {jsonError.hasError && jsonError.sectionId === 'map' && (
                <JsonErrorDisplay
                    error={jsonError.error}
                    onRetry={() => retryJsonSection('map')}
                    onCancel={clearJsonError}
                    countdown={5}
                    isRetrying={isProcessingSection.map}
                />
            )}

            <div className="flex-1 rounded-xl overflow-hidden border border-white/5 bg-[#0a0c10]">
                <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%', background: '#0a0c10' }}
                    zoomControl={true}
                    scrollWheelZoom={true}
                    doubleClickZoom={true}
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
                            <Tooltip 
                                direction="top" 
                                offset={[0, -16]} 
                                opacity={1} 
                                className="custom-tooltip"
                                permanent={false}
                            >
                                <div className="text-center">
                                    <span className="font-bold text-xs block">{point.title}</span>
                                    <span className="text-[10px] opacity-70">({point.category})</span>
                                    <span className="text-[9px] block mt-1" style={{ color: sentimentColors[resolveSentiment(point.sentiment)] }}>
                                        {resolveSentiment(point.sentiment).replace('-', ' ').toUpperCase()}
                                    </span>
                                </div>
                            </Tooltip>

                            <Popup className="custom-popup" maxWidth={250}>
                                <div className="p-3 max-w-[250px]">
                                    <h4 className="font-bold text-slate-900 text-sm leading-tight mb-2">{point.title}</h4>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span
                                            className="text-[8px] font-bold px-2 py-1 rounded"
                                            style={{
                                                color: (sentimentColors as any)[resolveSentiment(point.sentiment)] || '#64748b',
                                                backgroundColor: `${(sentimentColors as any)[resolveSentiment(point.sentiment)] || '#64748b'}20`
                                            }}
                                        >
                                            {resolveSentiment(point.sentiment).replace('-', ' ').toUpperCase()}
                                        </span>
                                        <span className="text-[10px] uppercase text-slate-400 tracking-wider">
                                            {point.category}
                                        </span>
                                    </div>
                                    {point.description && (
                                        <p className="text-[11px] text-slate-600 leading-snug mb-3">
                                            {point.description}
                                        </p>
                                    )}
                                    {point.sourceLink && (
                                        <a
                                            href={point.sourceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                                        >
                                            Read source →
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
