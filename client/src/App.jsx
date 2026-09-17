import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';

import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CasesList from './pages/CasesList';
import CaseDetails from './pages/CaseDetails';
import EvidenceList from './pages/EvidenceList';
import EvidenceDetails from './pages/EvidenceDetails';
import VerifyEvidence from './pages/VerifyEvidence';
import AdminUsers from './pages/AdminUsers';
import AuditLogs from './pages/AuditLogs';

export default function App() {
  return (
    <AuthProvider>
      <Web3Provider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Authenticated Vault Routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cases" element={<CasesList />} />
              <Route path="/cases/:id" element={<CaseDetails />} />
              <Route path="/evidence" element={<EvidenceList />} />
              <Route path="/evidence/:id" element={<EvidenceDetails />} />
              <Route path="/verify" element={<VerifyEvidence />} />
            </Route>

            {/* Admin-Only Routes */}
            <Route element={<AppLayout requiredRoles={['ADMIN']} />}>
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/audit" element={<AuditLogs />} />
            </Route>

            {/* Fallback Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </Web3Provider>
    </AuthProvider>
  );
}
