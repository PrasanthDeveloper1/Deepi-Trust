import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, CheckCircle, Package, Users, AlertTriangle,
  Truck, X, Eye, BarChart3, DollarSign, UserCheck, Building, XCircle,
  QrCode, Upload, MapPin, Zap, Radio, IndianRupee, Navigation, CreditCard, Camera, Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import { analyzeFoodQuality, isAIConfigured } from '../config/ai';

/* AI analysis is powered by Google Gemini Vision — see src/config/ai.js */

const AdminDashboard = () => {
  const { user } = useAuth();
  const {
    donations, payments, analytics, agentLocations, agentFees,
    approveDonation, rejectDonation, broadcastDelivery, approvePayment,
    getAdminQR, setAdminQR, getCenters, getAgents, refreshData, updateAgentFee
  } = useAppContext();

  const [scanningId, setScanningId]       = useState(null);
  const [lightboxImg, setLightboxImg]     = useState(null);
  const [activeTab, setActiveTab]         = useState('donations');
  const [paySubTab, setPaySubTab]         = useState('transactions');
  const [dispatchModal, setDispatchModal] = useState(null);
  const [selectedCenter, setSelectedCenter] = useState('');
  const [dispatchResult, setDispatchResult] = useState(null);
  const [adminQR, setAdminQRState]        = useState(null);
  const [payModal, setPayModal]           = useState(null);
  const [photosReviewed, setPhotosReviewed] = useState(false); // gate before paying
  const [centers, setCenters]             = useState([]);
  const [agents, setAgents]               = useState([]);
  const [proofModal, setProofModal]       = useState(null); // { id, proof, donor_name, amount, status }
  const [scanStage, setScanStage]         = useState('');
  const [notFoodAlert, setNotFoodAlert]   = useState(null);
  const [aiError, setAiError]             = useState(null);
  const qrInputRef = useRef();

  // Load centers + agents (async-compatible)
  useEffect(() => {
    Promise.resolve(getCenters()).then(setCenters);
    Promise.resolve(getAgents()).then(setAgents);
  }, [getCenters, getAgents, donations]);

  const getAgentUser = (agentId) => agents.find(a => a.id === agentId);

  // Load admin QR
  useEffect(() => {
    Promise.resolve(getAdminQR()).then(setAdminQRState);
  }, [getAdminQR, payments]);

  // Reset photo-reviewed checkbox when payModal changes
  useEffect(() => {
    setPhotosReviewed(false);
  }, [payModal]);

  // ── Admin marks fee as paid (after reviewing photos) ──────────────────────
  const handleMarkPaid = async (fee) => {
    await updateAgentFee(fee.id, {
      status: 'paid',
      paid_at: new Date().toISOString()
    });
    setPayModal(null);
    setPhotosReviewed(false);
  };

  // ── AI Scan (Client-side Food Vision Engine) ───────────────────────────────
  const initiateAICheck = async (id) => {
    // Pre-flight checks
    if (!isAIConfigured()) {
      setAiError('AI Food Analysis Engine is not available. Please reload the page and try again.');
      return;
    }

    const donation = donations.find(d => d.id === id);
    if (!donation?.photos?.length) {
      setAiError('This donation has no photos uploaded. AI quality analysis requires at least one food photo.');
      return;
    }

    setScanningId(id);
    setScanStage('Initializing AI engine…');

    try {
      const result = await analyzeFoodQuality(donation.photos, setScanStage);

      // ── Non-food detected ─────────────────────────────────────────────
      if (!result.is_food) {
        setScanningId(null);
        setScanStage('');
        setNotFoodAlert({
          donationId: id,
          donorName: donation.donor_name,
          foodName: donation.food_name,
          detectedContent: result.detected_content || 'Non-food content',
          summary: result.summary || 'The uploaded image does not contain food items.',
        });
        return;
      }

      // ── Food detected — process scores ──────────────────────────────
      setScanStage('Finalizing quality scores…');

      const overallScore = result.overall_score ?? 0;
      const aiDetails = {
        categories: result.categories || [],
        food_type: result.food_type || 'Unknown food',
        summary: result.summary || '',
        safe_for_distribution: result.safe_for_distribution ?? false,
      };

      if (overallScore < 60 || !result.safe_for_distribution) {
        const reason = result.rejection_reason || `AI quality score too low (${overallScore}%) — food not safe for distribution`;
        rejectDonation(id, reason);
      } else {
        approveDonation(id, overallScore, aiDetails);
      }
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiError(`AI analysis failed: ${err.message}`);
    } finally {
      setScanningId(null);
      setScanStage('');
    }
  };

  // ── Dispatch to All Agents ─────────────────────────────────────────────────
  const handleDispatch = async () => {
    if (!selectedCenter || !dispatchModal) return;
    const center = centers.find(c => c.id === selectedCenter);
    if (!center) return;
    const result = await broadcastDelivery(dispatchModal, center.id, center.name);
    setDispatchResult(result);
    setTimeout(() => {
      setDispatchModal(null);
      setSelectedCenter('');
      setDispatchResult(null);
    }, 2500);
  };

  // ── QR Upload ─────────────────────────────────────────────────────────────
  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAdminQR(ev.target.result);
      setAdminQRState(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  // ── Donation status groups ─────────────────────────────────────────────────
  const pending    = donations.filter(d => d.status === 'pending');
  const approved   = donations.filter(d => d.status === 'approved');
  const dispatched = donations.filter(d => d.status === 'dispatched');
  const inDelivery = donations.filter(d => ['assigned', 'picked', 'delivered', 'received'].includes(d.status));

  // ── Active agents with live location ──────────────────────────────────────
  const activeAgentsLive = Object.entries(agentLocations).map(([agentId, loc]) => {
    const don = donations.find(d => d.agent_id === agentId && ['assigned', 'picked'].includes(d.status));
    return { id: agentId, lat: loc.lat, lng: loc.lng, name: don?.agent_name || agentId, task: don?.food_name };
  });

  // Pending fees (agent delivered but admin hasn't paid yet)
  const pendingFees = agentFees.filter(f => f.status === 'pending');

  return (
    <div className="page-content">
      {/* ── Payment Proof Modal ───────────────────────────────────────────── */}
      {proofModal && (
        <div className="modal-overlay" onClick={() => setProofModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(37,99,235,0.1)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                <ImageIcon size={22} color="#2563eb" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0 }}>Payment Proof</h3>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                  {proofModal.donor_name} · ₹{proofModal.amount} · <span style={{ fontFamily: 'monospace' }}>{proofModal.id}</span>
                </p>
              </div>
              <button onClick={() => setProofModal(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={22} />
              </button>
            </div>

            {/* Proof image */}
            {proofModal.proof ? (
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1.5px solid var(--surface-border)', marginBottom: '1.25rem', cursor: 'zoom-in' }}
                onClick={() => { setLightboxImg(proofModal.proof); setProofModal(null); }}>
                <img src={proofModal.proof} alt="Payment screenshot"
                  style={{ width: '100%', maxHeight: '380px', objectFit: 'contain', display: 'block', background: '#f8f8f8' }} />
                <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(37,99,235,0.04)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Eye size={12} /> Click image to zoom fullscreen
                </div>
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '2px dashed var(--surface-border)', borderRadius: '12px', marginBottom: '1.25rem' }}>
                <ImageIcon size={40} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p>No proof screenshot submitted</p>
              </div>
            )}

            {/* Status + actions */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className={`badge ${proofModal.status === 'review' ? 'badge-pending' : 'badge-success'}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                {proofModal.status === 'review' ? '⏳ Under Review' : '✅ Completed'}
              </span>
              <div style={{ flex: 1 }} />
              {proofModal.status === 'review' && (
                <button className="btn btn-primary"
                  onClick={() => { approvePayment(proofModal.id); setProofModal(null); }}>
                  <CheckCircle size={16} /> Approve Payment
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setProofModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxImg && (
        <div onClick={() => setLightboxImg(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <button onClick={() => setLightboxImg(null)}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={22} />
          </button>
          <img src={lightboxImg} alt="Inspection" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
        </div>
      )}

      {/* ── Not Food Alert Modal ─────────────────────────────────────────── */}
      {notFoodAlert && (
        <div className="modal-overlay" onClick={() => setNotFoodAlert(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '0.75rem', lineHeight: 1 }}>🚫</div>
            <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '1.4rem' }}>No Food Detected</h2>
            <p style={{ color: 'var(--text-body)', marginBottom: '1.25rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
              The AI analyzed the uploaded image and determined it <strong>does not contain food</strong>.
            </p>
            <div style={{ padding: '1rem', background: 'rgba(230,57,70,0.06)', borderRadius: 'var(--radius-md)', border: '1.5px solid rgba(230,57,70,0.15)', marginBottom: '1.25rem', textAlign: 'left' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>AI Detection Result</div>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1.05rem' }}>
                {notFoodAlert.detectedContent}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-body)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                {notFoodAlert.summary}
              </div>
            </div>
            <div style={{ padding: '0.65rem 1rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: '#92400e', marginBottom: '1.5rem', textAlign: 'left' }}>
              <strong>Donation:</strong> {notFoodAlert.foodName} by {notFoodAlert.donorName}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setNotFoodAlert(null)}>Dismiss</button>
              <button className="btn btn-danger" style={{ flex: 2 }} onClick={() => {
                rejectDonation(notFoodAlert.donationId, `AI rejected: No food detected — ${notFoodAlert.detectedContent}`);
                setNotFoodAlert(null);
              }}>
                <XCircle size={16} /> Reject Donation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Error Modal ────────────────────────────────────────────────── */}
      {aiError && (
        <div className="modal-overlay" onClick={() => setAiError(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem', lineHeight: 1 }}>⚠️</div>
            <h3 style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>AI Analysis Error</h3>
            <p style={{ color: 'var(--text-body)', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '0.95rem', whiteSpace: 'pre-line' }}>
              {aiError}
            </p>
            <button className="btn btn-primary" onClick={() => setAiError(null)}>OK</button>
          </div>
        </div>
      )}

      {/* ── Agent Payment Modal ───────────────────────────────────────────── */}
      {payModal && (() => {
        const agentUser = getAgentUser(payModal.agent_id);
        const don = donations.find(d => d.id === payModal.donation_id);
        const allPhotos = [...(don?.pickup_photos || []), ...(don?.drop_photos || [])];
        return (
          <div className="modal-overlay" onClick={() => setPayModal(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(37,99,235,0.12)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                  <CreditCard size={22} color="#2563eb" />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>Pay Agent</h3>
                  <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                    ₹{payModal.fee} → {payModal.agent_name}
                    {payModal.status === 'paid' && <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>✅ Paid</span>}
                    {payModal.status === 'pending' && <span className="badge badge-pending" style={{ marginLeft: '0.5rem' }}>⏳ Pending</span>}
                  </p>
                </div>
                <button onClick={() => setPayModal(null)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={22} />
                </button>
              </div>

              {/* ── STEP 1: Photo Review ─────────────────────────────────── */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-section)', borderRadius: '12px', border: '1.5px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-body)' }}>
                  <Camera size={16} /> Step 1 — Review Delivery Evidence
                </div>
                {allPhotos.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.75rem', textAlign: 'center' }}>
                    ⚠️ No photos uploaded by agent
                  </div>
                ) : (
                  <>
                    {don?.pickup_photos?.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          📦 Pickup Photos ({don.pickup_photos.length})
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {don.pickup_photos.map((p, i) => (
                            <div key={i} onClick={() => setLightboxImg(p)}
                              style={{ width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--surface-border)' }}>
                              <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {don?.drop_photos?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          📍 Drop-off Photos ({don.drop_photos.length})
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {don.drop_photos.map((p, i) => (
                            <div key={i} onClick={() => setLightboxImg(p)}
                              style={{ width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--surface-border)' }}>
                              <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Confirmation checkbox */}
                {payModal.status !== 'paid' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: photosReviewed ? 'var(--success)' : 'var(--text-body)' }}>
                    <input type="checkbox" checked={photosReviewed} onChange={e => setPhotosReviewed(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--success)' }} />
                    I have reviewed all delivery photos
                  </label>
                )}
              </div>

              {/* ── STEP 2: Agent Payment Details ──────────────────────────── */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IndianRupee size={16} /> Step 2 — Transfer Payment
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: agentUser?.payment_qr ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: 'rgba(37,99,235,0.05)', borderRadius: '12px', border: '1.5px solid rgba(37,99,235,0.15)' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>UPI ID</div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#2563eb', wordBreak: 'break-all' }}>
                      {agentUser?.upi_id || '—'}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      📦 {payModal.food_name}<br />
                      📍 {payModal.distance_km} km · <strong style={{ color: 'var(--primary)' }}>₹{payModal.fee}</strong>
                    </div>
                    {payModal.status === 'paid' && payModal.paid_at && (
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>
                        ✅ Paid on {new Date(payModal.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>
                  {agentUser?.payment_qr && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Agent QR</div>
                      <img src={agentUser.payment_qr} alt="Agent QR"
                        style={{ width: '130px', height: '130px', objectFit: 'contain', borderRadius: '10px', border: '2px solid rgba(37,99,235,0.2)' }} />
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scan to pay ₹{payModal.fee}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Action Buttons ──────────────────────────────────────────── */}
              {payModal.status !== 'paid' && (
                <>
                  {!photosReviewed && (
                    <div style={{ padding: '0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: '10px', fontSize: '0.83rem', color: '#92400e', marginBottom: '1rem' }}>
                      ⚠️ Please review all delivery photos above before marking as paid.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-outline" onClick={() => setPayModal(null)}>Cancel</button>
                    <button className="btn btn-primary btn-block"
                      style={{ background: photosReviewed ? 'linear-gradient(135deg,#10b981,#059669)' : undefined, borderColor: photosReviewed ? '#059669' : undefined, opacity: photosReviewed ? 1 : 0.5 }}
                      disabled={!photosReviewed}
                      onClick={() => handleMarkPaid(payModal)}>
                      <CheckCircle size={16} /> Mark ₹{payModal.fee} as Paid
                    </button>
                  </div>
                </>
              )}
              {payModal.status === 'paid' && (
                <button className="btn btn-outline btn-block" onClick={() => setPayModal(null)}>Close</button>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Dispatch Modal ────────────────────────────────────────────────── */}
      {dispatchModal && (
        <div className="modal-overlay" onClick={() => { setDispatchModal(null); setSelectedCenter(''); setDispatchResult(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            {!dispatchResult ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'rgba(245,158,11,0.12)', borderRadius: '10px', padding: '8px', display: 'flex' }}>
                    <Radio size={22} color="#f59e0b" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>Dispatch to All Agents</h3>
                    <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
                      First agent to accept will be assigned. Fee auto-calculated.
                    </p>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Select Beneficiary Center</label>
                  <select className="form-control" value={selectedCenter} onChange={e => setSelectedCenter(e.target.value)}>
                    <option value="">Choose a center...</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.address || 'No address'})</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-outline" onClick={() => { setDispatchModal(null); setSelectedCenter(''); }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleDispatch} disabled={!selectedCenter}
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', borderColor: '#d97706' }}>
                    <Zap size={16} /> Broadcast to All Agents
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📡</div>
                <h3 style={{ color: 'var(--success)' }}>Dispatched!</h3>
                <p style={{ color: 'var(--text-muted)' }}>
                  All registered agents have been notified.<br />
                  <span style={{ fontSize: '0.85rem' }}>Fee & distance will be calculated when an agent accepts using real GPS.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Banner ────────────────────────────────────────────────────────── */}
      <div className="dash-banner admin-banner">
        <div className="dash-banner-content">
          <h1>Admin Control Panel 🛡️</h1>
          <p>Manage donations, run AI quality checks, dispatch deliveries, and monitor platform analytics.</p>
        </div>
      </div>

      <section className="section">
        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="panel-stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><Package size={22} /></div>
            <div><div className="panel-stat-value">{analytics?.totalDonations || 0}</div><div className="panel-stat-label">Total Donations</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon blue"><CheckCircle size={22} /></div>
            <div><div className="panel-stat-value">{analytics?.delivered || 0}</div><div className="panel-stat-label">Delivered</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon yellow"><IndianRupee size={22} /></div>
            <div><div className="panel-stat-value">₹{(analytics?.totalAgentFees || 0).toLocaleString()}</div><div className="panel-stat-label">Agent Payouts</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><UserCheck size={22} /></div>
            <div><div className="panel-stat-value">{analytics?.activeAgents || 0}</div><div className="panel-stat-label">Active Agents</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon red"><Building size={22} /></div>
            <div><div className="panel-stat-value">{analytics?.totalCenters || 0}</div><div className="panel-stat-label">Centers</div></div>
          </div>
        </div>

        {/* ── Pending Fees Alert ────────────────────────────────────────────── */}
        {pendingFees.length > 0 && (
          <div style={{ padding: '0.875rem 1.25rem', background: 'rgba(245,158,11,0.1)', borderRadius: 'var(--radius-md)', border: '1.5px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <IndianRupee size={18} color="#f59e0b" />
            <span style={{ fontWeight: 700, color: '#d97706' }}>{pendingFees.length} Agent fee{pendingFees.length > 1 ? 's' : ''} pending payment</span>
            <button className="btn btn-sm" style={{ marginLeft: 'auto', background: '#f59e0b', color: '#fff', border: 'none' }}
              onClick={() => { setActiveTab('payments'); setPaySubTab('agentfees'); }}>
              Review & Pay →
            </button>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === 'donations' ? 'active' : ''}`} onClick={() => setActiveTab('donations')}>
            <Package size={16} /> Donations ({donations.length})
          </button>
          <button className={`dash-tab ${activeTab === 'tracking' ? 'active' : ''}`} onClick={() => setActiveTab('tracking')}>
            <Navigation size={16} /> Live Tracking ({activeAgentsLive.length})
          </button>
          <button className={`dash-tab ${activeTab === 'payments' ? 'active' : ''}`} onClick={() => setActiveTab('payments')}>
            <DollarSign size={16} /> Payments & Fees
            {pendingFees.length > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '0.75rem', marginLeft: '4px' }}>{pendingFees.length}</span>}
          </button>
          <button className={`dash-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
            <BarChart3 size={16} /> Analytics
          </button>
        </div>

        {/* ══════════════════ DONATIONS TAB ══════════════════════ */}
        {activeTab === 'donations' && (
          <>
            {/* Pending */}
            {pending.length > 0 && (
              <>
                <div className="panel-header"><div><h1 style={{ fontSize: '1.5rem' }}>⏳ Pending AI Scan ({pending.length})</h1></div></div>
                <div className="cards-grid" style={{ marginBottom: '3rem' }}>
                  {pending.map(order => (
                    <div key={order.id} className="task-card" style={{ position: 'relative', overflow: 'hidden' }}>
                      {scanningId === order.id && (
                        <div className="scan-overlay">
                          <div className="scan-spinner" />
                          <p style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>AI Analysis in Progress</p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{scanStage || 'Initializing AI engine…'}</p>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            {['🔍','🥬','📦','🧼','🌡️','⚠️'].map((icon, i) => (
                              <span key={i} style={{ fontSize: '1.1rem', opacity: 0.4, animation: `pulse 1.5s ease-in-out infinite ${i * 0.2}s` }}>{icon}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="task-card-header">
                        <span className="badge badge-pending">{order.id}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⏳ Awaiting Scan</span>
                      </div>
                      <h3 style={{ marginBottom: '0.25rem' }}>{order.donor_name}</h3>
                      <div className="task-card-detail"><Package size={16} /> {order.food_name}</div>
                      <div className="task-card-detail"><Users size={16} /> {order.quantity} · {order.quality}</div>
                      {order.pickup_location && <div className="task-card-detail"><Eye size={16} /> {order.pickup_location}</div>}
                      {order.photos?.length > 0 && (
                        <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
                          {order.photos.map((p, i) => (
                            <div key={i} onClick={() => setLightboxImg(p)} style={{ cursor: 'pointer', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--surface-border)', aspectRatio: '1' }}>
                              <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {(!order.photos || order.photos.length === 0) && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={14} /> No photos uploaded
                        </div>
                      )}
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-accent btn-block btn-sm"
                          onClick={() => initiateAICheck(order.id)}
                          disabled={!!scanningId || !order.photos?.length}
                          style={{ opacity: (!order.photos?.length || !!scanningId) ? 0.55 : 1 }}>
                          <Cpu size={16} /> {!order.photos?.length ? 'No Photos to Scan' : scanningId ? 'Scanning…' : 'Run AI Scan'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => rejectDonation(order.id, 'Manually rejected by admin')}>
                          <XCircle size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Approved */}
            {approved.length > 0 && (
              <>
                <div className="panel-header"><div><h1 style={{ fontSize: '1.5rem' }}>✅ AI Approved — Ready to Dispatch ({approved.length})</h1></div></div>
                <div className="cards-grid" style={{ marginBottom: '3rem' }}>
                  {approved.map(order => (
                    <div key={order.id} className="task-card">
                      <div className="task-card-header">
                        <span className="badge badge-info">{order.id}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>✅ Score: {order.ai_score}%</span>
                      </div>
                      <h3 style={{ marginBottom: '0.25rem' }}>{order.donor_name}</h3>
                      <div className="task-card-detail"><Package size={16} /> {order.food_name} · {order.quantity}</div>
                      <div className="task-card-detail"><MapPin size={16} /> {order.pickup_location}</div>
                      {order.ai_details && (() => {
                        const categories = Array.isArray(order.ai_details) ? order.ai_details : order.ai_details?.categories || [];
                        const foodType = order.ai_details?.food_type;
                        const aiSummary = order.ai_details?.summary;
                        const sc = (s) => s === 'pass' ? 'var(--success)' : s === 'fail' ? 'var(--danger)' : 'var(--warning)';
                        return (
                          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(45,106,79,0.04)', borderRadius: 'var(--radius-md)' }}>
                            {foodType && (
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                🍲 {foodType}
                              </div>
                            )}
                            {categories.map((d, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', fontSize: '0.82rem' }} title={d.note || ''}>
                                <span style={{ width: '20px', textAlign: 'center' }}>{d.icon}</span>
                                <span style={{ flex: 1, color: 'var(--text-body)' }}>{d.label}</span>
                                <div style={{ width: '50px', height: '4px', background: 'rgba(0,0,0,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
                                  <div style={{ width: `${d.score}%`, height: '100%', background: sc(d.status), borderRadius: '10px', transition: 'width 0.6s ease' }} />
                                </div>
                                <span style={{ fontWeight: 600, fontSize: '0.8rem', width: '30px', textAlign: 'right', color: sc(d.status) }}>{d.score}%</span>
                              </div>
                            ))}
                            {aiSummary && (
                              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', fontStyle: 'italic' }}>
                                {aiSummary}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <button className="btn btn-block btn-sm"
                        style={{ marginTop: '1rem', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)' }}
                        onClick={() => setDispatchModal(order.id)}>
                        <Radio size={16} /> Dispatch to All Agents
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Dispatched — Waiting for Agent */}
            {dispatched.length > 0 && (
              <>
                <div className="panel-header"><div><h1 style={{ fontSize: '1.5rem' }}>📡 Waiting for Agent ({dispatched.length})</h1></div></div>
                <div className="cards-grid" style={{ marginBottom: '3rem' }}>
                  {dispatched.map(order => (
                    <div key={order.id} className="task-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                      <div className="task-card-header">
                        <span className="badge badge-pending">📡 Broadcast Active</span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.id}</span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{order.food_name}</h3>
                      <div className="task-card-detail"><MapPin size={16} /> Pickup: {order.pickup_location}</div>
                      <div className="task-card-detail"><Building size={16} /> → {order.center_name}</div>
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>⏳ Awaiting agent acceptance</span>
                        <span style={{ color: 'var(--text-muted)' }}>· Fee calculated on acceptance via real GPS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* In Delivery */}
            {inDelivery.length > 0 && (
              <>
                <div className="panel-header"><div><h1 style={{ fontSize: '1.5rem' }}>🚚 In Delivery ({inDelivery.length})</h1></div></div>
                <div className="cards-grid">
                  {inDelivery.map(order => (
                    <div key={order.id} className="task-card" style={{ borderLeft: `4px solid ${order.status === 'received' ? 'var(--success)' : 'var(--primary)'}` }}>
                      <div className="task-card-header">
                        <span className={`badge ${order.status === 'received' ? 'badge-success' : 'badge-info'}`}>
                          {order.status === 'assigned' ? '📦 Assigned' : order.status === 'picked' ? '🚚 In Transit' : order.status === 'delivered' ? '📍 Arrived' : '✅ Received'}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{order.id}</span>
                      </div>
                      <h3 style={{ marginBottom: '0.25rem' }}>{order.food_name}</h3>
                      <div className="task-card-detail"><Truck size={16} /> Agent: <strong>{order.agent_name}</strong></div>
                      <div className="task-card-detail"><Building size={16} /> Center: <strong>{order.center_name}</strong></div>
                      {order.delivery_fee && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          💸 Agent payout: <strong style={{ color: 'var(--primary)' }}>₹{order.delivery_fee}</strong> · {order.delivery_distance} km
                        </div>
                      )}
                      {/* Quick view photos link */}
                      {(order.pickup_photos?.length > 0 || order.drop_photos?.length > 0) && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {[...(order.pickup_photos || []), ...(order.drop_photos || [])].slice(0, 4).map((p, i) => (
                            <div key={i} onClick={() => setLightboxImg(p)} style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--surface-border)' }}>
                              <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {donations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Package size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No donations yet</h3>
                <p>Waiting for donors to submit food donations.</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ LIVE TRACKING TAB ══════════════════════ */}
        {activeTab === 'tracking' && (
          <>
            <div className="panel-header">
              <div><h1>🛵 Live Agent Tracking</h1><p>Real-time GPS position of all active delivery agents.</p></div>
            </div>
            {activeAgentsLive.length > 0 ? (
              <>
                <LiveMap allAgents={activeAgentsLive} showRoute={false} height="450px" label="All Active Agents" />
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeAgentsLive.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'var(--bg-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
                      <div style={{ fontSize: '2rem' }}>🛵</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{a.task || 'Available'}</div>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>● Live</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Navigation size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No active agents currently</h3>
                <p>Agent live locations will appear here once they accept and start a delivery.</p>
              </div>
            )}
          </>
        )}

        {/* ══════════════════ PAYMENTS & FEES TAB ══════════════════════ */}
        {activeTab === 'payments' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--surface-border)', paddingBottom: '0' }}>
              {[
                { id: 'transactions', label: '💳 Crowdfunding Transactions' },
                { id: 'agentfees',    label: `🛵 Agent Fees ${pendingFees.length > 0 ? `(${pendingFees.length} pending)` : ''}` },
                { id: 'qr',          label: '📲 QR Code Settings' },
              ].map(t => (
                <button key={t.id} onClick={() => setPaySubTab(t.id)}
                  style={{ padding: '0.6rem 1.1rem', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', background: 'transparent',
                    borderBottom: paySubTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                    color: paySubTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                    marginBottom: '-2px', transition: 'all 0.2s' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Crowdfunding Transactions */}
            {paySubTab === 'transactions' && (
              <>
                <div className="panel-header"><div><h1>Crowdfunding Transactions</h1><p>Review and approve incoming payment transactions.</p></div></div>
                <table className="data-table">
                  <thead><tr><th>TXN ID</th><th>Donor</th><th>Email</th><th>Amount</th><th>Proof</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {payments.map(fund => (
                      <tr key={fund.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fund.id}</td>
                        <td style={{ fontWeight: 600 }}>{fund.donor_name}</td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fund.email || '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{fund.amount}</td>
                        <td>
                          {fund.proof ? (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                              onClick={() => setProofModal(fund)}>
                              <ImageIcon size={13} /> View Proof
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No screenshot</span>
                          )}
                        </td>
                        <td><span className={`badge ${fund.status === 'review' ? 'badge-pending' : 'badge-success'}`}>{fund.status === 'review' ? '⏳ Under Review' : '✅ Completed'}</span></td>
                        <td style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {fund.status === 'review' ? (
                            <>
                              {fund.proof && (
                                <button className="btn btn-sm" style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)', whiteSpace: 'nowrap' }} onClick={() => setProofModal(fund)}>
                                  <Eye size={13} />
                                </button>
                              )}
                              <button className="btn btn-primary btn-sm" onClick={() => approvePayment(fund.id)}>Approve</button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}><CheckCircle size={16} /> Verified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No transactions found.</td></tr>}
                  </tbody>
                </table>
              </>
            )}

            {/* Agent Delivery Fees */}
            {paySubTab === 'agentfees' && (
              <>
                <div className="panel-header"><div><h1>Agent Delivery Fees</h1><p>Review delivery photos then pay agents via their registered UPI.</p></div></div>
                <table className="data-table">
                  <thead><tr><th>Fee ID</th><th>Agent</th><th>UPI ID</th><th>Food Item</th><th>Distance</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                  <tbody>
                    {agentFees.map(fee => {
                      const agentUser = getAgentUser(fee.agent_id);
                      return (
                        <tr key={fee.id}>
                          <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fee.id}</td>
                          <td style={{ fontWeight: 600 }}>{fee.agent_name}</td>
                          <td style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.85rem' }}>{agentUser?.upi_id || '—'}</td>
                          <td>{fee.food_name}</td>
                          <td>{fee.distance_km} km</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{fee.fee}</td>
                          <td><span className={`badge ${fee.status === 'paid' ? 'badge-success' : 'badge-pending'}`}>{fee.status === 'paid' ? '✅ Paid' : '⏳ Pending'}</span></td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {fee.paid_at ? new Date(fee.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                          <td>
                            <button className="btn btn-primary btn-sm" onClick={() => setPayModal(fee)}
                              style={{ background: fee.status === 'paid' ? 'transparent' : 'linear-gradient(135deg,#2563eb,#1d4ed8)', color: fee.status === 'paid' ? 'var(--primary)' : '#fff', border: fee.status === 'paid' ? '1px solid var(--primary)' : 'none', whiteSpace: 'nowrap' }}>
                              <CreditCard size={14} /> {fee.status === 'paid' ? 'View Receipt' : 'Review & Pay'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {agentFees.length === 0 && <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No fee records yet.</td></tr>}
                  </tbody>
                </table>
                {agentFees.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '1rem 1.25rem', background: 'rgba(45,106,79,0.06)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <IndianRupee size={20} color="var(--primary)" />
                    <span style={{ fontWeight: 700 }}>
                      Total Paid: ₹{agentFees.filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.fee), 0).toLocaleString()}
                      &nbsp;·&nbsp;
                      Pending: ₹{agentFees.filter(f => f.status === 'pending').reduce((s, f) => s + Number(f.fee), 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* QR Code Settings */}
            {paySubTab === 'qr' && (
              <>
                <div className="panel-header"><div><h1>📲 Payment QR Code</h1><p>Upload the platform's payment QR code shown to crowdfunding donors.</p></div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                  <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
                    <h4 style={{ marginBottom: '1.25rem' }}>Current QR Code</h4>
                    {adminQR ? (
                      <img src={adminQR} alt="Payment QR" style={{ maxWidth: '220px', maxHeight: '220px', borderRadius: '12px', border: '2px solid var(--surface-border)' }} />
                    ) : (
                      <div style={{ width: '220px', height: '220px', margin: '0 auto', background: 'var(--bg-section)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-muted)', border: '2px dashed var(--surface-border)' }}>
                        <QrCode size={48} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: '0.85rem' }}>No QR uploaded</span>
                      </div>
                    )}
                  </div>
                  <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--surface-border)' }}>
                    <h4 style={{ marginBottom: '1rem' }}>Upload New QR</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      Upload your UPI/bank QR image. It will be shown to donors in the Crowdfunding section.
                    </p>
                    <input ref={qrInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQRUpload} />
                    <button className="btn btn-primary btn-block" onClick={() => qrInputRef.current?.click()}>
                      <Upload size={16} /> Choose QR Image from Computer
                    </button>
                    {adminQR && (
                      <button className="btn btn-outline btn-block" style={{ marginTop: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => { setAdminQR(null); setAdminQRState(null); }}>
                        Remove QR
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════ ANALYTICS TAB ══════════════════════ */}
        {activeTab === 'analytics' && analytics && (
          <div>
            <div className="panel-header"><div><h1>Platform Analytics</h1><p>Overview of platform performance and metrics.</p></div></div>
            <div className="analytics-grid">
              {[
                { icon: <Package size={28} />, value: analytics.totalDonations, label: 'Total Donations', color: 'rgba(45,106,79,0.1)', text: 'var(--primary)', bar: '100%', barColor: 'var(--primary)' },
                { icon: <Truck size={28} />, value: analytics.delivered, label: 'Deliveries Completed', color: 'rgba(37,99,235,0.1)', text: '#2563eb', bar: `${analytics.totalDonations ? (analytics.delivered / analytics.totalDonations) * 100 : 0}%`, barColor: '#2563eb' },
                { icon: <IndianRupee size={28} />, value: `₹${analytics.totalAgentFees.toLocaleString()}`, label: 'Agent Payouts', color: 'rgba(245,158,11,0.1)', text: '#f59e0b', bar: '75%', barColor: '#f59e0b' },
                { icon: <UserCheck size={28} />, value: analytics.activeAgents, label: 'Active Agents', color: 'rgba(16,185,129,0.1)', text: '#10b981', bar: '60%', barColor: '#10b981' },
                { icon: <Users size={28} />, value: analytics.totalDonors, label: 'Registered Donors', color: 'rgba(139,92,246,0.1)', text: '#8b5cf6', bar: '50%', barColor: '#8b5cf6' },
                { icon: <Building size={28} />, value: analytics.totalCenters, label: 'Partner Centers', color: 'rgba(230,57,70,0.1)', text: 'var(--danger)', bar: '40%', barColor: 'var(--danger)' },
              ].map((card, i) => (
                <div key={i} className="analytics-card">
                  <div className="analytics-card-icon" style={{ background: card.color, color: card.text }}>{card.icon}</div>
                  <div className="analytics-card-value">{card.value}</div>
                  <div className="analytics-card-label">{card.label}</div>
                  <div className="analytics-card-bar"><div style={{ width: card.bar, background: card.barColor }} /></div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '3rem', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--surface-border)' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Donation Pipeline</h3>
              <div className="pipeline-flow">
                <div className="pipeline-step"><div className="pipeline-count">{analytics.pending}</div><div className="pipeline-label">Pending</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="pipeline-count">{analytics.approved}</div><div className="pipeline-label">Approved</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step"><div className="pipeline-count">{analytics.assigned}</div><div className="pipeline-label">In Delivery</div></div>
                <div className="pipeline-arrow">→</div>
                <div className="pipeline-step done"><div className="pipeline-count">{analytics.delivered}</div><div className="pipeline-label">Delivered</div></div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminDashboard;
