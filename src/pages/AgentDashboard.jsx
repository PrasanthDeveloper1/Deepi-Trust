import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Truck, MapPin, Package, Navigation, CheckCircle,
  History, Zap, IndianRupee, Camera, X, Award
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAppContext } from "../context/AppContext";
import LiveMap from "../components/LiveMap";

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

const AgentDashboard = () => {
  const { user } = useAuth();
  const {
    donations, deliveryRequests, agentLocations, agentFees,
    acceptDelivery, pickupDonation, deliverDonation,
    updateAgentLocation
  } = useAppContext();

  const [activeTab, setActiveTab]       = useState("jobs");
  const [acceptingId, setAcceptingId]   = useState(null);
  const [acceptedMsg, setAcceptedMsg]   = useState("");
  const [pickupModal, setPickupModal]   = useState(null);
  const [pickupQty, setPickupQty]       = useState("");
  const [pickupPhotos, setPickupPhotos] = useState([]);
  const pickupInputRef = useRef();
  const [dropModal, setDropModal]       = useState(null);
  const [dropPhotos, setDropPhotos]     = useState([]);
  const dropInputRef = useRef();
  const [lightboxImg, setLightboxImg]   = useState(null);

  // Role-isolated data: only tasks/fees for this agent
  const myTasks        = donations.filter(d => d.agent_id === user?.id);
  const activeTasks    = myTasks.filter(d => ["assigned", "picked"].includes(d.status));
  const completedTasks = myTasks.filter(d => ["delivered", "received"].includes(d.status));
  const openRequests   = deliveryRequests.filter(r => r.status === "open");
  const myFees         = agentFees.filter(f => f.agent_id === user?.id);
  const totalEarned    = myFees.filter(f => f.status === "paid").reduce((s, f) => s + Number(f.fee || 0), 0);
  const pendingPay     = myFees.filter(f => f.status === "pending").reduce((s, f) => s + Number(f.fee || 0), 0);

  const locationWatchRef = useRef(null);

  const startLocationSharing = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => updateAgentLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    if (locationWatchRef.current) return;
    locationWatchRef.current = navigator.geolocation.watchPosition(
      pos => updateAgentLocation(pos.coords.latitude, pos.coords.longitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }, [updateAgentLocation]);

  const stopLocationSharing = useCallback(() => {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (activeTasks.length > 0) startLocationSharing();
    else stopLocationSharing();
    return () => {};
  }, [activeTasks.length, startLocationSharing, stopLocationSharing]);

  useEffect(() => () => stopLocationSharing(), [stopLocationSharing]);

  const handleAccept = async (donationId) => {
    setAcceptingId(donationId);
    const result = await acceptDelivery(donationId, user.id, user.name);
    if (result && result.error) {
      setAcceptedMsg("Already taken by another agent!");
    } else {
      const fee = result && result.feeAmount ? "₹" + result.feeAmount : "";
      const km  = result && result.distanceKm ? result.distanceKm + " km" : "";
      setAcceptedMsg("Accepted! " + (fee ? fee + " · " + km : "Check Active Runs."));
      setActiveTab("active");
    }
    setAcceptingId(null);
    setTimeout(() => setAcceptedMsg(""), 4000);
  };

  const handlePickupPhotoAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map(fileToDataUrl));
    setPickupPhotos(prev => [...prev, ...urls]);
  };

  const handlePickupConfirm = () => {
    if (!pickupModal) return;
    pickupDonation(pickupModal, pickupQty, pickupPhotos);
    setPickupModal(null); setPickupQty(""); setPickupPhotos([]);
  };

  const handleDropPhotoAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    const urls = await Promise.all(files.map(fileToDataUrl));
    setDropPhotos(prev => [...prev, ...urls]);
  };

  const handleDropConfirm = () => {
    if (!dropModal) return;
    deliverDonation(dropModal, dropPhotos);
    setDropModal(null); setDropPhotos([]);
    stopLocationSharing();
  };

  const myLocation = agentLocations[user?.id];

  return (
    <div className="page-content">
      {/* Lightbox */}
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

      {/* Pickup Modal */}
      {pickupModal && (
        <div className="modal-overlay" onClick={() => setPickupModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h3>Pickup Verification</h3>
            <div className="form-group">
              <label className="form-label">Quantity Confirmed at Pickup</label>
              <input className="form-control" value={pickupQty} onChange={e => setPickupQty(e.target.value)} placeholder="e.g. 10 kg, 25 plates..." />
            </div>
            <input ref={pickupInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePickupPhotoAdd} />
            <button className="btn btn-outline btn-sm" onClick={() => pickupInputRef.current?.click()}>
              <Camera size={15} /> Add Photos ({pickupPhotos.length})
            </button>
            {pickupPhotos.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {pickupPhotos.map((p, i) => (
                  <div key={i} onClick={() => setLightboxImg(p)} style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--surface-border)' }}>
                    <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button className="btn btn-outline" onClick={() => setPickupModal(null)}>Cancel</button>
              <button className="btn btn-accent btn-block" onClick={handlePickupConfirm}>Confirm Pickup</button>
            </div>
          </div>
        </div>
      )}

      {/* Drop-off Modal */}
      {dropModal && (
        <div className="modal-overlay" onClick={() => setDropModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <h3>Drop-off Verification</h3>
            <input ref={dropInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleDropPhotoAdd} />
            <button className="btn btn-outline btn-sm" onClick={() => dropInputRef.current?.click()}>
              <Camera size={15} /> Add Drop Photos ({dropPhotos.length})
            </button>
            {dropPhotos.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {dropPhotos.map((p, i) => (
                  <div key={i} onClick={() => setLightboxImg(p)} style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--surface-border)' }}>
                    <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
              <button className="btn btn-outline" onClick={() => setDropModal(null)}>Cancel</button>
              <button className="btn btn-primary btn-block" onClick={handleDropConfirm}>Confirm Drop-off Delivered</button>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      <div className="dash-banner agent-banner">
        <div className="dash-banner-content">
          <h1>Agent Panel 🚴 — {user?.name}</h1>
          <p>Accept deliveries, track your route, and confirm pickups.</p>
        </div>
      </div>

      <section className="section">
        {/* Stats row */}
        <div className="panel-stats">
          <div className="panel-stat-card">
            <div className="panel-stat-icon yellow"><Truck size={22} /></div>
            <div><div className="panel-stat-value">{activeTasks.length}</div><div className="panel-stat-label">Active Runs</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><CheckCircle size={22} /></div>
            <div><div className="panel-stat-value">{completedTasks.length}</div><div className="panel-stat-label">Completed</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><IndianRupee size={22} /></div>
            <div><div className="panel-stat-value">₹{totalEarned.toLocaleString()}</div><div className="panel-stat-label">Total Earned</div></div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon yellow"><IndianRupee size={22} /></div>
            <div><div className="panel-stat-value">₹{pendingPay.toLocaleString()}</div><div className="panel-stat-label">Pending Payment</div></div>
          </div>
        </div>

        {acceptedMsg && (
          <div style={{ padding: "0.75rem 1rem", borderRadius: "var(--radius-md)", background: "rgba(45,106,79,0.1)", color: "var(--success)", marginBottom: "1rem", fontWeight: 600 }}>
            {acceptedMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === "jobs" ? "active" : ""}`} onClick={() => setActiveTab("jobs")}>
            Available Jobs{openRequests.length > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "0.75rem", marginLeft: "4px" }}>{openRequests.length}</span>}
          </button>
          <button className={`dash-tab ${activeTab === "active" ? "active" : ""}`} onClick={() => setActiveTab("active")}>
            Active Runs ({activeTasks.length})
          </button>
          <button className={`dash-tab ${activeTab === "completed" ? "active" : ""}`} onClick={() => setActiveTab("completed")}>
            Completed ({completedTasks.length})
          </button>
          <button className={`dash-tab ${activeTab === "earnings" ? "active" : ""}`} onClick={() => setActiveTab("earnings")}>
            <IndianRupee size={15} /> My Earnings
            {myFees.filter(f => f.status === 'pending').length > 0 && (
              <span style={{ background: "#f59e0b", color: "#fff", borderRadius: "10px", padding: "1px 6px", fontSize: "0.75rem", marginLeft: "4px" }}>
                {myFees.filter(f => f.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* ── AVAILABLE JOBS ───────────────────────────────────────────────── */}
        {activeTab === "jobs" && (
          <div className="cards-grid">
            {openRequests.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "4rem", color: "var(--text-muted)", background: "var(--bg-white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--surface-border)" }}>
                <Truck size={56} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <h3>No available jobs right now</h3>
                <p>New delivery requests will appear here when admin dispatches them.</p>
              </div>
            ) : openRequests.map(req => {
              const don = donations.find(d => d.id === req.donation_id);
              if (!don) return null;
              return (
                <div key={req.id} className="task-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                  <div className="task-card-header">
                    <span className="badge badge-pending">🆕 New Job</span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{req.donation_id}</span>
                  </div>
                  <h3 style={{ margin: "0.75rem 0 0.25rem" }}>{don.food_name}</h3>
                  <div className="task-card-detail">{don.quantity} — {don.quality}</div>
                  <div className="task-card-detail"><MapPin size={14} /> Pickup: {don.pickup_location}</div>
                  <div className="task-card-detail"><Navigation size={14} /> Drop: {req.center_name}</div>
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "rgba(245,158,11,0.08)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontWeight: 700, color: "#f59e0b" }}>Fee calculated after acceptance</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>Real distance via GPS geocoding — platform pays you</div>
                  </div>
                  <button
                    className="btn btn-block"
                    style={{ marginTop: "1rem", background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", border: "none", fontWeight: 700, fontSize: "1rem", borderRadius: "var(--radius-md)", padding: "0.75rem" }}
                    onClick={() => handleAccept(req.donation_id)}
                    disabled={acceptingId === req.donation_id}>
                    {acceptingId === req.donation_id ? "Calculating & Accepting..." : "Accept This Job"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── ACTIVE RUNS ──────────────────────────────────────────────────── */}
        {activeTab === "active" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {activeTasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)", background: "var(--bg-white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--surface-border)" }}>
                <h3>No active tasks</h3><p>Go to Available Jobs to accept a delivery.</p>
              </div>
            ) : activeTasks.map(task => {
              const pickupCoords = task.pickup_coords;
              const centerCoords = task.center_coords || { lat: 13.0604, lng: 80.2496 };
              return (
                <div key={task.id} className="task-card" style={{ borderLeft: "4px solid " + (task.status === "assigned" ? "var(--warning)" : "var(--primary)") }}>
                  <div className="task-card-header">
                    <span className={"badge " + (task.status === "assigned" ? "badge-pending" : "badge-info")}>
                      {task.status === "assigned" ? "Ready for Pickup" : "In Transit"}
                    </span>
                    <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text-muted)" }}>{task.id}</span>
                  </div>
                  <h3 style={{ margin: "0.75rem 0 0.25rem" }}>{task.food_name}</h3>
                  <div className="task-card-detail"><MapPin size={14} /> Pickup: {task.pickup_location}</div>
                  <div className="task-card-detail"><Navigation size={14} /> Drop: {task.center_name}</div>
                  {task.delivery_fee && (
                    <div style={{ marginTop: "0.5rem", padding: "0.5rem 0.75rem", background: "rgba(45,106,79,0.06)", borderRadius: "var(--radius-md)", fontSize: "0.85rem" }}>
                      Your payout: <strong style={{ color: 'var(--primary)' }}>₹{task.delivery_fee}</strong> · {task.delivery_distance} km
                    </div>
                  )}
                  <div style={{ marginTop: "1rem" }}>
                    <LiveMap
                      pickupCoords={pickupCoords}
                      dropCoords={centerCoords}
                      agentCoords={myLocation ? { lat: myLocation.lat, lng: myLocation.lng } : undefined}
                      showRoute={true}
                      height="260px"
                      label={task.status === "picked" ? "En Route" : "Pickup Route"}
                    />
                  </div>
                  {task.status === "assigned" && (
                    <div style={{ marginTop: "1.25rem", padding: "1rem", background: "var(--bg-section)", borderRadius: "var(--radius-md)" }}>
                      <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>At Pickup: Verify quantity and upload photos.</p>
                      <button className="btn btn-accent btn-block" onClick={() => { setPickupModal(task.id); setPickupQty(task.quantity || ""); }}>
                        <Camera size={16} /> Confirm Pickup with Photos
                      </button>
                    </div>
                  )}
                  {task.status === "picked" && (
                    <div style={{ marginTop: "1.25rem", padding: "1rem", background: "rgba(45,106,79,0.04)", borderRadius: "var(--radius-md)", border: "1px solid rgba(45,106,79,0.15)" }}>
                      <strong style={{ color: "var(--primary)" }}>In Transit to {task.center_name}</strong>
                      <button className="btn btn-primary btn-block" style={{ marginTop: "0.75rem" }} onClick={() => setDropModal(task.id)}>
                        <Camera size={16} /> Confirm Drop-off with Photos
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── COMPLETED ────────────────────────────────────────────────────── */}
        {activeTab === "completed" && (
          <div className="cards-grid">
            {completedTasks.length === 0 ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "4rem", color: "var(--text-muted)", background: "var(--bg-white)", borderRadius: "var(--radius-lg)", border: "1px solid var(--surface-border)" }}>
                <h3>No completed deliveries yet</h3>
              </div>
            ) : completedTasks.map(task => (
              <div key={task.id} className="task-card" style={{ borderLeft: "4px solid var(--success)" }}>
                <div className="task-card-header">
                  <span className="badge badge-success">✅ Delivered</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{task.id}</span>
                </div>
                <h4 style={{ marginTop: "0.5rem" }}>{task.food_name}</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{task.quantity} from {task.donor_name} → {task.center_name}</p>
                {task.delivery_fee && (
                  <p style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 700 }}>
                    Earned: ₹{task.delivery_fee} · {task.delivery_distance} km
                  </p>
                )}
                {task.delivered_at && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(task.delivered_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {/* Show delivery photos thumbnail */}
                {(task.pickup_photos?.length > 0 || task.drop_photos?.length > 0) && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                    {[...(task.pickup_photos || []), ...(task.drop_photos || [])].slice(0, 4).map((p, i) => (
                      <div key={i} onClick={() => setLightboxImg(p)} style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', border: '1.5px solid var(--surface-border)' }}>
                        <img src={p} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── MY EARNINGS ──────────────────────────────────────────────────── */}
        {activeTab === "earnings" && (
          <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'linear-gradient(135deg, #2d6a4f, #1a4731)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', color: '#fff' }}>
                <div style={{ fontSize: '0.82rem', opacity: 0.8, marginBottom: '0.4rem' }}>Total Earned</div>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{totalEarned.toLocaleString()}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '0.25rem' }}>{myFees.filter(f => f.status === 'paid').length} deliveries paid</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', color: '#fff' }}>
                <div style={{ fontSize: '0.82rem', opacity: 0.8, marginBottom: '0.4rem' }}>Pending Payment</div>
                <div style={{ fontSize: '2rem', fontWeight: 800 }}>₹{pendingPay.toLocaleString()}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '0.25rem' }}>{myFees.filter(f => f.status === 'pending').length} awaiting admin review</div>
              </div>
              <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--surface-border)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>My UPI ID</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb', wordBreak: 'break-all' }}>
                  {user?.upi_id || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Admin pays to this UPI</div>
              </div>
            </div>

            {/* Fee history table */}
            {myFees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Award size={56} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <h3>No earnings yet</h3>
                <p>Complete deliveries to start earning. Payment is made after admin reviews your photos.</p>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fee ID</th><th>Food Item</th><th>Distance</th><th>Amount</th><th>Status</th><th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myFees.map(fee => (
                      <tr key={fee.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{fee.id}</td>
                        <td style={{ fontWeight: 600 }}>{fee.food_name}</td>
                        <td>{fee.distance_km ? `${fee.distance_km} km` : '—'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{fee.fee}</td>
                        <td>
                          <span className={`badge ${fee.status === 'paid' ? 'badge-success' : 'badge-pending'}`}>
                            {fee.status === 'paid' ? '✅ Paid' : '⏳ Pending Review'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {fee.paid_at
                            ? new Date(fee.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : fee.created_at
                              ? new Date(fee.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: '0.875rem 1.25rem', background: 'rgba(45,106,79,0.04)', borderTop: '1px solid var(--surface-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <IndianRupee size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>Total Earned: ₹{totalEarned.toLocaleString()}</span>
                  {pendingPay > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>· ₹{pendingPay.toLocaleString()} pending</span>}
                </div>
              </div>
            )}

            {myFees.filter(f => f.status === 'pending').length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.875rem 1.25rem', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1.5px solid rgba(245,158,11,0.2)', fontSize: '0.88rem', color: '#92400e' }}>
                ⏳ <strong>Pending payments</strong> are being processed — admin reviews your delivery photos before releasing payment. This usually takes 24 hours.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default AgentDashboard;
