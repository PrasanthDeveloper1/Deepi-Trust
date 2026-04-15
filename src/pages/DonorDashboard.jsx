import React, { useState, useRef, useCallback } from 'react';
import { Heart, UploadCloud, CheckCircle, ArrowRight, X, Image as ImageIcon, Package, Clock, Truck, MapPin, History, Plus, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

const DonorDashboard = () => {
  const { user } = useAuth();
  const { donations, addDonation } = useAppContext();
  const [activeTab, setActiveTab] = useState('donate');
  const [formData, setFormData] = useState({
    food_name: '', quantity: '', pickup_location: '',
    prep_time: '', expiry_time: '', quality: 'Good'
  });
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef(null);

  const myDonations = donations.filter(d => d.donor_id === user?.id);
  const pendingCount = myDonations.filter(d => d.status === 'pending').length;
  const deliveredCount = myDonations.filter(d => ['delivered', 'received'].includes(d.status)).length;

  const processFiles = useCallback((files) => {
    Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024)
      .forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos(prev => [...prev, { id: Date.now() + Math.random(), name: file.name, size: file.size, dataUrl: e.target.result }]);
        };
        reader.readAsDataURL(file);
      });
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (photos.length === 0) { alert('Please upload at least one photo of the food.'); return; }
    addDonation({
      ...formData,
      donor_id: user.id,
      donor_name: user.name,
      photos: photos.map(p => p.dataUrl)
    });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setActiveTab('history'); }, 3000);
    setFormData({ food_name: '', quantity: '', pickup_location: '', prep_time: '', expiry_time: '', quality: 'Good' });
    setPhotos([]);
  };

  const statusConfig = {
    pending: { label: 'Pending', badge: 'badge-pending', icon: '⏳' },
    approved: { label: 'AI Approved', badge: 'badge-info', icon: '✅' },
    rejected: { label: 'Rejected', badge: 'badge-danger', icon: '❌' },
    assigned: { label: 'Agent Assigned', badge: 'badge-info', icon: '🚚' },
    picked: { label: 'Picked Up', badge: 'badge-info', icon: '📦' },
    delivered: { label: 'Delivered', badge: 'badge-success', icon: '✅' },
    received: { label: 'Received by Center', badge: 'badge-success', icon: '🏠' },
  };

  return (
    <div className="page-content">
      {/* Banner */}
      <div className="dash-banner donor-banner">
        <div className="dash-banner-content">
          <h1>Welcome, {user?.name || 'Donor'} 👋</h1>
          <p>Thank you for making a difference. Submit food donations and track their journey.</p>
        </div>
      </div>

      <section className="section">
        {/* Stats */}
        <div className="panel-stats">
          <div className="panel-stat-card">
            <div className="panel-stat-icon green"><Heart size={22} /></div>
            <div>
              <div className="panel-stat-value">{myDonations.length}</div>
              <div className="panel-stat-label">Total Donations</div>
            </div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon yellow"><Clock size={22} /></div>
            <div>
              <div className="panel-stat-value">{pendingCount}</div>
              <div className="panel-stat-label">Pending Review</div>
            </div>
          </div>
          <div className="panel-stat-card">
            <div className="panel-stat-icon blue"><Truck size={22} /></div>
            <div>
              <div className="panel-stat-value">{deliveredCount}</div>
              <div className="panel-stat-label">Delivered</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="dash-tabs">
          <button className={`dash-tab ${activeTab === 'donate' ? 'active' : ''}`} onClick={() => setActiveTab('donate')}>
            <Plus size={16} /> New Donation
          </button>
          <button className={`dash-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            <History size={16} /> My Donations ({myDonations.length})
          </button>
        </div>

        {/* New Donation Form */}
        {activeTab === 'donate' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3rem', alignItems: 'start' }}>
            <div className="form-container animate-in">
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <CheckCircle color="var(--success)" size={72} style={{ marginBottom: '1rem' }} />
                  <h2 style={{ color: 'var(--success)', marginBottom: '0.5rem' }}>Donation Submitted!</h2>
                  <p style={{ color: 'var(--text-body)' }}>
                    Your food donation has been registered. Our admin will run an AI quality check shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h2 style={{ marginBottom: '0.25rem' }}>Submit Food Donation</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                    All fields are required. Photos are essential for AI quality verification.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Food Name / Description</label>
                    <input type="text" className="form-control" required
                      value={formData.food_name}
                      onChange={e => setFormData({ ...formData, food_name: e.target.value })}
                      placeholder="e.g. Cooked Rice & Sambar, Biryani Party Pack"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Quantity (kg / plates)</label>
                      <input type="text" className="form-control" required
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        placeholder="e.g. 10 kg, 25 plates"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Food Quality</label>
                      <select className="form-control"
                        value={formData.quality}
                        onChange={e => setFormData({ ...formData, quality: e.target.value })}
                      >
                        <option>Excellent</option>
                        <option>Good</option>
                        <option>Average</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pickup Location</label>
                    <input type="text" className="form-control" required
                      value={formData.pickup_location}
                      onChange={e => setFormData({ ...formData, pickup_location: e.target.value })}
                      placeholder="Full address for pickup"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Preparation Time</label>
                      <input type="text" className="form-control" required
                        value={formData.prep_time}
                        onChange={e => setFormData({ ...formData, prep_time: e.target.value })}
                        placeholder="e.g. 2 hours ago"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expiry Time</label>
                      <input type="text" className="form-control" required
                        value={formData.expiry_time}
                        onChange={e => setFormData({ ...formData, expiry_time: e.target.value })}
                        placeholder="e.g. 6 hours from now"
                      />
                    </div>
                  </div>

                  {/* Photo Upload */}
                  <div className="form-group">
                    <label className="form-label">Food Photos <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>* Required</span></label>
                    <input type="file" ref={fileInputRef} onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }}
                      accept="image/*" multiple style={{ display: 'none' }}
                    />
                    <div
                      className={`upload-zone ${isDragging ? 'upload-zone-active' : ''}`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(e.dataTransfer.files); }}
                    >
                      <UploadCloud color="var(--primary)" size={40} />
                      <p style={{ fontWeight: 600 }}>{isDragging ? 'Drop photos here!' : 'Click or drag photos here'}</p>
                      <p className="hint">PNG, JPG up to 10MB — Required for AI Quality Check</p>
                    </div>

                    {photos.length > 0 && (
                      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '0.75rem' }}>
                        {photos.map(photo => (
                          <div key={photo.id} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--surface-border)' }}>
                            <img src={photo.dataUrl} alt={photo.name} style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                            <button type="button" onClick={() => setPhotos(prev => prev.filter(p => p.id !== photo.id))}
                              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                            ><X size={10} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {photos.length > 0 && (
                      <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                        <ImageIcon size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                        {photos.length} photo{photos.length > 1 ? 's' : ''} attached
                      </p>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg btn-block">
                    Submit Donation <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>

            {/* Side Info */}
            <div className="animate-in delay-2" style={{ position: 'sticky', top: '100px' }}>
              <img src="https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&q=80"
                alt="Volunteers" style={{ width: '100%', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)', objectFit: 'cover', height: '350px' }}
              />
              <div style={{ marginTop: '1.5rem', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--surface-border)' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>🤖 AI-Powered Quality Check</h4>
                <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                  Every donation is scanned by our AI engine to ensure food safety and freshness before distribution.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Donation History */}
        {activeTab === 'history' && (
          <div>
            {myDonations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-white)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
                <Package size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <h3>No donations yet</h3>
                <p>Submit your first food donation to get started!</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setActiveTab('donate')}>
                  <Plus size={16} /> Make a Donation
                </button>
              </div>
            ) : (
              <div className="cards-grid">
                {myDonations.map(don => {
                  const sc = statusConfig[don.status] || statusConfig.pending;
                  return (
                    <div key={don.id} className="task-card animate-in">
                      <div className="task-card-header">
                        <span className={`badge ${sc.badge}`}>{sc.icon} {sc.label}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{don.id}</span>
                      </div>
                      <h3 style={{ margin: '0.5rem 0 0.25rem' }}>{don.food_name}</h3>
                      <div className="task-card-detail"><Package size={16} /> {don.quantity} · {don.quality}</div>
                      <div className="task-card-detail"><MapPin size={16} /> {don.pickup_location}</div>
                      <div className="task-card-detail"><Clock size={16} /> Prep: {don.prep_time} · Expires: {don.expiry_time}</div>
                      
                      {don.ai_score && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(45,106,79,0.04)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle size={16} color="var(--success)" />
                          <span style={{ fontSize: '0.9rem', color: 'var(--success)', fontWeight: 600 }}>AI Score: {don.ai_score}%</span>
                        </div>
                      )}

                      {don.agent_name && (
                        <div className="task-card-detail" style={{ marginTop: '0.5rem' }}>
                          <Truck size={16} /> Agent: <strong>{don.agent_name}</strong>
                        </div>
                      )}

                      {don.status === 'rejected' && don.reject_reason && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(230,57,70,0.06)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertTriangle size={16} color="var(--danger)" />
                          <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>{don.reject_reason}</span>
                        </div>
                      )}

                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                        {new Date(don.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default DonorDashboard;
