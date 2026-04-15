import React from 'react';
import { NavLink } from 'react-router-dom';
import { Heart, ShieldCheck, Truck, Coins } from 'lucide-react';

const Sidebar = () => {
  const navStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    color: isActive ? '#fff' : 'var(--text-muted)',
    background: isActive ? 'var(--primary)' : 'transparent',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'all 0.2s',
    marginBottom: '0.5rem',
  });

  return (
    <div className="sidebar glass-panel" style={{ borderRight: 'none', borderRadius: 0 }}>
      <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Heart color="var(--primary)" size={32} />
        <h2 style={{ color: 'var(--text-main)' }}>Deepi<span style={{color: 'var(--primary)'}}> Trust</span></h2>
      </div>
      
      <nav style={{ display: 'flex', flexDirection: 'column' }}>
        <NavLink to="/volunteer" style={navStyle}>
          <Heart size={20} />
          Volunteer Portal
        </NavLink>
        <NavLink to="/admin" style={navStyle}>
          <ShieldCheck size={20} />
          Admin Dashboard
        </NavLink>
        <NavLink to="/delivery" style={navStyle}>
          <Truck size={20} />
          Delivery Agent
        </NavLink>
        <NavLink to="/crowdfunding" style={navStyle}>
          <Coins size={20} />
          Crowdfunding
        </NavLink>
      </nav>

      <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--success)' }}>Real-time Sync Active</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Connected to distributed ledger</p>
      </div>
    </div>
  );
};

export default Sidebar;
