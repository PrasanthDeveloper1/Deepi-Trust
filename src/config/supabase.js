import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Force localStorage mode — no external database dependency
export const isDemoMode = true;

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
let supabase = null;
if (!isDemoMode) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  });
}
export { supabase };

// ─── SESSION PERSISTENCE (bypasses gotrue-js Web Locks) ───────────────────────
const SESSION_KEY = 'deepi-trust-session';
export function saveSession(session) {
  if (session?.access_token) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }));
  }
}
export function loadSession() {
  try { const s = localStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; }
  catch { return null; }
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ─── DIRECT AUTH via fetch (bypasses gotrue-js Web Locks completely) ──────────
async function directSignIn(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Login failed');
  return data;
}

async function directSignUp(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Signup failed');
  return data;
}

async function setSupabaseSession(access_token, refresh_token) {
  if (supabase) await supabase.auth.setSession({ access_token, refresh_token });
}

// ─── FEE CALCULATOR ──────────────────────────────────────────────────────────
export function calculateDeliveryFee(distanceKm) {
  const d = parseFloat(distanceKm) || 3;
  let base, perKm;
  if (d <= 4)      { base = 30; perKm = 10; }
  else if (d <= 6) { base = 40; perKm = 15; }
  else             { base = 50; perKm = 12; }
  return Math.round(base + d * perKm);
}

export function getDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── LOCAL STORAGE DATABASE ───────────────────────────────────────────────────
const DB_KEY = 'deepi_trust_db_v2';

function getDB() {
  try { const raw = localStorage.getItem(DB_KEY); if (raw) return JSON.parse(raw); }
  catch { /* ignore */ }
  return initDB();
}
function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function initDB() {
  const db = {
    users: [
      { id: 'admin-001', email: 'admindeepika@gmail.com', password: 'Admin123',
        role: 'admin', name: 'Admin User', phone: '+91 98765 00001', created_at: new Date().toISOString() },
    ],
    donations: [], delivery_requests: [], agent_locations: {},
    agent_fees: [], admin_qr: null, tasks: [], payments: [], notifications: []
  };
  saveDB(db);
  return db;
}

export const localDB = {
  login(email, password) {
    const db = getDB();
    let user = db.users.find(u => u.email === email && u.password === password);
    if (!user && email === 'admindeepika@gmail.com' && password === 'Admin123') {
      user = { id: 'admin-001', email, password, role: 'admin', name: 'Admin User', phone: '+91 98765 00001', created_at: new Date().toISOString() };
      db.users.push(user);
      saveDB(db);
    }
    if (!user) return { error: 'Invalid email or password' };
    const { password: _, ...safe } = user;
    return { data: safe };
  },
  signup(userData) {
    const db = getDB();
    if (db.users.find(u => u.email === userData.email)) return { error: 'Email already registered' };
    const user = { id: `usr-${Date.now()}`, created_at: new Date().toISOString(), ...userData };
    db.users.push(user);
    saveDB(db);
    const { password: _, ...safe } = user;
    return { data: safe };
  },
  getUser(id) { return getDB().users.find(u => u.id === id) || null; },
  updateUser(id, updates) { const db = getDB(); const i = db.users.findIndex(u => u.id === id); if (i < 0) return null; db.users[i] = { ...db.users[i], ...updates }; saveDB(db); return db.users[i]; },
  getAllUsers() { return getDB().users; },
  getUsersByRole(role) { return getDB().users.filter(u => u.role === role); },
  addDonation(donation) { const db = getDB(); const d = { id: `DON-${Date.now().toString().slice(-6)}`, status: 'pending', created_at: new Date().toISOString(), ...donation }; db.donations.push(d); saveDB(db); return d; },
  updateDonation(id, updates) { const db = getDB(); const i = db.donations.findIndex(d => d.id === id); if (i < 0) return null; db.donations[i] = { ...db.donations[i], ...updates }; saveDB(db); return db.donations[i]; },
  getDonations() { return getDB().donations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
  getDonationsByDonor(donorId) { return getDB().donations.filter(d => d.donor_id === donorId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
  broadcastDeliveryRequest(donationId, centerId, centerName, centerCoords, pickupCoords, feeAmount, distanceKm) { const db = getDB(); const r = { id: `REQ-${Date.now()}`, donation_id: donationId, center_id: centerId, center_name: centerName, center_coords: centerCoords, pickup_coords: pickupCoords, fee: feeAmount, distance_km: distanceKm, status: 'open', accepted_by: null, created_at: new Date().toISOString() }; db.delivery_requests.push(r); saveDB(db); return r; },
  getDeliveryRequests() { return getDB().delivery_requests; },
  getOpenRequests() { return getDB().delivery_requests.filter(r => r.status === 'open'); },
  acceptDeliveryRequest(donationId, agentId, agentName) { const db = getDB(); const r = db.delivery_requests.find(x => x.donation_id === donationId && x.status === 'open'); if (!r) return { error: 'Request already taken' }; r.status = 'accepted'; r.accepted_by = agentId; const d = db.donations.find(x => x.id === donationId); if (d) { d.agent_id = agentId; d.agent_name = agentName; d.status = 'assigned'; } saveDB(db); return { data: r }; },
  updateAgentLocation(agentId, lat, lng) { const db = getDB(); db.agent_locations[agentId] = { lat, lng, updated_at: new Date().toISOString() }; saveDB(db); },
  getAgentLocations() { return getDB().agent_locations || {}; },
  getAgentLocation(agentId) { return (getDB().agent_locations || {})[agentId] || null; },
  clearAgentLocation(agentId) { const db = getDB(); delete db.agent_locations[agentId]; saveDB(db); },
  getAgentFees() { return getDB().agent_fees || []; },
  addAgentFee(fee) { const db = getDB(); const f = { id: `FEE-${Date.now()}`, status: 'pending', created_at: new Date().toISOString(), ...fee }; db.agent_fees.push(f); saveDB(db); return f; },
  updateAgentFee(id, updates) { const db = getDB(); const i = db.agent_fees.findIndex(f => f.id === id); if (i < 0) return null; db.agent_fees[i] = { ...db.agent_fees[i], ...updates }; saveDB(db); return db.agent_fees[i]; },
  getAdminQR() { return getDB().admin_qr || null; },
  setAdminQR(dataUrl) { const db = getDB(); db.admin_qr = dataUrl; saveDB(db); },
  getPayments() { return getDB().payments || []; },
  addPayment(payment) { const db = getDB(); const p = { id: `TXN-${Date.now().toString().slice(-6)}`, status: 'review', created_at: new Date().toISOString(), ...payment }; db.payments.push(p); saveDB(db); return p; },
  updatePayment(id, updates) { const db = getDB(); const i = db.payments.findIndex(p => p.id === id); if (i < 0) return null; db.payments[i] = { ...db.payments[i], ...updates }; saveDB(db); return db.payments[i]; },
  getNotifications(userId) { return (getDB().notifications || []).filter(n => n.user_id === userId || n.role === 'all'); },
  addNotification(notification) { const db = getDB(); const n = { id: `NOTIF-${Date.now()}`, read: false, created_at: new Date().toISOString(), ...notification }; db.notifications.unshift(n); saveDB(db); return n; },
  markNotificationRead(id) { const db = getDB(); const n = db.notifications.find(x => x.id === id); if (n) { n.read = true; saveDB(db); } },
  getAnalytics() { const db = getDB(); return { totalDonations: db.donations.length, delivered: db.donations.filter(d => d.status === 'delivered').length, pending: db.donations.filter(d => d.status === 'pending').length, approved: db.donations.filter(d => d.status === 'approved').length, dispatched: db.donations.filter(d => d.status === 'dispatched').length, assigned: db.donations.filter(d => ['assigned','picked'].includes(d.status)).length, totalFunds: db.payments.filter(p => p.status === 'completed').reduce((s,p) => s+Number(p.amount),0), pendingFunds: db.payments.filter(p => p.status === 'review').reduce((s,p) => s+Number(p.amount),0), totalAgentFees: (db.agent_fees||[]).filter(f => f.status === 'paid').reduce((s,f) => s+Number(f.fee),0), activeAgents: db.users.filter(u => u.role === 'agent').length, totalCenters: db.users.filter(u => u.role === 'center').length, totalDonors: db.users.filter(u => u.role === 'donor').length }; },
  reset() { localStorage.removeItem(DB_KEY); return initDB(); }
};

// ─── SUPABASE DB (Production) ─────────────────────────────────────────────────
export const supabaseDB = {
  async login(email, password) {
    try {
      const authData = await directSignIn(email, password);
      saveSession(authData);
      await setSupabaseSession(authData.access_token, authData.refresh_token);
      return this._ensureProfile(authData.user, { name: email.split('@')[0], role: 'donor', email });
    } catch (e) { return { error: e.message }; }
  },

  async _ensureProfile(user, defaults) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) return { data: profile };
    const p = { id: user.id, email: defaults.email || user.email, name: defaults.name || user.email.split('@')[0], role: defaults.role || 'donor', phone: defaults.phone || null, address: defaults.address || null, upi_id: defaults.upi_id || null, payment_qr: defaults.payment_qr || null, coords: defaults.coords || null };
    const { data: created, error } = await supabase.from('profiles').insert(p).select().single();
    if (error) return { error: error.message };
    return { data: created };
  },

  async signup(userData) {
    try {
      const authData = await directSignUp(userData.email, userData.password);
      if (!authData.user) return { error: 'Signup failed' };
      if (authData.access_token) {
        saveSession(authData);
        await setSupabaseSession(authData.access_token, authData.refresh_token);
      }
      const { data: existing } = await supabase.from('profiles').select('*').eq('id', authData.user.id).maybeSingle();
      if (existing) return { data: existing };
      const p = { id: authData.user.id, email: userData.email, name: userData.name, role: userData.role, phone: userData.phone || null, address: userData.address || null, upi_id: userData.upi_id || null, payment_qr: userData.payment_qr || null, coords: userData.coords || null };
      const { data: prof, error } = await supabase.from('profiles').insert(p).select().single();
      if (error) return { error: error.message };
      return { data: prof };
    } catch (e) { return { error: e.message }; }
  },

  async getUser(id) { const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle(); return data; },
  async getAllUsers() { const { data } = await supabase.from('profiles').select('*'); return data || []; },
  async getUsersByRole(role) { const { data } = await supabase.from('profiles').select('*').eq('role', role); return data || []; },
  async getDonations() { const { data } = await supabase.from('donations').select('*').order('created_at', { ascending: false }); return data || []; },
  async getDonationsByDonor(donorId) { const { data } = await supabase.from('donations').select('*').eq('donor_id', donorId).order('created_at', { ascending: false }); return data || []; },

  async addDonation(donation) {
    const newDon = { id: `DON-${Date.now().toString().slice(-6)}`, status: 'pending', ai_score: null, ai_details: null, agent_id: null, agent_name: null, center_id: null, center_name: null, delivery_fee: null, delivery_distance: null, pickup_photos: [], drop_photos: [], pickup_qty_confirmed: null, drop_qty_confirmed: null, pickup_coords: null, created_at: new Date().toISOString(), ...donation };
    const { data, error } = await supabase.from('donations').insert(newDon).select().single();
    if (error) throw error;
    return data;
  },
  async updateDonation(id, updates) { const { data, error } = await supabase.from('donations').update(updates).eq('id', id).select().single(); if (error) throw error; return data; },

  async broadcastDeliveryRequest(donationId, centerId, centerName, centerCoords, pickupCoords, feeAmount, distanceKm) {
    await supabase.from('delivery_requests').delete().eq('donation_id', donationId).eq('status', 'open');
    const r = { id: `REQ-${Date.now()}`, donation_id: donationId, center_id: centerId, center_name: centerName, center_coords: centerCoords, pickup_coords: pickupCoords, fee: feeAmount, distance_km: distanceKm, status: 'open', accepted_by: null, created_at: new Date().toISOString() };
    const { data, error } = await supabase.from('delivery_requests').insert(r).select().single();
    if (error) throw error;
    return data;
  },
  async getDeliveryRequests() { const { data } = await supabase.from('delivery_requests').select('*').order('created_at', { ascending: false }); return data || []; },
  async getOpenRequests() { const { data } = await supabase.from('delivery_requests').select('*').eq('status', 'open'); return data || []; },

  async acceptDeliveryRequest(donationId, agentId, agentName) {
    const { data: req } = await supabase.from('delivery_requests').select('*').eq('donation_id', donationId).eq('status', 'open').maybeSingle();
    if (!req) return { error: 'Request already taken or expired' };
    await supabase.from('delivery_requests').update({ status: 'accepted', accepted_by: agentId }).eq('id', req.id);
    await supabase.from('donations').update({ status: 'assigned', agent_id: agentId, agent_name: agentName, assigned_at: new Date().toISOString() }).eq('id', donationId);
    return { data: req };
  },

  async updateAgentLocation(agentId, lat, lng) { await supabase.from('agent_locations').upsert({ agent_id: agentId, lat, lng, updated_at: new Date().toISOString() }); },
  async getAgentLocations() { const { data } = await supabase.from('agent_locations').select('*'); const locs = {}; (data || []).forEach(l => { locs[l.agent_id] = { lat: l.lat, lng: l.lng, updated_at: l.updated_at }; }); return locs; },
  async getAgentLocation(agentId) { const { data } = await supabase.from('agent_locations').select('*').eq('agent_id', agentId).maybeSingle(); return data || null; },
  async clearAgentLocation(agentId) { await supabase.from('agent_locations').delete().eq('agent_id', agentId); },
  async getAgentFees() { const { data } = await supabase.from('agent_fees').select('*').order('created_at', { ascending: false }); return data || []; },
  async addAgentFee(fee) { const f = { id: `FEE-${Date.now()}`, status: 'pending', created_at: new Date().toISOString(), ...fee }; const { data, error } = await supabase.from('agent_fees').insert(f).select().single(); if (error) throw error; return data; },
  async updateAgentFee(id, updates) { const { data, error } = await supabase.from('agent_fees').update(updates).eq('id', id).select().single(); if (error) throw error; return data; },
  async getAdminQR() { const { data } = await supabase.from('admin_settings').select('value').eq('key', 'admin_qr').maybeSingle(); return data?.value || null; },
  async setAdminQR(dataUrl) { await supabase.from('admin_settings').upsert({ key: 'admin_qr', value: dataUrl }); },
  async getPayments() { const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false }); return data || []; },
  async addPayment(payment) { const p = { id: `TXN-${Date.now().toString().slice(-6)}`, status: 'review', created_at: new Date().toISOString(), ...payment }; const { data, error } = await supabase.from('payments').insert(p).select().single(); if (error) throw error; return data; },
  async updatePayment(id, updates) { const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single(); if (error) throw error; return data; },
  async getNotifications(userId) { const { data } = await supabase.from('notifications').select('*').or(`user_id.eq.${userId},role.eq.all`).order('created_at', { ascending: false }).limit(50); return data || []; },
  async addNotification(notification) { const n = { id: `NOTIF-${Date.now()}`, read: false, created_at: new Date().toISOString(), ...notification }; await supabase.from('notifications').insert(n); return n; },
  async markNotificationRead(id) { await supabase.from('notifications').update({ read: true }).eq('id', id); },

  async getAnalytics() {
    const [donRes, payRes, feeRes, usrRes] = await Promise.all([
      supabase.from('donations').select('status'),
      supabase.from('payments').select('status, amount'),
      supabase.from('agent_fees').select('status, fee'),
      supabase.from('profiles').select('role'),
    ]);
    const d = donRes.data || [], p = payRes.data || [], f = feeRes.data || [], u = usrRes.data || [];
    return { totalDonations: d.length, delivered: d.filter(x => x.status === 'delivered').length, pending: d.filter(x => x.status === 'pending').length, approved: d.filter(x => x.status === 'approved').length, dispatched: d.filter(x => x.status === 'dispatched').length, assigned: d.filter(x => ['assigned','picked'].includes(x.status)).length, totalFunds: p.filter(x => x.status === 'completed').reduce((s,x) => s+Number(x.amount),0), pendingFunds: p.filter(x => x.status === 'review').reduce((s,x) => s+Number(x.amount),0), totalAgentFees: f.filter(x => x.status === 'paid').reduce((s,x) => s+Number(x.fee),0), activeAgents: u.filter(x => x.role === 'agent').length, totalCenters: u.filter(x => x.role === 'center').length, totalDonors: u.filter(x => x.role === 'donor').length };
  },
  async reset() { console.warn('DB reset not supported in Supabase mode'); }
};

// ─── UNIFIED DB EXPORT ────────────────────────────────────────────────────────
export const db = isDemoMode ? localDB : supabaseDB;
