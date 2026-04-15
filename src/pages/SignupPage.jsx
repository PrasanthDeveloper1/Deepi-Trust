import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart, Mail, Lock, Eye, EyeOff, UserPlus, User, Phone,
  MapPin, Truck, Home, QrCode, IndianRupee, Upload, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'donor',  label: 'Donor',              icon: <Heart size={22} />, desc: 'I want to donate excess food',     color: '#2d6a4f' },
  { id: 'agent',  label: 'Delivery Agent',      icon: <Truck size={22} />, desc: 'I want to deliver food for pay',   color: '#2563eb' },
  { id: 'center', label: 'Beneficiary Center',  icon: <Home  size={22} />, desc: 'I am a receiving institution',     color: '#d97706' },
];

function fileToDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

const SignupPage = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    role: '', name: '', email: '', password: '', phone: '', address: '',
    upi_id: '', payment_qr: null,
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const qrInputRef = useRef();

  const selectRole = (role) => {
    setFormData({ ...formData, role });
    setStep(2);
  };

  const handleQRUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setFormData(prev => ({ ...prev, payment_qr: dataUrl }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (formData.role === 'agent' && !formData.upi_id) { setError('UPI ID is required for agents'); return; }
    setLoading(true);
    const result = await signup(formData);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    const role = result.data.role;
    navigate(role === 'agent' ? '/agent' : role === 'center' ? '/center' : '/donor');
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-container">
        {/* Left Panel */}
        <div className="auth-left">
          <div className="auth-left-content">
            <div className="auth-brand">
              <Heart size={36} fill="#f5c518" strokeWidth={0} />
              <h1>DEEPI<span> TRUST</span></h1>
            </div>
            <h2>Join Our Mission</h2>
            <p>Create your account and be part of a community that delivers hope through food.</p>
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">🌍</div>
                <div><strong>Growing Community</strong><span>Join donors & volunteers</span></div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">🏠</div>
                <div><strong>Partner Centers</strong><span>Orphanages & old-age homes</span></div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">💰</div>
                <div><strong>Crowdfunding</strong><span>Transparent fund tracking</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="auth-right">
          {step === 1 ? (
            <div className="auth-form">
              <h2>Choose Your Role</h2>
              <p className="auth-subtitle">Select how you'd like to contribute</p>
              <div className="auth-role-cards">
                {ROLES.map(r => (
                  <button key={r.id} className="auth-role-card" onClick={() => selectRole(r.id)} style={{ '--role-color': r.color }}>
                    <div className="auth-role-card-icon">{r.icon}</div>
                    <div>
                      <strong>{r.label}</strong>
                      <span>{r.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="auth-switch">Already have an account? <Link to="/login">Sign In</Link></p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              <button type="button" className="auth-back" onClick={() => setStep(1)}>← Change Role</button>
              <h2>Create Account</h2>
              <p className="auth-subtitle">
                Signing up as <span className="badge badge-info" style={{ marginLeft: '0.25rem' }}>
                  {formData.role === 'donor' ? '❤️ Donor' : formData.role === 'agent' ? '🚚 Delivery Agent' : '🏠 Center'}
                </span>
              </p>

              {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

              {/* Name */}
              <div className="form-group">
                <label className="form-label">{formData.role === 'center' ? 'Institution Name' : 'Full Name'}</label>
                <div className="auth-input-wrap">
                  <User size={18} className="auth-input-icon" />
                  <input type="text" className="form-control auth-input" required
                    placeholder={formData.role === 'center' ? 'e.g. City Orphanage' : 'Enter your full name'}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon" />
                  <input type="email" className="form-control auth-input" required
                    placeholder="you@email.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
              </div>

              {/* Password + Phone */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div className="auth-input-wrap">
                    <Lock size={18} className="auth-input-icon" />
                    <input type={showPass ? 'text' : 'password'} className="form-control auth-input" required
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    <button type="button" className="auth-pass-toggle" onClick={() => setShowPass(!showPass)}>
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <div className="auth-input-wrap">
                    <Phone size={18} className="auth-input-icon" />
                    <input type="tel" className="form-control auth-input"
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Center address */}
              {formData.role === 'center' && (
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <div className="auth-input-wrap">
                    <MapPin size={18} className="auth-input-icon" />
                    <input type="text" className="form-control auth-input" required
                      placeholder="Full address of your institution"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ── Agent-specific: UPI ID + QR ──────────────────────────────── */}
              {formData.role === 'agent' && (
                <div style={{ marginTop: '0.5rem', padding: '1.25rem', background: 'rgba(37,99,235,0.05)', borderRadius: '12px', border: '1.5px solid rgba(37,99,235,0.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#2563eb', fontWeight: 700, fontSize: '0.92rem' }}>
                    <IndianRupee size={16} /> Payment Details (Required)
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Admin will pay your delivery fees to this UPI ID after verifying each delivery.
                  </p>

                  {/* UPI ID */}
                  <div className="form-group">
                    <label className="form-label">UPI ID <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div className="auth-input-wrap">
                      <IndianRupee size={18} className="auth-input-icon" />
                      <input type="text" className="form-control auth-input" required={formData.role === 'agent'}
                        placeholder="yourname@upi or 9876543210@paytm"
                        value={formData.upi_id}
                        onChange={e => setFormData({ ...formData, upi_id: e.target.value })} />
                    </div>
                  </div>

                  {/* QR Upload */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Payment QR Code (Optional)</label>
                    <input ref={qrInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQRUpload} />
                    {formData.payment_qr ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img src={formData.payment_qr} alt="QR Preview"
                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '2px solid rgba(37,99,235,0.3)' }} />
                        <div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--success)', fontWeight: 600 }}>✅ QR uploaded</div>
                          <button type="button" onClick={() => { setFormData(prev => ({ ...prev, payment_qr: null })); qrInputRef.current.value = ''; }}
                            style={{ marginTop: '0.4rem', background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <X size={13} /> Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm btn-block" onClick={() => qrInputRef.current?.click()}>
                        <QrCode size={16} /> Upload Your UPI QR Code
                      </button>
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-lg btn-block auth-submit" disabled={loading} style={{ marginTop: '1.5rem' }}>
                {loading ? <><div className="auth-spinner" /> Creating Account...</> : <><UserPlus size={18} /> Create Account</>}
              </button>

              <p className="auth-switch">Already have an account? <Link to="/login">Sign In</Link></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
