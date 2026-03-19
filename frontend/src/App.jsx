import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/Home';
import { LoginPage, RegisterPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { PlayersPage } from './pages/Players';
import { ProfilePage } from './pages/Profile';
import { FinancePage } from './pages/Finance';
import { AdminPage } from './pages/Admin';
import { MatchesPage } from './pages/Matches';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = user?.role === 'admin';

  const updateAuthState = () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  useEffect(() => {
    // Initial auth check from localStorage
    updateAuthState();
    setIsLoading(false);

    // Listen for auth changes (login, logout)
    const handleAuthChange = () => {
      updateAuthState();
    };

    window.addEventListener('authchange', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    
    return () => {
      window.removeEventListener('authchange', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Navbar isAuthenticated={isAuthenticated} user={user} />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} />

        {/* Protected Routes */}
        {isAuthenticated ? (
          <>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/player/:playerId" element={<ProfilePage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/dashboard" />} />
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<Navigate to="/login" />} />
            <Route path="/players" element={<Navigate to="/login" />} />
            <Route path="/profile" element={<Navigate to="/login" />} />
            <Route path="/finance" element={<Navigate to="/login" />} />
            <Route path="/matches" element={<Navigate to="/login" />} />
            <Route path="/admin" element={<Navigate to="/login" />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
