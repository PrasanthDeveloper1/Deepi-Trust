import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

let supabase = null;
if (!isDemoMode) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}
export { supabase };

// ─── LOCAL STORAGE DATABASE ────────────────────────────────────────────────────
const DB_KEY = 'deepi_trust_db_v2';

function getDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return initDB();
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ─── Fee Calculator ────────────────────────────────────────────────────────────
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(coord1.lat * Math.PI / 180) *
    Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initDB() {
  const db = {
    users: [
      {
        id: 'admin-001', email: 'admindeepika', password: 'Admin123',
        role: 'admin', name: 'Admin User', phone: '+91 98765 00001',
        created_at: new Date().toISOString()
      },
    ],
    donations: [],
    delivery_requests: [],
    agent_locations: {},
    agent_fees: [],
    admin_qr: null,
    tasks: [],
    payments: [],
    notifications: []
  };
  saveDB(db);
  return db;
}

// ─── LOCAL DB CRUD ────────────────────────────────────────────────────────────

export const localDB = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login(email, password) {
    const db = getDB();
    const user = db.users.find(u => u.email === email && u.password === password);
    if (!user) return { error: 'Invalid email or password' };
    const { password: _, ...safeUser } = user;
    return { data: safeUser };
  },

  signup(userData) {
    const db = getDB();
    if (db.users.find(u => u.email === userData.email)) {
      return { error: 'Email already registered' };
    }
    const newUser = {
      id: `${userData.role}-${Date.now()}`,
      ...userData,
      created_at: new Date().toISOString()
    };
    db.users.push(newUser);
    saveDB(db);
    const { password: _, ...safeUser } = newUser;
    return { data: safeUser };
  },

  getUser(id) {
    const db = getDB();
    const user = db.users.find(u => u.id === id);
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return safeUser;
  },

  getAllUsers() {
    const db = getDB();
    return db.users.map(({ password, ...u }) => u);
  },

  getUsersByRole(role) {
    const db = getDB();
    return db.users.filter(u => u.role === role).map(({ password, ...u }) => u);
  },

  // ── Donations ─────────────────────────────────────────────────────────────
  getDonations() { return getDB().donations; },
  getDonationsByDonor(donorId) { return getDB().donations.filter(d => d.donor_id === donorId); },
  getDonationsByStatus(status) { return getDB().donations.filter(d => d.status === status); },
  getDonationsByAgent(agentId) { return getDB().donations.filter(d => d.agent_id === agentId); },
  getDonationsByCenter(centerId) { return getDB().donations.filter(d => d.center_id === centerId); },

  addDonation(donation) {
    const db = getDB();
    const newDonation = {
      id: `DON-${Date.now().toString().slice(-4)}`,
      status: 'pending',
      ai_score: null, ai_details: null,
      agent_id: null, agent_name: null,
      center_id: null, center_name: null,
      delivery_fee: null, delivery_distance: null,
      pickup_photos: [], drop_photos: [],
      pickup_qty_confirmed: null, drop_qty_confirmed: null,
      pickup_coords: null,
      created_at: new Date().toISOString(),
      ...donation
    };
    db.donations.unshift(newDonation);
    saveDB(db);
    return newDonation;
  },

  updateDonation(id, updates) {
    const db = getDB();
    const idx = db.donations.findIndex(d => d.id === id);
    if (idx === -1) return null;
    db.donations[idx] = { ...db.donations[idx], ...updates };
    saveDB(db);
    return db.donations[idx];
  },

  // ── Delivery Requests ─────────────────────────────────────────────────────
  broadcastDeliveryRequest(donationId, centerId, centerName, centerCoords, pickupCoords, feeAmount, distanceKm) {
    const db = getDB();
    db.delivery_requests = db.delivery_requests.filter(r => r.donation_id !== donationId);
    const request = {
      id: `REQ-${Date.now()}`,
      donation_id: donationId,
      center_id: centerId,
      center_name: centerName,
      center_coords: centerCoords,
      pickup_coords: pickupCoords,
      fee: feeAmount,
      distance_km: distanceKm,
      status: 'open',
      accepted_by: null,
      created_at: new Date().toISOString()
    };
    db.delivery_requests.unshift(request);
    saveDB(db);
    return request;
  },

  getDeliveryRequests() { return getDB().delivery_requests; },
  getOpenRequests() { return getDB().delivery_requests.filter(r => r.status === 'open'); },

  acceptDeliveryRequest(donationId, agentId, agentName) {
    const db = getDB();
    const req = db.delivery_requests.find(r => r.donation_id === donationId && r.status === 'open');
    if (!req) return { error: 'Request already taken or expired' };
    req.status = 'accepted';
    req.accepted_by = agentId;
    const don = db.donations.find(d => d.id === donationId);
    if (don) {
      don.status = 'assigned';
      don.agent_id = agentId;
      don.agent_name = agentName;
      don.assigned_at = new Date().toISOString();
    }
    saveDB(db);
    return { data: req };
  },

  // ── Agent Locations ───────────────────────────────────────────────────────
  updateAgentLocation(agentId, lat, lng) {
    const db = getDB();
    if (!db.agent_locations) db.agent_locations = {};
    db.agent_locations[agentId] = { lat, lng, updated_at: new Date().toISOString() };
    saveDB(db);
  },

  getAgentLocations() { return getDB().agent_locations || {}; },
  getAgentLocation(agentId) { return (getDB().agent_locations || {})[agentId] || null; },

  clearAgentLocation(agentId) {
    const db = getDB();
    if (db.agent_locations?.[agentId]) {
      delete db.agent_locations[agentId];
      saveDB(db);
    }
  },

  // ── Agent Fees ────────────────────────────────────────────────────────────
  getAgentFees() { return getDB().agent_fees || []; },

  addAgentFee(fee) {
    const db = getDB();
    if (!db.agent_fees) db.agent_fees = [];
    const newFee = {
      id: `FEE-${Date.now()}`,
      status: 'pending', // Admin must review photos before marking paid
      created_at: new Date().toISOString(),
      ...fee
    };
    db.agent_fees.unshift(newFee);
    saveDB(db);
    return newFee;
  },

  updateAgentFee(id, updates) {
    const db = getDB();
    if (!db.agent_fees) return null;
    const idx = db.agent_fees.findIndex(f => f.id === id);
    if (idx === -1) return null;
    db.agent_fees[idx] = { ...db.agent_fees[idx], ...updates };
    saveDB(db);
    return db.agent_fees[idx];
  },

  // ── Admin QR Code ─────────────────────────────────────────────────────────
  getAdminQR() { return getDB().admin_qr || null; },

  setAdminQR(dataUrl) {
    const db = getDB();
    db.admin_qr = dataUrl;
    saveDB(db);
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  getPayments() { return getDB().payments; },

  addPayment(payment) {
    const db = getDB();
    const newPayment = {
      id: `TXN-${Date.now().toString().slice(-4)}`,
      status: 'review',
      created_at: new Date().toISOString(),
      ...payment
    };
    db.payments.unshift(newPayment);
    saveDB(db);
    return newPayment;
  },

  updatePayment(id, updates) {
    const db = getDB();
    const idx = db.payments.findIndex(p => p.id === id);
    if (idx === -1) return null;
    db.payments[idx] = { ...db.payments[idx], ...updates };
    saveDB(db);
    return db.payments[idx];
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications(userId) {
    const db = getDB();
    return db.notifications.filter(n => n.user_id === userId || n.role === 'all');
  },

  addNotification(notification) {
    const db = getDB();
    const newNotif = {
      id: `NOTIF-${Date.now()}`,
      read: false,
      created_at: new Date().toISOString(),
      ...notification
    };
    db.notifications.unshift(newNotif);
    saveDB(db);
    return newNotif;
  },

  markNotificationRead(id) {
    const db = getDB();
    const n = db.notifications.find(n => n.id === id);
    if (n) { n.read = true; saveDB(db); }
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  getAnalytics() {
    const db = getDB();
    const totalDonations = db.donations.length;
    const delivered = db.donations.filter(d => d.status === 'delivered').length;
    const pending = db.donations.filter(d => d.status === 'pending').length;
    const approved = db.donations.filter(d => d.status === 'approved').length;
    const dispatched = db.donations.filter(d => d.status === 'dispatched').length;
    const assigned = db.donations.filter(d => ['assigned', 'picked'].includes(d.status)).length;
    const totalFunds = db.payments.filter(p => p.status === 'completed').reduce((s, p) => s + Number(p.amount), 0);
    const pendingFunds = db.payments.filter(p => p.status === 'review').reduce((s, p) => s + Number(p.amount), 0);
    const totalAgentFees = (db.agent_fees || []).filter(f => f.status === 'paid').reduce((s, f) => s + Number(f.fee), 0);
    const activeAgents = db.users.filter(u => u.role === 'agent').length;
    const totalCenters = db.users.filter(u => u.role === 'center').length;
    const totalDonors = db.users.filter(u => u.role === 'donor').length;
    return {
      totalDonations, delivered, pending, approved, dispatched, assigned,
      totalFunds, pendingFunds, totalAgentFees,
      activeAgents, totalCenters, totalDonors
    };
  },

  reset() {
    localStorage.removeItem(DB_KEY);
    return initDB();
  }
};

// ─── SUPABASE DB (Production) ─────────────────────────────────────────────────
// Mirrors localDB API but uses real Supabase. All methods are async.
export const supabaseDB = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data: profile, error: pErr } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single();
    if (pErr) return { error: 'Profile not found — please sign up first' };
    return { data: profile };
  },

  async signup(userData) {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });
    if (error) return { error: error.message };
    const userId = data.user.id;
    const profile = {
      id: userId,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      phone: userData.phone || null,
      address: userData.address || null,
      upi_id: userData.upi_id || null,
      payment_qr: userData.payment_qr || null,
      coords: userData.coords || null,
    };
    const { data: prof, error: profError } = await supabase
      .from('profiles').insert(profile).select().single();
    if (profError) return { error: profError.message };
    return { data: prof };
  },

  async getUser(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    return data;
  },

  async getAllUsers() {
    const { data } = await supabase.from('profiles').select('*');
    return data || [];
  },

  async getUsersByRole(role) {
    const { data } = await supabase.from('profiles').select('*').eq('role', role);
    return data || [];
  },

  // ── Donations ─────────────────────────────────────────────────────────────
  async getDonations() {
    const { data } = await supabase.from('donations').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async getDonationsByDonor(donorId) {
    const { data } = await supabase.from('donations').select('*').eq('donor_id', donorId).order('created_at', { ascending: false });
    return data || [];
  },

  async addDonation(donation) {
    const id = `DON-${Date.now().toString().slice(-6)}`;
    const newDon = {
      id, status: 'pending', ai_score: null, ai_details: null,
      agent_id: null, agent_name: null, center_id: null, center_name: null,
      delivery_fee: null, delivery_distance: null,
      pickup_photos: [], drop_photos: [],
      pickup_qty_confirmed: null, drop_qty_confirmed: null, pickup_coords: null,
      created_at: new Date().toISOString(),
      ...donation
    };
    const { data, error } = await supabase.from('donations').insert(newDon).select().single();
    if (error) throw error;
    return data;
  },

  async updateDonation(id, updates) {
    const { data, error } = await supabase.from('donations').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── Delivery Requests ─────────────────────────────────────────────────────
  async broadcastDeliveryRequest(donationId, centerId, centerName, centerCoords, pickupCoords, feeAmount, distanceKm) {
    await supabase.from('delivery_requests').delete().eq('donation_id', donationId).eq('status', 'open');
    const request = {
      id: `REQ-${Date.now()}`, donation_id: donationId, center_id: centerId,
      center_name: centerName, center_coords: centerCoords, pickup_coords: pickupCoords,
      fee: feeAmount, distance_km: distanceKm, status: 'open', accepted_by: null,
      created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('delivery_requests').insert(request).select().single();
    if (error) throw error;
    return data;
  },

  async getDeliveryRequests() {
    const { data } = await supabase.from('delivery_requests').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async getOpenRequests() {
    const { data } = await supabase.from('delivery_requests').select('*').eq('status', 'open');
    return data || [];
  },

  async acceptDeliveryRequest(donationId, agentId, agentName) {
    const { data: req } = await supabase.from('delivery_requests')
      .select('*').eq('donation_id', donationId).eq('status', 'open').single();
    if (!req) return { error: 'Request already taken or expired' };
    await supabase.from('delivery_requests')
      .update({ status: 'accepted', accepted_by: agentId }).eq('id', req.id);
    await supabase.from('donations').update({
      status: 'assigned', agent_id: agentId, agent_name: agentName,
      assigned_at: new Date().toISOString()
    }).eq('id', donationId);
    return { data: req };
  },

  // ── Agent Locations ───────────────────────────────────────────────────────
  async updateAgentLocation(agentId, lat, lng) {
    await supabase.from('agent_locations').upsert({ agent_id: agentId, lat, lng, updated_at: new Date().toISOString() });
  },

  async getAgentLocations() {
    const { data } = await supabase.from('agent_locations').select('*');
    const locs = {};
    (data || []).forEach(l => { locs[l.agent_id] = { lat: l.lat, lng: l.lng, updated_at: l.updated_at }; });
    return locs;
  },

  async getAgentLocation(agentId) {
    const { data } = await supabase.from('agent_locations').select('*').eq('agent_id', agentId).single();
    return data || null;
  },

  async clearAgentLocation(agentId) {
    await supabase.from('agent_locations').delete().eq('agent_id', agentId);
  },

  // ── Agent Fees ────────────────────────────────────────────────────────────
  async getAgentFees() {
    const { data } = await supabase.from('agent_fees').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async addAgentFee(fee) {
    const newFee = {
      id: `FEE-${Date.now()}`,
      status: 'pending', // Admin reviews photos first before paying
      created_at: new Date().toISOString(),
      ...fee
    };
    const { data, error } = await supabase.from('agent_fees').insert(newFee).select().single();
    if (error) throw error;
    return data;
  },

  async updateAgentFee(id, updates) {
    const { data, error } = await supabase.from('agent_fees').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── Admin QR ──────────────────────────────────────────────────────────────
  async getAdminQR() {
    const { data } = await supabase.from('admin_settings').select('value').eq('key', 'admin_qr').single();
    return data?.value || null;
  },

  async setAdminQR(dataUrl) {
    await supabase.from('admin_settings').upsert({ key: 'admin_qr', value: dataUrl });
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  async getPayments() {
    const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
    return data || [];
  },

  async addPayment(payment) {
    const newPayment = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      status: 'review', created_at: new Date().toISOString(), ...payment
    };
    const { data, error } = await supabase.from('payments').insert(newPayment).select().single();
    if (error) throw error;
    return data;
  },

  async updatePayment(id, updates) {
    const { data, error } = await supabase.from('payments').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(userId) {
    const { data } = await supabase.from('notifications').select('*')
      .or(`user_id.eq.${userId},role.eq.all`)
      .order('created_at', { ascending: false }).limit(50);
    return data || [];
  },

  async addNotification(notification) {
    const newNotif = {
      id: `NOTIF-${Date.now()}`, read: false,
      created_at: new Date().toISOString(), ...notification
    };
    await supabase.from('notifications').insert(newNotif);
    return newNotif;
  },

  async markNotificationRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  async getAnalytics() {
    const [donRes, payRes, feeRes, usrRes] = await Promise.all([
      supabase.from('donations').select('status'),
      supabase.from('payments').select('status, amount'),
      supabase.from('agent_fees').select('status, fee'),
      supabase.from('profiles').select('role'),
    ]);
    const d = donRes.data || [], p = payRes.data || [];
    const f = feeRes.data || [], u = usrRes.data || [];
    return {
      totalDonations: d.length,
      delivered: d.filter(x => x.status === 'delivered').length,
      pending: d.filter(x => x.status === 'pending').length,
      approved: d.filter(x => x.status === 'approved').length,
      dispatched: d.filter(x => x.status === 'dispatched').length,
      assigned: d.filter(x => ['assigned', 'picked'].includes(x.status)).length,
      totalFunds: p.filter(x => x.status === 'completed').reduce((s, x) => s + Number(x.amount), 0),
      pendingFunds: p.filter(x => x.status === 'review').reduce((s, x) => s + Number(x.amount), 0),
      totalAgentFees: f.filter(x => x.status === 'paid').reduce((s, x) => s + Number(x.fee), 0),
      activeAgents: u.filter(x => x.role === 'agent').length,
      totalCenters: u.filter(x => x.role === 'center').length,
      totalDonors: u.filter(x => x.role === 'donor').length,
    };
  },

  async reset() {
    console.warn('DB reset not supported in Supabase mode');
  }
};

// ─── UNIFIED DB EXPORT ────────────────────────────────────────────────────────
// Use this everywhere instead of localDB directly.
// In demo mode → synchronous localStorage; in production → async Supabase.
export const db = isDemoMode ? localDB : supabaseDB;
