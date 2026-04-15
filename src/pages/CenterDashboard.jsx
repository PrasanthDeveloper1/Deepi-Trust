import React, { useState, useRef } from 'react';
import {
  Home, Package, CheckCircle, Clock, Truck, History,
  MapPin, AlertTriangle, Camera, X, Navigation, Eye
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import LiveMap from '../components/LiveMap';

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

const CenterDashboard = () => {
  const { user } = useAuth();
  const { donations, agentLocations, confirmReceipt } = useAppContext();
  const [activeTab, setActiveTab] = useState('incoming');

  // Receipt confirmation modal
  const [receiptModal, setReceiptModal]   = useState(null); // donation
  const [receivedQty, setReceivedQty]     = useState('');
  const [hasDisc, setHasDisc]             = useState(false);
  const [discNote, setDiscNote]           = useState('');
  const [lightboxImg, setLightboxImg]     = useState(null);

  const myDeliveries = donations.filter(d => d.center_id === user?.id);
  const incoming  = myDeliveries.filter(d => ['assigned', 'picked'].includes(d.status));
  const arrived   = myDeliveries.filter(d => d.status === 'delivered');
  const received  = myDeliveries.filter(d => d.status === 'received');

  const centerCoords = user?.coords || { lat: 13.0604, lng: 80.2496 };

  const openReceiptModal = (don) => {
    setReceiptModal(don);
    setReceivedQty(don.pickup_qty_confirmed || don.quantity || '');
    setHasDisc(false);
    setDiscNote('');
  };

  const handleConfirm = () => {
    if (!receiptModal) return;
    confirmReceipt(receiptModal.id, receivedQty, hasDisc, discNote);
    setReceiptModal(null);
  };

  return (
    <div className="page-content">
      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <button onClick={() => setLightboxImg(null)}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={22} />
          </button>
          <img src={lightboxImg} alt="Delivery" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* ── Receipt Confirmation Modal ─────────────────────────────────────── */}
      {receiptModal && (
        <div className="modal-overlay" onClick={() => setReceiptModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(45,106,79,0.12)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                <CheckCircle size={22} color="var(--primary)" />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>Confirm Receipt</h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>{receiptModal.food_name} from {receiptModal.donor_name}</p>
              </div>
            </div>

            {/* Drop photos from agent */}
            {receiptModal.drop_photos?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">📷 Agent Drop-off Photos</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {receiptModal.drop_photos.map((p, i) => (
                    <div key={i} onClick={() => setLightboxImg(p)} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--surface-border)' }}>
                      <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Quantity Received</label>
              <input className="form-control" value={receivedQty} onChange={e => setReceivedQty(e.target.value)}
                placeholder="e.g. 10 kg, 25 plates..." />
              {receiptModal.pickup_qty_confirmed && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Agent reported at pickup: <strong>{receiptModal.pickup_qty_confirmed}</strong>
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg-section)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem' }}>
                <input type="checkbox" checked={hasDisc} onChange={e => setHasDisc(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                Report Discrepancy (quantity or quality issue)
              </label>
              {hasDisc && (
                <textarea className="form-control" style={{ marginTop: '0.75rem', minHeight: '80px', resize: 'vertical' }}
                  value={discNote} onChange={e => setDiscNote(e.target.value)}
                  placeholder="Describe the issue (e.g. quantity short by 2 kg, food quality concerns...)" />
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setReceiptModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleConfirm}>
                <CheckCircle size={16} /> Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner ────────────────────────────────────────────────────────── */}
      <div className="dash-banner center-banner">
        <div className="dash-banner-content">
          <h1>Welcome, {user?.name || 'Center'} 🏠</h1>
          <p>Track incoming deliveries and confirm receipt of food donations.</p>
        </div>
      </div>

      <section className="section">
        {/* Stats */}
        <div className="panel-stats">
          <div className="panel-stat-card">
            <div className="panel-stat-icon yellow"><Truck size={22} /></div>
            <div>
              <div className="panel-stat-value">{incoming.length}</div>
              <div className="panel-stat-label">In Transit</div>
            </div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon blue"><Package size={22} /></div>
            <div>
              <div className="panel-stat-value">{arrived.length}</div>
              <div className="panel-stat-label">Awaiting Confirmation</div>
            </div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><CheckCircle size={22} /></div>
            <div>
              <div className="panel-stat-value">{received.length}</div>
              <div className="panel-stat-label">Confirmed Received</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === 'incoming' ? 'active' : ''}`} onClick={() => setActiveTab('incoming')}>
            <Truck size={16} /> Incoming ({incoming.length + arrived.length})
          </button>
          <button className={`dash-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={16} /> History ({received.length})
          </button>
        </div>

        {/* ── Incoming Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'incoming' && (
          <div>
            {/* Arrived — needs confirmation */}
            {arrived.length > 0 && (
              <>
                <div className="panel-header" style={{ marginTop: '0' }}>
                  <div>
                    <h1 style={{ fontSize: '1.5rem' }}>⚠️ Confirm Receipt</h1>
                    <p>These deliveries have arrived. Please verify and confirm.</p>
                  </div>
                </div>
                <div className="cards-grid" style={{ marginBottom: '3rem' }}>
                  {arrived.map(don => (
                    <div key={don.id} className="task-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                      <div className="task-card-header">
                        <span className="badge badge-pending">📦 Delivered — Confirm</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{don.id}</span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{don.food_name}</h3>
                      <div className="task-card-detail"><Package size={16} /> {don.quantity} · {don.quality}</div>
                      <div className="task-card-detail"><Truck size={16} /> Agent: <strong>{don.agent_name}</strong></div>
                      <div className="task-card-detail"><MapPin size={16} /> From: {don.pickup_location}</div>

                      {don.ai_score && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(45,106,79,0.04)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--success)' }}>
                          ✅ AI Quality Score: {don.ai_score}%
                        </div>
                      )}

                      {/* Agent drop photos */}
                      {don.drop_photos?.length > 0 && (
                        <div style={{ marginTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>📷 Agent Drop Photos:</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                            {don.drop_photos.map((p, i) => (
                              <div key={i} onClick={() => setLightboxImg(p)} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--surface-border)' }}>
                                <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <button className="btn btn-primary btn-block" style={{ marginTop: '1rem' }}
                        onClick={() => openReceiptModal(don)}>
                        <CheckCircle size={16} /> Verify & Confirm Receipt
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* In Transit — live tracking */}
            {incoming.length > 0 && (
              <>
                <div className="panel-header">
                  <div>
                    <h1 style={{ fontSize: '1.5rem' }}>🚚 En Route — Live Tracking</h1>
                    <p>Track your deliveries in real time.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {incoming.map(don => {
                    const agentLoc = don.agent_id ? agentLocations[don.agent_id] : null;
                    const pickupCoords = don.pickup_coords;
                    return (
                      <div key={don.id} className="task-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                        <div className="task-card-header">
                          <span className="badge badge-info">
                            {don.status === 'picked' ? '🚚 In Transit' : '📦 Pickup Pending'}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{don.id}</span>
                        </div>
                        <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{don.food_name}</h3>
                        <div className="task-card-detail"><Package size={16} /> {don.quantity}</div>
                        <div className="task-card-detail"><Truck size={16} /> Agent: <strong>{don.agent_name}</strong></div>
                        <div className="task-card-detail"><MapPin size={16} /> From: {don.pickup_location}</div>
                        {don.delivery_distance && (
                          <div className="task-card-detail"><Navigation size={16} /> {don.delivery_distance} km · ₹{don.delivery_fee} agent fee</div>
                        )}

                        {/* Swiggy-style live map */}
                        <div style={{ marginTop: '1rem' }}>
                          <LiveMap
                            pickupCoords={pickupCoords}
                            dropCoords={centerCoords}
                            agentCoords={agentLoc ? { lat: agentLoc.lat, lng: agentLoc.lng } : undefined}
                            showRoute
                            height="280px"
                            label={`Agent: ${don.agent_name}`}
                          />
                        </div>

                        {agentLoc && (
                          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(37,99,235,0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
                            Agent location updating live
                          </div>
                        )}
                        {!agentLoc && (
                          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.06)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={14} /> Live location not yet available
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {incoming.length === 0 && arrived.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Home size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No incoming deliveries</h3>
                <p>Deliveries assigned to your center will appear here with live tracking.</p>
              </div>
            )}
          </div>
        )}

        {/* ── History Tab ───────────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div>
            {received.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <History size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No confirmed receipts yet</h3>
                <p>Confirmed deliveries will appear here.</p>
              </div>
            ) : (
              <div className="cards-grid">
                {received.map(don => (
                  <div key={don.id} className="task-card" style={{ borderLeft: '4px solid var(--success)', opacity: 0.9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <span className="badge badge-success">✅ Received</span>
                        <h4 style={{ marginTop: '0.5rem' }}>{don.food_name}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {don.drop_qty_confirmed || don.quantity} from {don.donor_name}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          Agent: {don.agent_name} · {don.received_at ? new Date(don.received_at).toLocaleDateString('en-IN') : ''}
                        </p>
                        {don.has_discrepancy && (
                          <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(230,57,70,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <AlertTriangle size={13} /> {don.discrepancy_note || 'Discrepancy reported'}
                          </div>
                        )}
                        {/* View drop photos */}
                        {don.drop_photos?.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                            {don.drop_photos.slice(0, 3).map((p, i) => (
                              <div key={i} onClick={() => setLightboxImg(p)} style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--surface-border)' }}>
                                <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <CheckCircle size={32} color="var(--success)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default CenterDashboard;
