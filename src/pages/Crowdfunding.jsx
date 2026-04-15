import React, { useState, useEffect } from 'react';
import { Search, ArrowRight, CheckCircle, UploadCloud, X, QrCode } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/supabase';

const Crowdfunding = () => {
  const { user } = useAuth();
  const { addPayment, payments } = useAppContext();
  const [formData, setFormData] = useState({ name: user?.name || '', email: '', phone: '', amount: '' });
  const [step, setStep] = useState(1);
  const [trackingId, setTrackingId] = useState('');
  const [proofImg, setProofImg] = useState(null);

  const handleNext = (e) => { e.preventDefault(); setStep(2); };

  const handlePaySubmit = () => {
    addPayment({
      donor_name: formData.name,
      email: formData.email,
      amount: Number(formData.amount),
      proof: proofImg
    });
    setStep(3);
  };

  const handleProofUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setProofImg(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const userTxns = payments.filter(f =>
    trackingId && (f.donor_name.toLowerCase().includes(trackingId.toLowerCase()) || f.id === trackingId)
  );

  // Admin QR — reads from DB (async-compatible, works with both localDB & supabaseDB)
  const [adminQRImg, setAdminQRImg] = useState(null);

  useEffect(() => {
    // Fetch initial QR
    Promise.resolve(db.getAdminQR()).then(setAdminQRImg);
    // Poll every 3s in case admin updates it while this page is open
    const interval = setInterval(async () => {
      const qr = await Promise.resolve(db.getAdminQR());
      setAdminQRImg(qr);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fallback QR via API (only if admin hasn't uploaded a custom one)
  const fallbackQRUrl = formData.amount
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=deepitrust@upi&pn=Deepi%20Trust&am=${formData.amount}&cu=INR`)}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`upi://pay?pa=deepitrust@upi&pn=Deepi%20Trust&cu=INR`)}`;

  const qrToShow = adminQRImg || fallbackQRUrl;

  return (
    <div className="page-content">
      {/* Banner */}
      <div className="dash-banner crowdfund-banner">
        <div className="dash-banner-content" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Support Our Mission 💰</h1>
          <p>Every rupee helps deliver nutritious meals to those who need it most.</p>
        </div>
      </div>

      <section className="section">
        <div className="cf-layout">
          {/* Left - Payment Flow */}
          <div>
            <div className="cf-step-indicator">
              <div className={`cf-step ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}>1. Your Details</div>
              <div className={`cf-step ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}>2. Scan & Pay</div>
              <div className={`cf-step ${step >= 3 ? 'active' : ''}`}>3. Confirmation</div>
            </div>

            <div className="form-container">
              {step === 1 && (
                <form onSubmit={handleNext}>
                  <h2 style={{ marginBottom: '0.25rem' }}>Your Details</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    Fill your information before proceeding to payment.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input type="text" className="form-control" required
                      value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter your full name" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-control"
                        value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="you@email.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input type="tel" className="form-control"
                        value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Donation Amount (₹)</label>
                    <input type="number" className="form-control" required min="1"
                      value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="500" style={{ fontSize: '1.25rem', fontWeight: 700 }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {[100, 250, 500, 1000, 2500, 5000].map(amt => (
                      <button key={amt} type="button"
                        className={`btn ${formData.amount == amt ? 'btn-primary' : 'btn-outline'} btn-sm`}
                        onClick={() => setFormData({ ...formData, amount: String(amt) })}>
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className="btn btn-accent btn-lg btn-block">
                    Proceed to Payment <ArrowRight size={18} />
                  </button>
                </form>
              )}

              {step === 2 && (
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ marginBottom: '0.5rem' }}>Scan & Pay</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                    Scan the QR code below with any UPI app to donate <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{formData.amount}</strong>
                  </p>
                  <div className="qr-container" style={{ marginBottom: '1.5rem' }}>
                    {adminQRImg ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={adminQRImg} alt="Platform Payment QR"
                          style={{ width: '220px', height: '220px', objectFit: 'contain', borderRadius: '12px', border: '3px solid var(--primary)' }} />
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <QrCode size={14} /> Scan to pay ₹{formData.amount} via any UPI app
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={fallbackQRUrl} alt="Payment QR Code" style={{ borderRadius: '12px' }} />
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Scan to pay via UPI</div>
                      </div>
                    )}
                  </div>

                  {/* Payment Proof Upload */}
                  <div style={{ margin: '1.5rem auto', maxWidth: '400px', textAlign: 'left' }}>
                    <label className="form-label">Upload Payment Screenshot (optional)</label>
                    <input type="file" id="proof-upload" accept="image/*" onChange={handleProofUpload} style={{ display: 'none' }} />
                    {proofImg ? (
                      <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--primary)', marginTop: '0.5rem' }}>
                        <img src={proofImg} alt="Proof" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', display: 'block' }} />
                        <button onClick={() => setProofImg(null)}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label htmlFor="proof-upload" className="upload-zone" style={{ padding: '1.5rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                        <UploadCloud size={28} color="var(--primary)" />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>Click to upload screenshot</p>
                      </label>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                    <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                    <button className="btn btn-primary btn-lg" onClick={handlePaySubmit}>
                      I've Paid — Submit <CheckCircle size={18} />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(45,106,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <CheckCircle size={40} color="var(--success)" />
                  </div>
                  <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Payment Submitted!</h2>
                  <p style={{ color: 'var(--text-body)', maxWidth: '400px', margin: '0 auto', lineHeight: '1.6' }}>
                    Your donation of <strong>₹{formData.amount}</strong> is now <span className="badge badge-pending" style={{ marginLeft: '0.25rem' }}>Under Review</span>
                    <br /><br />Admin will verify and update the status.
                  </p>
                  <button className="btn btn-outline" style={{ marginTop: '2rem' }}
                    onClick={() => { setStep(1); setFormData({ name: user?.name || '', email: '', phone: '', amount: '' }); setProofImg(null); }}>
                    Make Another Donation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right - Tracker */}
          <div style={{ position: 'sticky', top: '100px' }}>
            <div className="form-container">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <Search size={20} /> Track Your Payment
              </h3>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <input type="text" className="form-control" placeholder="Enter name or Transaction ID"
                  value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
              </div>
              {trackingId && userTxns.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontSize: '0.9rem' }}>
                  No transactions found for "{trackingId}"
                </p>
              )}
              {userTxns.map((txn, idx) => (
                <div key={idx} className="tracker-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>{txn.donor_name}</strong>
                    <strong style={{ color: 'var(--primary)' }}>₹{txn.amount}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`badge ${txn.status === 'review' ? 'badge-pending' : 'badge-success'}`}>
                      {txn.status === 'review' ? '⏳ Under Review' : '✅ Completed'}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{txn.id}</span>
                  </div>
                </div>
              ))}
              {!trackingId && (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                  <Search size={36} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
                  <p style={{ fontSize: '0.9rem' }}>Enter your name or Transaction ID to track.</p>
                </div>
              )}
            </div>
            <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>💡 How it works</h4>
              <ul style={{ color: 'var(--text-body)', fontSize: '0.9rem', lineHeight: '1.8', paddingLeft: '1.25rem' }}>
                <li>Fill your details and choose an amount</li>
                <li>Scan the QR code and pay via UPI</li>
                <li>Upload payment screenshot (optional)</li>
                <li>Admin verifies and marks as <strong>Completed</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Crowdfunding;
