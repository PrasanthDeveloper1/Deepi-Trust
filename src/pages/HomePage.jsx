import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Truck, ShieldCheck, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';

const HERO_IMG = 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1920&q=80';
const CAMPAIGN_IMGS = [
  {
    img: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?w=800&q=80',
    title: 'Feed the Elderly',
    desc: 'Providing nutritious daily meals to senior citizens across old age homes in Tamil Nadu.',
    raised: '₹2,40,000', goal: '₹5,00,000'
  },
  {
    img: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&q=80',
    title: 'Orphanage Nutrition Drive',
    desc: 'Ensuring balanced, healthy meals for children growing up in orphanages across Chennai.',
    raised: '₹1,80,000', goal: '₹3,00,000'
  },
  {
    img: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&q=80',
    title: 'Community Kitchen Fund',
    desc: 'Supporting neighbourhood community kitchens that serve fresh food to migrant workers daily.',
    raised: '₹95,000', goal: '₹2,00,000'
  }
];

const HomePage = () => {
  const { user } = useAuth();
  const { donations, payments, analytics } = useAppContext();
  const donateLink = user ? '/donor' : '/login';

  // Dynamic real-time stats from actual platform data
  const deliveredCount = donations?.filter(d => d.status === 'received' || d.status === 'delivered').length || 0;
  const totalDonations = donations?.length || 0;
  const totalFundsRaised = payments?.filter(p => p.status === 'completed').reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const activeAgents = analytics?.activeAgents || 0;
  const partnerCenters = analytics?.totalCenters || 0;

  const formatFunds = (amount) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${HERO_IMG})` }} />
        <div className="hero-content">
          <h1 className="animate-in">No Food<br/>Should Go<br/>To Waste</h1>
          <p className="animate-in delay-1">
            Every day, tonnes of excess food is wasted while millions go hungry.
            Deepi Trust and Donations connects generous donors with communities in need through AI-powered
            quality checks and real-time delivery tracking.
          </p>
          <Link to={donateLink} className="hero-cta animate-in delay-2">
            {user ? 'Go to Dashboard' : 'Donate Now. Save Lives.'} &nbsp;»
          </Link>
        </div>
        <div className="hero-progress">
          <div className="hero-progress-bar active"><div className="fill"></div></div>
          <div className="hero-progress-bar"><div className="fill"></div></div>
          <div className="hero-progress-bar"><div className="fill"></div></div>
        </div>
      </section>

      {/* STATS — Dynamic real-time data */}
      <section className="section section-alt">
        <div className="stats-bar">
          <div className="stat-item animate-in">
            <div className="stat-number">{totalDonations > 0 ? totalDonations : '—'}</div>
            <div className="stat-label">Total Donations</div>
          </div>
          <div className="stat-item animate-in delay-1">
            <div className="stat-number">{deliveredCount > 0 ? deliveredCount : '—'}</div>
            <div className="stat-label">Meals Delivered</div>
          </div>
          <div className="stat-item animate-in delay-2">
            <div className="stat-number">{partnerCenters > 0 ? partnerCenters : '—'}</div>
            <div className="stat-label">Partner Centers</div>
          </div>
          <div className="stat-item animate-in delay-3">
            <div className="stat-number">{totalFundsRaised > 0 ? formatFunds(totalFundsRaised) : '—'}</div>
            <div className="stat-label">Funds Raised</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <h2 className="section-title">How It Works</h2>
        <p className="section-subtitle">
          A seamless, transparent pipeline from donor to doorstep — powered by AI and driven by volunteers.
        </p>
        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            { icon: <Heart size={28} />, step: '01', title: 'Donor Submits Food', desc: 'Submit excess food details with photos for AI verification.' },
            { icon: <ShieldCheck size={28} />, step: '02', title: 'AI Quality Check', desc: 'Our AI engine scans photos to grade freshness and safety.' },
            { icon: <Truck size={28} />, step: '03', title: 'Pickup & Delivery', desc: 'Assigned agents verify quantity at pickup and deliver safely.' },
            { icon: <Users size={28} />, step: '04', title: 'Feed Communities', desc: 'Food reaches old age homes, orphanages & community centres.' }
          ].map((item, i) => (
            <div key={i} className="card" style={{ border: 'none', textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--bg-section)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(45,106,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--primary)' }}>
                {item.icon}
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '0.5rem' }}>STEP {item.step}</div>
              <h3 style={{ marginBottom: '0.5rem' }}>{item.title}</h3>
              <p style={{ color: 'var(--text-body)', fontSize: '0.9rem', lineHeight: '1.5' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CURRENT CAMPAIGNS */}
      <section className="section section-alt">
        <h2 className="section-title">Current Campaigns</h2>
        <p className="section-subtitle">Support our active initiatives and help us reach more people in need.</p>
        <div className="cards-grid">
          {CAMPAIGN_IMGS.map((c, i) => (
            <div key={i} className="card animate-in" style={{ animationDelay: `${i * 0.15}s` }}>
              <img src={c.img} alt={c.title} className="card-img" loading="lazy" />
              <div className="card-body">
                <h3>{c.title}</h3>
                <p>{c.desc}</p>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Raised</div>
                    <div style={{ fontWeight: '700', color: 'var(--primary)' }}>{c.raised}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Goal</div>
                    <div style={{ fontWeight: '600' }}>{c.goal}</div>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', background: 'var(--surface-border)', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ width: `${(parseInt(c.raised.replace(/[^0-9]/g, '')) / parseInt(c.goal.replace(/[^0-9]/g, ''))) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '100px' }} />
                </div>
                <Link to="/crowdfunding" className="btn btn-accent btn-block" style={{ marginTop: '1rem' }}>
                  Support This <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="section section-dark" style={{ textAlign: 'center' }}>
        <h2 className="section-title" style={{ color: '#fff', maxWidth: '700px', margin: '0 auto 1rem' }}>
          Have Excess Food? Don't Waste It.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
          It takes just 2 minutes to submit a donation. Our volunteers will handle the rest.
        </p>
        <Link to={user ? '/donor' : '/signup'} className="hero-cta" style={{ display: 'inline-flex' }}>
          {user ? 'Submit Donation' : 'Get Started'} <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
};

export default HomePage;
