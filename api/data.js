// ─── Deepi Trust Server-Side Database ─────────────────────────────────────────
// All data stored in-memory on the server. Syncs across ALL devices.
// Resets to defaults only on cold start (after ~15 min of inactivity).

let store = {
  users: [
    {
      id: 'admin-001',
      email: 'admindeepika@gmail.com',
      password: 'Admin123',
      role: 'admin',
      name: 'Admin User',
      phone: '+91 98765 00001',
      address: 'Deepi Trust HQ, Chennai',
      created_at: new Date().toISOString()
    }
  ],
  donations: [],
  delivery_requests: [],
  agent_locations: {},
  agent_fees: [],
  admin_qr: null,
  payments: [],
  notifications: []
};

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ─── Request Handler ──────────────────────────────────────────────────────────
export default function handler(req, res) {
  // CORS headers for cross-device access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { action, payload } = req.body || {};
    const result = processAction(action, payload || {});
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function processAction(action, p) {
  switch (action) {

    // ── Auth ──────────────────────────────────────────────────────────────
    case 'login': {
      const user = store.users.find(u => u.email === p.email && u.password === p.password);
      if (!user) return { error: 'Invalid email or password' };
      const { password, ...safe } = user;
      return { data: safe };
    }

    case 'signup': {
      if (store.users.find(u => u.email === p.email))
        return { error: 'Email already registered. Please sign in.' };
      const user = {
        id: uuid(), email: p.email, password: p.password, name: p.name,
        role: p.role, phone: p.phone || null, address: p.address || null,
        upi_id: p.upi_id || null, payment_qr: p.payment_qr || null,
        coords: p.coords || null, created_at: new Date().toISOString()
      };
      store.users.push(user);
      const { password, ...safe } = user;
      return { data: safe };
    }

    case 'getUser': {
      const u = store.users.find(u => u.id === p.id);
      if (!u) return { data: null };
      const { password, ...safe } = u;
      return { data: safe };
    }

    case 'updateUser': {
      const i = store.users.findIndex(u => u.id === p.id);
      if (i < 0) return { data: null };
      store.users[i] = { ...store.users[i], ...p.updates };
      const { password, ...safe } = store.users[i];
      return { data: safe };
    }

    case 'getAllUsers': {
      return { data: store.users.map(({ password, ...u }) => u) };
    }

    case 'getUsersByRole': {
      return { data: store.users.filter(u => u.role === p.role).map(({ password, ...u }) => u) };
    }

    // ── Donations ────────────────────────────────────────────────────────
    case 'getDonations': {
      return { data: [...store.donations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    case 'getDonationsByDonor': {
      return { data: store.donations.filter(d => d.donor_id === p.donorId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    case 'addDonation': {
      const don = {
        id: `DON-${Date.now().toString().slice(-6)}`, status: 'pending',
        ai_score: null, ai_details: null, agent_id: null, agent_name: null,
        center_id: null, center_name: null, delivery_fee: null, delivery_distance: null,
        pickup_photos: [], drop_photos: [], pickup_qty_confirmed: null,
        drop_qty_confirmed: null, pickup_coords: null,
        created_at: new Date().toISOString(), ...p
      };
      store.donations.push(don);
      return { data: don };
    }

    case 'updateDonation': {
      const i = store.donations.findIndex(d => d.id === p.id);
      if (i < 0) return { error: 'Donation not found' };
      store.donations[i] = { ...store.donations[i], ...p.updates };
      return { data: store.donations[i] };
    }

    // ── Delivery Requests ────────────────────────────────────────────────
    case 'broadcastDeliveryRequest': {
      store.delivery_requests = store.delivery_requests.filter(
        r => !(r.donation_id === p.donation_id && r.status === 'open')
      );
      const req = {
        id: `REQ-${Date.now()}`, status: 'open', accepted_by: null,
        created_at: new Date().toISOString(), ...p
      };
      store.delivery_requests.push(req);
      return { data: req };
    }

    case 'getDeliveryRequests': {
      return { data: store.delivery_requests };
    }

    case 'getOpenRequests': {
      return { data: store.delivery_requests.filter(r => r.status === 'open') };
    }

    case 'acceptDeliveryRequest': {
      const r = store.delivery_requests.find(x => x.donation_id === p.donationId && x.status === 'open');
      if (!r) return { error: 'Request already taken or expired' };
      r.status = 'accepted';
      r.accepted_by = p.agentId;
      const d = store.donations.find(x => x.id === p.donationId);
      if (d) {
        d.agent_id = p.agentId;
        d.agent_name = p.agentName;
        d.status = 'assigned';
        d.assigned_at = new Date().toISOString();
      }
      return { data: r };
    }

    // ── Agent Locations ──────────────────────────────────────────────────
    case 'updateAgentLocation': {
      store.agent_locations[p.agentId] = { lat: p.lat, lng: p.lng, updated_at: new Date().toISOString() };
      return { data: true };
    }

    case 'getAgentLocations': {
      return { data: store.agent_locations };
    }

    case 'getAgentLocation': {
      return { data: store.agent_locations[p.agentId] || null };
    }

    case 'clearAgentLocation': {
      delete store.agent_locations[p.agentId];
      return { data: true };
    }

    // ── Agent Fees ───────────────────────────────────────────────────────
    case 'getAgentFees': {
      return { data: store.agent_fees.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    case 'addAgentFee': {
      const fee = { id: `FEE-${Date.now()}`, status: 'pending', created_at: new Date().toISOString(), ...p };
      store.agent_fees.push(fee);
      return { data: fee };
    }

    case 'updateAgentFee': {
      const i = store.agent_fees.findIndex(f => f.id === p.id);
      if (i < 0) return { error: 'Fee not found' };
      store.agent_fees[i] = { ...store.agent_fees[i], ...p.updates };
      return { data: store.agent_fees[i] };
    }

    // ── Admin QR ─────────────────────────────────────────────────────────
    case 'getAdminQR': {
      return { data: store.admin_qr };
    }

    case 'setAdminQR': {
      store.admin_qr = p.dataUrl;
      return { data: true };
    }

    // ── Payments ─────────────────────────────────────────────────────────
    case 'getPayments': {
      return { data: store.payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    case 'addPayment': {
      const pay = { id: `TXN-${Date.now().toString().slice(-6)}`, status: 'review', created_at: new Date().toISOString(), ...p };
      store.payments.push(pay);
      return { data: pay };
    }

    case 'updatePayment': {
      const i = store.payments.findIndex(x => x.id === p.id);
      if (i < 0) return { error: 'Payment not found' };
      store.payments[i] = { ...store.payments[i], ...p.updates };
      return { data: store.payments[i] };
    }

    // ── Notifications ────────────────────────────────────────────────────
    case 'getNotifications': {
      return { data: store.notifications.filter(n => n.user_id === p.userId || n.role === 'all').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 50) };
    }

    case 'addNotification': {
      const n = { id: `NOTIF-${Date.now()}`, read: false, created_at: new Date().toISOString(), ...p };
      store.notifications.push(n);
      return { data: n };
    }

    case 'markNotificationRead': {
      const n = store.notifications.find(x => x.id === p.id);
      if (n) n.read = true;
      return { data: true };
    }

    // ── Analytics ────────────────────────────────────────────────────────
    case 'getAnalytics': {
      const d = store.donations, p2 = store.payments, f = store.agent_fees, u = store.users;
      return {
        data: {
          totalDonations: d.length,
          delivered: d.filter(x => x.status === 'delivered').length,
          pending: d.filter(x => x.status === 'pending').length,
          approved: d.filter(x => x.status === 'approved').length,
          dispatched: d.filter(x => x.status === 'dispatched').length,
          assigned: d.filter(x => ['assigned', 'picked'].includes(x.status)).length,
          totalFunds: p2.filter(x => x.status === 'completed').reduce((s, x) => s + Number(x.amount), 0),
          pendingFunds: p2.filter(x => x.status === 'review').reduce((s, x) => s + Number(x.amount), 0),
          totalAgentFees: f.filter(x => x.status === 'paid').reduce((s, x) => s + Number(x.fee), 0),
          activeAgents: u.filter(x => x.role === 'agent').length,
          totalCenters: u.filter(x => x.role === 'center').length,
          totalDonors: u.filter(x => x.role === 'donor').length,
        }
      };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
