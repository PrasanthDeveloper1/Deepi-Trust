import React, { useState, useEffect, useRef } from 'react';
import { Truck, Navigation, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

// Google Maps-style Carto Voyager tile (same as LiveMap)
const TILE_URL  = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap contributors &copy; CARTO';
const CHENNAI   = { lat: 13.0827, lng: 80.2707 };

const TrackingPage = () => {
  const { donations, agentLocations } = useAppContext();
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const mapRef         = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef     = useRef([]);
  const routeLinesRef  = useRef([]);
  const initialized    = useRef(false);

  const activeDeliveries = donations.filter(d => ['assigned', 'picked'].includes(d.status));

  // ── Build real agent positions from AppContext agentLocations ──────────────
  // agentLocations = { agentId: { lat, lng, updated_at } }
  const agentPositions = React.useMemo(() => {
    const out = {};
    activeDeliveries.forEach(del => {
      const loc = agentLocations[del.agent_id];
      if (loc) {
        out[del.agent_id] = { lat: loc.lat, lng: loc.lng, name: del.agent_name };
      } else if (del.pickup_coords) {
        // Fallback: show at pickup location if agent hasn't started GPS yet
        out[del.agent_id] = { lat: del.pickup_coords.lat, lng: del.pickup_coords.lng, name: del.agent_name };
      }
      // No random fallback — we only show what we actually know
    });
    return out;
  }, [agentLocations, activeDeliveries]);

  // ── Initialize Leaflet map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || initialized.current) return;
    initialized.current = true;

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        center: [CHENNAI.lat, CHENNAI.lng],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Google Maps-style tiles
      L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 21 }).addTo(map);

      // Zoom control bottom-right (Google Maps style)
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Attribution bottom-left minimal
      L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

      mapInstanceRef.current = map;

      // Fix blank tile / zoom glitch on mount
      setTimeout(() => map.invalidateSize({ animate: false }), 150);

      // ResizeObserver fix for zoom glitch
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
        ro.observe(mapRef.current);
        map._resizeObserver = ro;
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current._resizeObserver?.disconnect();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        initialized.current = false;
      }
    };
  }, []);

  // ── Update markers whenever real positions arrive ─────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const updateMarkers = async () => {
      const L = await import('leaflet');

      // Clear old markers + route lines
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      routeLinesRef.current.forEach(l => l.remove());
      routeLinesRef.current = [];

      const allLatLngs = [];

      for (const del of activeDeliveries) {
        const agentPos  = agentPositions[del.agent_id];
        const pickup    = del.pickup_coords;
        const center    = del.center_coords || null;
        const isSelected = selectedDelivery?.id === del.id;

        // Agent marker (from real GPS)
        if (agentPos) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              background:${isSelected ? '#2d6a4f' : '#1a73e8'};
              color:#fff; border-radius:50%; width:38px; height:38px;
              display:flex;align-items:center;justify-content:center;
              font-size:18px; box-shadow:0 3px 10px rgba(0,0,0,0.35);
              border:3px solid #fff; cursor:pointer;
              ${isSelected ? 'transform:scale(1.25);' : ''}
            ">🛵</div>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19],
          });
          const m = L.marker([agentPos.lat, agentPos.lng], { icon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<strong>🛵 ${agentPos.name}</strong><br><span style="color:#555;font-size:0.82rem">${del.food_name}</span>`);
          markersRef.current.push(m);
          allLatLngs.push([agentPos.lat, agentPos.lng]);
        }

        // Pickup marker
        if (pickup) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              background:#f59e0b;color:#fff;border-radius:50%;
              width:32px;height:32px;display:flex;align-items:center;
              justify-content:center;font-size:14px;
              box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2.5px solid #fff
            ">📦</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          const m = L.marker([pickup.lat, pickup.lng], { icon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<strong>📦 Pickup</strong><br>${del.pickup_location || ''}`);
          markersRef.current.push(m);
          allLatLngs.push([pickup.lat, pickup.lng]);
        }

        // Drop / center marker
        if (center) {
          const icon = L.divIcon({
            className: '',
            html: `<div style="
              background:#2d6a4f;color:#fff;border-radius:50%;
              width:32px;height:32px;display:flex;align-items:center;
              justify-content:center;font-size:14px;
              box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2.5px solid #fff
            ">🏠</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          const m = L.marker([center.lat, center.lng], { icon })
            .addTo(mapInstanceRef.current)
            .bindPopup(`<strong>🏠 ${del.center_name}</strong>`);
          markersRef.current.push(m);
          allLatLngs.push([center.lat, center.lng]);
        }

        // Route line when selected
        if (isSelected && pickup && center) {
          const waypoints = [
            [pickup.lat, pickup.lng],
            ...(agentPos ? [[agentPos.lat, agentPos.lng]] : []),
            [center.lat, center.lng],
          ];
          const line = L.polyline(waypoints, {
            color: '#1a73e8', weight: 4, opacity: 0.8,
            dashArray: isSelected ? null : '8 8',
          }).addTo(mapInstanceRef.current);
          routeLinesRef.current.push(line);
        }
      }

      // Auto-fit to all markers
      if (allLatLngs.length > 0) {
        try {
          const bounds = L.latLngBounds(allLatLngs);
          if (bounds.isValid()) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 16, animate: true });
          }
        } catch (_) {}
      } else {
        mapInstanceRef.current.setView([CHENNAI.lat, CHENNAI.lng], 13);
      }
    };

    updateMarkers();
  }, [agentPositions, selectedDelivery, activeDeliveries]);

  return (
    <div className="page-content">
      <div className="dash-banner tracking-banner">
        <div className="dash-banner-content">
          <h1>Live GPS Tracking 📍</h1>
          <p>Real-time agent positions pulled directly from their devices.</p>
        </div>
      </div>

      <section className="section" style={{ padding: '2rem 3rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', height: 'calc(100vh - 280px)', minHeight: '520px' }}>
          {/* Map */}
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1.5px solid rgba(0,0,0,0.08)', position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: '520px' }} />

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: '3rem', left: '1rem', zIndex: 1000, background: 'rgba(255,255,255,0.97)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#333' }}>Legend</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span>🛵 Delivery Agent (real GPS)</span>
                <span>📦 Pickup Point</span>
                <span>🏠 Beneficiary Center</span>
              </div>
            </div>

            {/* Live indicator */}
            <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000, background: 'rgba(45,106,79,0.95)', color: '#fff', borderRadius: '50px', padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
              LIVE — Real GPS
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Truck size={20} /> Active Deliveries ({activeDeliveries.length})
            </h3>

            {activeDeliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Navigation size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <p>No active deliveries to track.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Agents appear here only when they accept a job and turn on GPS.</p>
              </div>
            ) : activeDeliveries.map(del => {
              const isSelected = selectedDelivery?.id === del.id;
              const hasLoc = !!agentPositions[del.agent_id];
              return (
                <div key={del.id}
                  className="task-card"
                  style={{ cursor: 'pointer', padding: '1rem', borderLeft: `4px solid ${isSelected ? 'var(--primary)' : 'var(--surface-border)'}`, background: isSelected ? 'rgba(45,106,79,0.04)' : 'var(--bg-white)', transition: 'all 0.2s' }}
                  onClick={() => setSelectedDelivery(isSelected ? null : del)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span className={`badge ${del.status === 'picked' ? 'badge-info' : 'badge-pending'}`}>
                      {del.status === 'picked' ? '🚚 In Transit' : '📦 Pickup'}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{del.id}</span>
                  </div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.25rem' }}>{del.food_name}</h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span>🛵 {del.agent_name}</span>
                    <span>📦 {del.quantity}</span>
                    <span>🏠 → {del.center_name}</span>
                  </div>
                  {/* GPS availability indicator */}
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', color: hasLoc ? '#16a34a' : '#f59e0b', fontWeight: 600 }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: hasLoc ? '#16a34a' : '#f59e0b', flexShrink: 0 }} />
                    {hasLoc ? 'GPS active — location live' : 'Waiting for agent GPS…'}
                  </div>
                </div>
              );
            })}

            {/* Recently Completed */}
            {donations.filter(d => d.status === 'delivered').length > 0 && (
              <>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <CheckCircle size={18} /> Recently Completed
                </h3>
                {donations.filter(d => d.status === 'delivered').slice(0, 3).map(del => (
                  <div key={del.id} className="task-card" style={{ padding: '0.75rem 1rem', opacity: 0.75, borderLeft: '4px solid var(--success)' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>✅ Delivered</span>
                    <h4 style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{del.food_name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{del.agent_name} → {del.center_name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default TrackingPage;
