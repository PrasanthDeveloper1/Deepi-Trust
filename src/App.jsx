import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import HomePage from './pages/HomePage';
import DonorDashboard from './pages/DonorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AgentDashboard from './pages/AgentDashboard';
import CenterDashboard from './pages/CenterDashboard';
import Crowdfunding from './pages/Crowdfunding';
import TrackingPage from './pages/TrackingPage';

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes (no layout) */}
        <Route path="/login" element={user ? <Navigate to={`/${user.role === 'donor' ? 'donor' : user.role}`} replace /> : <LoginPage />} />
        <Route path="/signup" element={user ? <Navigate to={`/${user.role === 'donor' ? 'donor' : user.role}`} replace /> : <SignupPage />} />

        {/* Main Layout Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />

          {/* Donor Dashboard */}
          <Route path="donor" element={
            <ProtectedRoute allowedRoles={['donor']}>
              <DonorDashboard />
            </ProtectedRoute>
          } />

          {/* Legacy donate route */}
          <Route path="donate" element={
            user ? <Navigate to="/donor" replace /> : <Navigate to="/login" replace />
          } />

          {/* Admin Dashboard */}
          <Route path="admin" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Agent Dashboard */}
          <Route path="agent" element={
            <ProtectedRoute allowedRoles={['agent']}>
              <AgentDashboard />
            </ProtectedRoute>
          } />

          {/* Center Dashboard */}
          <Route path="center" element={
            <ProtectedRoute allowedRoles={['center']}>
              <CenterDashboard />
            </ProtectedRoute>
          } />

          {/* Crowdfunding — accessible to everyone except admin (admin has own panel) */}
          <Route path="crowdfunding" element={
            user?.role === 'admin'
              ? <Navigate to="/admin" replace />
              : <Crowdfunding />
          } />

          {/* GPS Tracking (admin and agents) */}
          <Route path="tracking" element={
            <ProtectedRoute allowedRoles={['admin', 'agent']}>
              <TrackingPage />
            </ProtectedRoute>
          } />

          {/* Legacy delivery route */}
          <Route path="delivery" element={
            user ? <Navigate to="/agent" replace /> : <Navigate to="/login" replace />
          } />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
