import React, { useEffect, useRef, useState, memo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ORS_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjcyOGZlNWE3OWJjZjRjZThiOGI4Zjg3N2JiNWE1OGFjIiwiaCI6Im11cm11cjY0In0=';

// ── Google Maps-style tile (Carto Voyager — clean, labelled, familiar) ────────
const TILE_URL   = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

// ── Custom marker factory ──────────────────────────────────────────────────────
function makeIcon(emoji, size = 36) {
  return L.divIcon({
    html: `<div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));transform:translateY(-4px)">${emoji}</div>`,
    className: '',
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

const ICONS = {
  pickup: makeIcon('📦', 36),
  drop:   makeIcon('🏠', 36),
  agent:  makeIcon('🛵', 40),
};

// ── FitBounds: auto-zooms map to show all markers ─────────────────────────────
function FitBounds({ coords }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    if (!coords || coords.length === 0) return;
    const key = JSON.stringify(coords);
    if (key === prev.current) return; // avoid infinite zoom loop
    prev.current = key;
    try {
      const bounds = L.latLngBounds(coords);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: false });
      }
    } catch (_) {}
  }, [map, coords]);
  return null;
}

// ── InvalidateSize: fixes zoom glitch by telling Leaflet its real size ─────────
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    // Immediately + after CSS/layout settles
    map.invalidateSize({ animate: false });
    const t = setTimeout(() => map.invalidateSize({ animate: false }), 250);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

// ── ResizeObserver: re-invalidates when container resizes (tab switches, etc.) ─
function ResizeWatcher() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// ── Route line uses ORS, falls back to straight line ─────────────────────────
function RouteLayer({ pickupCoords, dropCoords }) {
  const [points, setPoints]     = useState([]);
  const [info, setInfo]         = useState(null);
  const [fallback, setFallback] = useState(false);
  const fetchKey = useRef('');

  useEffect(() => {
    if (!pickupCoords || !dropCoords) return;
    const key = `${pickupCoords.lat},${pickupCoords.lng}_${dropCoords.lat},${dropCoords.lng}`;
    if (key === fetchKey.current) return;
    fetchKey.current = key;

    const from = [pickupCoords.lng, pickupCoords.lat];
    const to   = [dropCoords.lng,   dropCoords.lat];

    fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [from, to] }),
    })
      .then(r => r.json())
      .then(data => {
        const feature = data?.features?.[0];
        if (!feature) throw new Error('no feature');
        const lls = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        setPoints(lls);
        setFallback(false);
        const seg = feature.properties?.segments?.[0];
        if (seg) setInfo({ distance: (seg.distance / 1000).toFixed(1), duration: Math.round(seg.duration / 60) });
      })
      .catch(() => {
        setFallback(true);
        setPoints([
          [pickupCoords.lat, pickupCoords.lng],
          [dropCoords.lat,   dropCoords.lng],
        ]);
      });
  }, [pickupCoords, dropCoords]);

  return (
    <>
      {points.length > 0 && (
        <Polyline
          positions={points}
          pathOptions={{ color: '#1a73e8', weight: 5, opacity: 0.85, lineJoin: 'round', lineCap: 'round' }}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LiveMap — Google Maps-style delivery tracking
//
// Props:
//   pickupCoords  { lat, lng }
//   dropCoords    { lat, lng }
//   agentCoords   { lat, lng }
//   showRoute     bool
//   height        string
//   label         string
//   allAgents     [{ id, name, lat, lng, task? }]   admin bulk view
// ═══════════════════════════════════════════════════════════════════════════════
const LiveMap = memo(({
  pickupCoords,
  dropCoords,
  agentCoords,
  showRoute = true,
  height = '320px',
  label,
  allAgents,
}) => {
  const center = agentCoords || pickupCoords || dropCoords
    || (allAgents?.[0] ? { lat: allAgents[0].lat, lng: allAgents[0].lng } : null)
    || { lat: 13.0604, lng: 80.2496 };

  const boundsCoords = [
    pickupCoords  && [pickupCoords.lat,  pickupCoords.lng],
    dropCoords    && [dropCoords.lat,    dropCoords.lng],
    agentCoords   && [agentCoords.lat,   agentCoords.lng],
    ...(allAgents || []).map(a => [a.lat, a.lng]),
  ].filter(Boolean);

  return (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', border: '1.5px solid rgba(0,0,0,0.08)' }}>
      {/* ETA / Info badge */}
      {label && (
        <div style={{
          position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(15,15,20,0.88)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.12)', borderRadius: '40px',
          padding: '6px 16px', color: '#fff', fontSize: '0.8rem',
          fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          🛵 {label}
        </div>
      )}

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        style={{ height, width: '100%' }}
        zoomControl={false}
        attributionControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
      >
        {/* Google Maps-look tile */}
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} maxZoom={21} />

        {/* Zoom control — bottom right (like Google Maps) */}
        <ZoomControl position="bottomright" />

        {/* Fix handlers */}
        <InvalidateOnMount />
        <ResizeWatcher />

        {/* Auto-fit bounds */}
        {boundsCoords.length > 0 && <FitBounds coords={boundsCoords} />}

        {/* Route */}
        {showRoute && pickupCoords && dropCoords && (
          <RouteLayer pickupCoords={pickupCoords} dropCoords={dropCoords} />
        )}

        {/* Pickup pin */}
        {pickupCoords && (
          <Marker position={[pickupCoords.lat, pickupCoords.lng]} icon={ICONS.pickup}>
            <Popup><strong>📦 Pickup Location</strong></Popup>
          </Marker>
        )}

        {/* Drop / center pin */}
        {dropCoords && (
          <Marker position={[dropCoords.lat, dropCoords.lng]} icon={ICONS.drop}>
            <Popup><strong>🏠 Destination / Center</strong></Popup>
          </Marker>
        )}

        {/* Single agent pin */}
        {agentCoords && (
          <Marker position={[agentCoords.lat, agentCoords.lng]} icon={ICONS.agent}>
            <Popup><strong>🛵 {label || 'Agent'}</strong><br />Live Location</Popup>
          </Marker>
        )}

        {/* All-agents (admin bulk view) */}
        {allAgents && allAgents.map(a => (
          <Marker key={a.id} position={[a.lat, a.lng]} icon={ICONS.agent}>
            <Popup>
              <strong>🛵 {a.name}</strong><br />
              {a.task ? `Delivering: ${a.task}` : 'Live'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
});

LiveMap.displayName = 'LiveMap';
export default LiveMap;
