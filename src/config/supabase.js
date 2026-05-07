// ─── Deepi Trust Database Client ──────────────────────────────────────────────
// All data stored on Vercel server — synced across ALL devices.
// No Supabase, no localStorage dependency.

export const isDemoMode = false;
export const supabase = null;

// ─── API HELPER ───────────────────────────────────────────────────────────────
const API_URL = '/api/data';

async function api(action, payload = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
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

// ─── SERVER DATABASE (synced across all devices) ─────────────────────────────
export const db = {
  // ── Auth ──
  async login(email, password) {
    return api('login', { email, password });
  },

  async signup(userData) {
    return api('signup', userData);
  },

  async getUser(id) {
    const r = await api('getUser', { id });
    return r.data;
  },

  async updateUser(id, updates) {
    const r = await api('updateUser', { id, updates });
    return r.data;
  },

  async getAllUsers() {
    const r = await api('getAllUsers');
    return r.data || [];
  },

  async getUsersByRole(role) {
    const r = await api('getUsersByRole', { role });
    return r.data || [];
  },

  // ── Donations ──
  async getDonations() {
    const r = await api('getDonations');
    return r.data || [];
  },

  async getDonationsByDonor(donorId) {
    const r = await api('getDonationsByDonor', { donorId });
    return r.data || [];
  },

  async addDonation(donation) {
    const r = await api('addDonation', donation);
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  async updateDonation(id, updates) {
    const r = await api('updateDonation', { id, updates });
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  // ── Delivery Requests ──
  async broadcastDeliveryRequest(donationId, centerId, centerName, centerCoords, pickupCoords, feeAmount, distanceKm) {
    const r = await api('broadcastDeliveryRequest', {
      donation_id: donationId, center_id: centerId, center_name: centerName,
      center_coords: centerCoords, pickup_coords: pickupCoords,
      fee: feeAmount, distance_km: distanceKm
    });
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  async getDeliveryRequests() {
    const r = await api('getDeliveryRequests');
    return r.data || [];
  },

  async getOpenRequests() {
    const r = await api('getOpenRequests');
    return r.data || [];
  },

  async acceptDeliveryRequest(donationId, agentId, agentName) {
    return api('acceptDeliveryRequest', { donationId, agentId, agentName });
  },

  // ── Agent Locations ──
  async updateAgentLocation(agentId, lat, lng) {
    await api('updateAgentLocation', { agentId, lat, lng });
  },

  async getAgentLocations() {
    const r = await api('getAgentLocations');
    return r.data || {};
  },

  async getAgentLocation(agentId) {
    const r = await api('getAgentLocation', { agentId });
    return r.data;
  },

  async clearAgentLocation(agentId) {
    await api('clearAgentLocation', { agentId });
  },

  // ── Agent Fees ──
  async getAgentFees() {
    const r = await api('getAgentFees');
    return r.data || [];
  },

  async addAgentFee(fee) {
    const r = await api('addAgentFee', fee);
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  async updateAgentFee(id, updates) {
    const r = await api('updateAgentFee', { id, updates });
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  // ── Admin QR ──
  async getAdminQR() {
    const r = await api('getAdminQR');
    return r.data;
  },

  async setAdminQR(dataUrl) {
    await api('setAdminQR', { dataUrl });
  },

  // ── Payments ──
  async getPayments() {
    const r = await api('getPayments');
    return r.data || [];
  },

  async addPayment(payment) {
    const r = await api('addPayment', payment);
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  async updatePayment(id, updates) {
    const r = await api('updatePayment', { id, updates });
    if (r.error) throw new Error(r.error);
    return r.data;
  },

  // ── Notifications ──
  async getNotifications(userId) {
    const r = await api('getNotifications', { userId });
    return r.data || [];
  },

  async addNotification(notification) {
    const r = await api('addNotification', notification);
    return r.data;
  },

  async markNotificationRead(id) {
    await api('markNotificationRead', { id });
  },

  // ── Analytics ──
  async getAnalytics() {
    const r = await api('getAnalytics');
    return r.data || {};
  },

  async reset() {
    console.warn('Reset not supported');
  }
};

// Legacy exports for compatibility
export const localDB = db;
export const supabaseDB = db;
