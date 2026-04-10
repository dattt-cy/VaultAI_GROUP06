import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import WorkspacePage from './pages/WorkspacePage';
import { DashboardPage } from './pages/DashboardPage';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
