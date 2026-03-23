import React from 'react';
import styles from './navbar.module.css';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../utils/api';

export function Navbar({ isAuthenticated, user }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/');
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <Link to="/" className={styles.logo}>
          🏏 SSC
        </Link>

        <div className={styles.navlinks}>
          {isAuthenticated ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/players">Players</Link>
              <Link to="/matches">Matches</Link>
              <Link to="/profile">Profile</Link>
              <Link to="/finance">Finance</Link>
              {user?.role === 'admin' && (
                <Link to="/admin">Admin</Link>
              )}
              <button onClick={handleLogout} className={styles.logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/">Home</Link>
              <Link to="/login">Login</Link>
              <Link to="/register" className={styles.register}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
