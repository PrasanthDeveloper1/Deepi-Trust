import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Heart, LogOut, Bell, User, ChevronDown, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

const ROLE_NAV = {
  donor: [
    { path: '/donor', label: 'Dashboard' },
    { path: '/crowdfunding', label: '❤️ Crowdfunding' },
  ],
  // Admin does NOT have Crowdfunding — they manage it in their own Payments panel
  admin: [
    { path: '/admin', label: 'Dashboard' },
    { path: '/tracking', label: 'Tracking' },
  ],
  agent: [
    { path: '/agent', label: 'My Deliveries' },
    { path: '/crowdfunding', label: '❤️ Crowdfunding' },
    { path: '/tracking', label: 'Live Map' },
  ],
  center: [
    { path: '/center', label: 'Dashboard' },
    { path: '/crowdfunding', label: '❤️ Crowdfunding' },
  ],
};

const PUBLIC_NAV = [
  { path: '/', label: 'Home' },
  { path: '/crowdfunding', label: 'Crowdfunding' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useAppContext();
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  const navLinks = user ? (ROLE_NAV[user.role] || []) : PUBLIC_NAV;

  const roleLabels = { donor: '❤️ Donor', admin: '🛡️ Admin', agent: '🚚 Agent', center: '🏠 Center' };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <NavLink to={user ? `/${user.role === 'donor' ? 'donor' : user.role}` : '/'} className="navbar-brand">
        <Heart size={28} fill="#2d6a4f" strokeWidth={0} />
        <h1>DEEPI<span> TRUST</span></h1>
      </NavLink>

      {/* Desktop Nav */}
      <ul className="nav-links">
        {navLinks.map(link => (
          <li key={link.path}>
            <NavLink to={link.path} className={({ isActive }) => isActive ? 'active' : ''}>{link.label}</NavLink>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {user ? (
          <>
            {/* Notifications */}
            <button style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem', color: 'var(--text-body)' }}
              onClick={() => navigate(user.role === 'admin' ? '/admin' : `/${user.role}`)}>
              <Bell size={20} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px',
                  background: 'var(--danger)', color: '#fff', borderRadius: '50%',
                  fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {/* User Dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button className="user-dropdown-trigger" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <div className="user-avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div className="user-info-mini">
                  <span className="user-name-mini">{user.name}</span>
                  <span className="user-role-mini">{roleLabels[user.role] || user.role}</span>
                </div>
                <ChevronDown size={16} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {dropdownOpen && (
                <div className="user-dropdown-menu animate-in">
                  <div className="user-dropdown-header">
                    <div className="user-avatar lg">{user.name?.charAt(0)?.toUpperCase()}</div>
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </div>
                  <div className="user-dropdown-divider" />
                  <button className="user-dropdown-item" onClick={() => { navigate(`/${user.role === 'donor' ? 'donor' : user.role}`); setDropdownOpen(false); }}>
                    <User size={16} /> My Dashboard
                  </button>
                  <button className="user-dropdown-item danger" onClick={handleLogout}>
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <NavLink to="/login" className="btn btn-outline btn-sm">Sign In</NavLink>
            <NavLink to="/signup" className="btn-donate-nav">Get Started &nbsp;»</NavLink>
          </>
        )}

        {/* Mobile Menu Toggle */}
        <button className="mobile-menu-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="mobile-menu animate-in">
          {navLinks.map(link => (
            <NavLink key={link.path} to={link.path} className={({ isActive }) => `mobile-menu-item ${isActive ? 'active' : ''}`}>
              {link.label}
            </NavLink>
          ))}
          {user ? (
            <button className="mobile-menu-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={16} /> Sign Out
            </button>
          ) : (
            <>
              <NavLink to="/login" className="mobile-menu-item">Sign In</NavLink>
              <NavLink to="/signup" className="mobile-menu-item">Create Account</NavLink>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
