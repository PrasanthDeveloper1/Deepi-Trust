import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { db, calculateDeliveryFee, getDistance } from '../config/supabase';
import { useAuth } from './AuthContext';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const { user } = useAuth();
  const [donations, setDonations]             = useState([]);
  const [payments, setPayments]               = useState([]);
  const [notifications, setNotifications]     = useState([]);
  const [analytics, setAnalytics]             = useState(null);
  const [deliveryRequests, setDeliveryRequests] = useState([]);
  const [agentLocations, setAgentLocations]   = useState({});
  const [agentFees, setAgentFees]             = useState([]);

  // ── Refresh all data from DB (works for both localDB sync and supabaseDB async) ──
  const refreshData = useCallback(async () => {
    try {
      const [don, pay, ana, reqs, locs, fees] = await Promise.all([
        Promise.resolve(db.getDonations()),
        Promise.resolve(db.getPayments()),
        Promise.resolve(db.getAnalytics()),
        Promise.resolve(db.getDeliveryRequests()),
        Promise.resolve(db.getAgentLocations()),
        Promise.resolve(db.getAgentFees()),
      ]);
      setDonations(don);
      setPayments(pay);
      setAnalytics(ana);
      setDeliveryRequests(reqs);
      setAgentLocations(locs);
      setAgentFees(fees);
      if (user) {
        const notifs = await Promise.resolve(db.getNotifications(user.id));
        setNotifications(notifs);
      }
    } catch (err) {
      console.error('refreshData error:', err);
    }
  }, [user]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // ── Donation Actions ───────────────────────────────────────────────────────
  const addDonation = useCallback(async (donation) => {
    const newDon = await Promise.resolve(db.addDonation(donation));
    // Notify all admins dynamically
    const admins = await Promise.resolve(db.getUsersByRole?.('admin') || []);
    const adminUser = Array.isArray(admins) ? admins[0] : null;
    await Promise.resolve(db.addNotification({
      user_id: adminUser?.id || 'admin', role: 'admin',
      title: 'New Donation Received',
      message: `${donation.donor_name} donated ${donation.food_name}`,
      type: 'donation'
    }));
    refreshData();
    return newDon;
  }, [refreshData]);

  const updateDonation = useCallback(async (id, updates) => {
    const result = await Promise.resolve(db.updateDonation(id, updates));
    refreshData();
    return result;
  }, [refreshData]);

  const approveDonation = useCallback(async (id, aiScore, aiDetails) => {
    await Promise.resolve(db.updateDonation(id, { status: 'approved', ai_score: aiScore, ai_details: aiDetails }));
    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === id);
    if (don) {
      await Promise.resolve(db.addNotification({
        user_id: don.donor_id, role: 'donor',
        title: 'Donation Approved!',
        message: `Your donation "${don.food_name}" passed AI quality check (Score: ${aiScore}%)`,
        type: 'success'
      }));
    }
    refreshData();
  }, [refreshData]);

  const rejectDonation = useCallback(async (id, reason) => {
    await Promise.resolve(db.updateDonation(id, { status: 'rejected', reject_reason: reason }));
    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === id);
    if (don) {
      await Promise.resolve(db.addNotification({
        user_id: don.donor_id, role: 'donor',
        title: 'Donation Rejected',
        message: `Your donation "${don.food_name}" was rejected: ${reason}`,
        type: 'error'
      }));
    }
    refreshData();
  }, [refreshData]);

  // ── Geocode a text address using Nominatim (free OSM) ─────────────────────
  const geocodeAddress = async (addressText) => {
    try {
      const q = encodeURIComponent(addressText + ', India');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      if (data && data[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (_) {}
    return null;
  };

  // ── Broadcast Dispatch (Swiggy/Zomato-style) ──────────────────────────────
  const broadcastDelivery = useCallback(async (donationId, centerId, centerName) => {
    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === donationId);
    const centers = await Promise.resolve(db.getUsersByRole('center'));
    const center = centers.find(c => c.id === centerId);
    if (!don || !center) return;

    const centerCoords = center.coords || null;

    await Promise.resolve(db.broadcastDeliveryRequest(
      donationId, centerId, centerName,
      centerCoords, don.pickup_coords || null,
      null, null  // fee & distance: TBD at acceptance
    ));

    await Promise.resolve(db.updateDonation(donationId, {
      status: 'dispatched',
      center_id: centerId,
      center_name: centerName,
      dispatched_at: new Date().toISOString()
    }));

    // Notify all registered agents
    const agents = await Promise.resolve(db.getUsersByRole('agent'));
    await Promise.all(agents.map(agent =>
      Promise.resolve(db.addNotification({
        user_id: agent.id, role: 'agent',
        title: '🚴 New Delivery Available!',
        message: `${don.food_name} — Pickup: ${don.pickup_location || 'See details'} → ${centerName}. Fee calculated on acceptance.`,
        type: 'task'
      }))
    ));

    refreshData();
    return { dispatched: true };
  }, [refreshData]);

  // ── Agent Accepts — real distance + fee calculated HERE ───────────────────
  const acceptDelivery = useCallback(async (donationId, agentId, agentName) => {
    const openReqs = await Promise.resolve(db.getOpenRequests());
    const req = openReqs.find(r => r.donation_id === donationId);
    if (!req) return { error: 'Already taken by another agent' };

    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === donationId);
    if (!don) return { error: 'Donation not found' };

    const centers = await Promise.resolve(db.getUsersByRole('center'));
    const center = centers.find(c => c.id === don.center_id);

    // ── Real geocoding ────────────────────────────────────────────────────
    let pickupCoords = don.pickup_coords;
    let centerCoords = center?.coords;
    if (!pickupCoords && don.pickup_location) {
      pickupCoords = await geocodeAddress(don.pickup_location);
    }
    if (!centerCoords && center?.address) {
      centerCoords = await geocodeAddress(center.address + ' ' + (center.name || ''));
    }

    let distanceKm = 3, feeAmount = calculateDeliveryFee(3);
    if (pickupCoords && centerCoords) {
      distanceKm = parseFloat(getDistance(pickupCoords, centerCoords).toFixed(1));
      feeAmount = calculateDeliveryFee(distanceKm);
    }

    await Promise.resolve(db.updateDonation(donationId, {
      delivery_distance: distanceKm,
      delivery_fee: feeAmount,
      pickup_coords: pickupCoords,
    }));

    const result = await Promise.resolve(db.acceptDeliveryRequest(donationId, agentId, agentName));
    if (result.error) return result;

    if (don) {
      await Promise.resolve(db.addNotification({
        user_id: don.center_id, role: 'center',
        title: '🚴 Agent Assigned!',
        message: `${agentName} accepted the delivery (${distanceKm} km). Track live!`,
        type: 'info'
      }));
      await Promise.resolve(db.addNotification({
        user_id: don.donor_id, role: 'donor',
        title: 'Agent Accepted Your Donation!',
        message: `${agentName} is heading to pickup "${don.food_name}" (${distanceKm} km · ₹${feeAmount})`,
        type: 'success'
      }));
    }

    refreshData();
    return { data: result.data, distanceKm, feeAmount };
  }, [refreshData]);

  // ── Pickup with Photo Verification ────────────────────────────────────────
  const pickupDonation = useCallback(async (id, qtyConfirmed, pickupPhotos) => {
    await Promise.resolve(db.updateDonation(id, {
      status: 'picked',
      picked_at: new Date().toISOString(),
      pickup_qty_confirmed: qtyConfirmed || null,
      pickup_photos: pickupPhotos || []
    }));
    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === id);
    if (don) {
      await Promise.resolve(db.addNotification({
        user_id: don.center_id, role: 'center',
        title: '📦 Food Picked Up!',
        message: `Agent is now en route with "${don.food_name}". Track live!`,
        type: 'info'
      }));
    }
    refreshData();
  }, [refreshData]);

  // ── Drop-off with Photo Verification ─────────────────────────────────────
  const deliverDonation = useCallback(async (id, dropPhotos) => {
    const all = await Promise.resolve(db.getDonations());
    const don = all.find(d => d.id === id);
    await Promise.resolve(db.updateDonation(id, {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      drop_photos: dropPhotos || []
    }));
    if (don) {
      // Create agent fee record — status='pending' until admin reviews photos
      await Promise.resolve(db.addAgentFee({
        agent_id: don.agent_id,
        agent_name: don.agent_name,
        donation_id: don.id,
        food_name: don.food_name,
        distance_km: don.delivery_distance,
        fee: don.delivery_fee
      }));
      await Promise.resolve(db.clearAgentLocation(don.agent_id));
      await Promise.resolve(db.addNotification({
        user_id: don.donor_id, role: 'donor',
        title: '✅ Donation Delivered!',
        message: `Your "${don.food_name}" has reached ${don.center_name}`,
        type: 'success'
      }));
      await Promise.resolve(db.addNotification({
        user_id: don.center_id, role: 'center',
        title: '🍱 Delivery Arrived!',
        message: `"${don.food_name}" delivered by ${don.agent_name}. Please confirm receipt.`,
        type: 'success'
      }));
    }
    refreshData();
  }, [refreshData]);

  // ── Center Confirms Receipt ────────────────────────────────────────────────
  const confirmReceipt = useCallback(async (id, qtyReceived, hasDiscrepancy, discrepancyNote) => {
    await Promise.resolve(db.updateDonation(id, {
      status: 'received',
      received_at: new Date().toISOString(),
      drop_qty_confirmed: qtyReceived || null,
      has_discrepancy: hasDiscrepancy || false,
      discrepancy_note: discrepancyNote || null
    }));
    refreshData();
  }, [refreshData]);

  // ── Agent Live Location ────────────────────────────────────────────────────
  const updateAgentLocation = useCallback(async (lat, lng) => {
    if (!user) return;
    await Promise.resolve(db.updateAgentLocation(user.id, lat, lng));
    refreshData();
  }, [user, refreshData]);

  const getAgentLocationById = useCallback((agentId) => {
    return db.getAgentLocation ? Promise.resolve(db.getAgentLocation(agentId)) : null;
  }, []);

  // ── Agent Fee Actions ──────────────────────────────────────────────────────
  const updateAgentFee = useCallback(async (id, updates) => {
    await Promise.resolve(db.updateAgentFee(id, updates));
    refreshData();
  }, [refreshData]);

  // ── Payment Actions ────────────────────────────────────────────────────────
  const addPayment = useCallback(async (payment) => {
    const p = await Promise.resolve(db.addPayment(payment));
    const admins = await Promise.resolve(db.getUsersByRole?.('admin') || []);
    const adminUser = Array.isArray(admins) ? admins[0] : null;
    await Promise.resolve(db.addNotification({
      user_id: adminUser?.id || 'admin', role: 'admin',
      title: 'New Payment Received',
      message: `₹${payment.amount} from ${payment.donor_name}`,
      type: 'payment'
    }));
    refreshData();
    return p;
  }, [refreshData]);

  const approvePayment = useCallback(async (id) => {
    await Promise.resolve(db.updatePayment(id, { status: 'completed' }));
    refreshData();
  }, [refreshData]);

  // ── Admin QR ──────────────────────────────────────────────────────────────
  const getAdminQR = useCallback(async () => {
    return await Promise.resolve(db.getAdminQR());
  }, []);

  const setAdminQR = useCallback(async (dataUrl) => {
    await Promise.resolve(db.setAdminQR(dataUrl));
    refreshData();
  }, [refreshData]);

  // ── Notifications ──────────────────────────────────────────────────────────
  const markNotificationRead = useCallback(async (id) => {
    await Promise.resolve(db.markNotificationRead(id));
    refreshData();
  }, [refreshData]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      donations, payments, notifications, analytics, unreadCount,
      deliveryRequests, agentLocations, agentFees,
      addDonation, updateDonation, approveDonation, rejectDonation,
      broadcastDelivery, acceptDelivery,
      pickupDonation, deliverDonation, confirmReceipt,
      updateAgentLocation, getAgentLocationById,
      updateAgentFee,
      addPayment, approvePayment,
      getAdminQR, setAdminQR,
      markNotificationRead, refreshData,
      getAgents: () => Promise.resolve(db.getUsersByRole('agent')),
      getCenters: () => Promise.resolve(db.getUsersByRole('center')),
      calculateDeliveryFee,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
