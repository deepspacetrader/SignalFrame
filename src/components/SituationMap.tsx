
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { useSituationStore, MapPoint } from '../state/useSituationStore'
import 'leaflet/dist/leaflet.css'

const categoryColors: Record<string, string> = {
    'Tech / AI': '#3b82f6',
    'Financial': '#ec4899',
    'Conflicts': '#eab308',
    'Geopolitical': '#94a3b8'
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

// Custom marker factory based on category and sentiment
const createCustomIcon = (point: MapPoint) => {
    const color = categoryColors[point.category] || '#94a3b8'
    const outline = sentimentColors[point.sentiment] || sentimentColors.neutral

    return L.divIcon({
        className: 'custom-map-pin',
        html: `
      <div style="
        width: 20px; 
        height: 20px; 
        background-color: ${color}; 
        border: 3px solid ${outline}; 
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
      "></div>
    `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    })
}

export function SituationMap() {
    const { mapPoints, isProcessing, isProcessingSection, refreshSection } = useSituationStore()
    const isLoading = isProcessingSection.map && !isProcessing;

    return (
        <section className={`relative bg-bg-card backdrop-blur-xl border border-white/10 rounded-2xl p-6 transition-all hover:border-white/20 h-[500px] flex flex-col ${isLoading ? 'section-loading' : ''}`}>
            {isLoading && (
                <div className="section-loading-overlay rounded-2xl">
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

            <div className="flex-1 rounded-xl overflow-hidden border border-white/5">
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
                            position={[point.lat, point.lng]}
                            icon={createCustomIcon(point)}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1">
                                    <h4 className="font-bold text-slate-900 leading-tight mb-1">{point.title}</h4>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                            {point.category}
                                        </span>
                                        <span
                                            className="text-[10px] font-bold"
                                            style={{ color: (sentimentColors as any)[point.sentiment] || '#64748b' }}
                                        >
                                            {String(point.sentiment || 'neutral').replace('-', ' ').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </section>
    )
}
