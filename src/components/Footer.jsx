import React from 'react';
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Heart size={24} fill="#f5c518" strokeWidth={0} />
            <h3 style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: '1.4rem' }}>DEEPI<span style={{ color: '#2d6a4f' }}> TRUST</span></h3>
          </div>
          <p style={{ maxWidth: '320px' }}>
            Bridging the gap between excess food and hungry hearts. Our AI-powered platform ensures safe, 
            quality-checked food reaches those who need it most.
          </p>
        </div>
        <div>
          <h4>Quick Links</h4>
          <a href="/donate" style={{ display: 'block' }}>Donate Food</a>
          <a href="/crowdfunding" style={{ display: 'block' }}>Crowdfunding</a>
          <a href="/admin" style={{ display: 'block' }}>Admin Panel</a>
          <a href="/delivery" style={{ display: 'block' }}>Delivery Tracking</a>
        </div>
        <div>
          <h4>Our Work</h4>
          <a href="#" style={{ display: 'block' }}>Old Age Homes</a>
          <a href="#" style={{ display: 'block' }}>Orphanages</a>
          <a href="#" style={{ display: 'block' }}>Community Kitchens</a>
          <a href="#" style={{ display: 'block' }}>Disaster Relief</a>
        </div>
        <div>
          <h4>Contact</h4>
          <p>support@deepitrust.org</p>
          <p>+91 98765 43210</p>
          <p style={{ marginTop: '0.5rem' }}>Chennai, Tamil Nadu, India</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 Deepi Trust and Donations. All rights reserved. Built with ❤️ for humanity.</p>
      </div>
    </footer>
  );
};

export default Footer;
