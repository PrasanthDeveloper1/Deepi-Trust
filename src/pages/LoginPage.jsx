import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, Eye, EyeOff, LogIn, Shield, Truck, Home, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { id: 'donor', label: 'Donor', icon: <Heart size={20} />, desc: 'Donate excess food', color: '#2d6a4f' },
  { id: 'admin', label: 'Admin', icon: <Shield size={20} />, desc: 'Manage platform', color: '#7c3aed' },
  { id: 'agent', label: 'Delivery Agent', icon: <Truck size={20} />, desc: 'Deliver food', color: '#2563eb' },
  { id: 'center', label: 'Beneficiary Center', icon: <Home size={20} />, desc: 'Receive donations', color: '#d97706' },
];

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Navigate based on role
    const role = result.data.role;
    if (role === 'admin') navigate('/admin');
    else if (role === 'agent') navigate('/agent');
    else if (role === 'center') navigate('/center');
    else navigate('/donor');
  };

  const quickLogin = (role) => {
    if (role === 'admin') {
      setEmail('admindeepika@gmail.com');
      setPassword('Admin123');
      setSelectedRole('admin');
    }
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
            <h2>Welcome Back</h2>
            <p>Sign in to access your dashboard and make a difference in someone's life today.</p>
            
            <div className="auth-features">
              <div className="auth-feature">
                <div className="auth-feature-icon">🍲</div>
                <div>
                  <strong>Food Donations</strong>
                  <span>Verified & delivered safely</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">🤖</div>
                <div>
                  <strong>AI Quality Check</strong>
                  <span>Every donation verified</span>
                </div>
              </div>
              <div className="auth-feature">
                <div className="auth-feature-icon">📍</div>
                <div>
                  <strong>GPS Tracking</strong>
                  <span>Real-time delivery tracking</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Form */}
        <div className="auth-right">
          <form onSubmit={handleSubmit} className="auth-form">
            <h2>Sign In</h2>
            <p className="auth-subtitle">Enter your credentials to continue</p>

            {error && (
              <div className="auth-error">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Admin Quick Access */}
            <div className="auth-roles-quick">
              <label className="auth-label-sm">Admin Quick Access</label>
              <div className="auth-role-chips">
                <button
                  type="button"
                  className={`auth-role-chip ${selectedRole === 'admin' ? 'active' : ''}`}
                  onClick={() => quickLogin('admin')}
                  style={{ '--role-color': '#7c3aed' }}
                >
                  <Shield size={20} />
                  <span>Admin</span>
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                Other roles? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600 }}>Create an account</Link> to get started.
              </p>
            </div>

            <div className="auth-divider"><span>or enter manually</span></div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  type="email"
                  className="form-control auth-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="form-control auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="auth-pass-toggle" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block auth-submit" disabled={loading}>
              {loading ? (
                <><div className="auth-spinner" /> Signing In...</>
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>

            <p className="auth-switch">
              Don't have an account? <Link to="/signup">Create Account</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
