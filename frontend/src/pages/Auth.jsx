import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../utils/api';
import styles from './auth.module.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const completeSocialLogin = async () => {
      try {
        const res = await authService.completeSocialLogin();
        if (res?.data?.access_token && res?.data?.user) {
          navigate('/dashboard');
        }
      } catch (_err) {
        // Ignore silent social callback check failures
      }
    };
    completeSocialLogin();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      console.log('🔐 Attempting login with:', email);
      const response = await authService.login(email, password);
      console.log('✅ Login response:', response);
      
      const { access_token, user } = response.data;

      if (!access_token || !user) {
        console.warn('⚠️ Missing token or user in response:', response.data);
        setMessage(response.data?.message || 'Check your email to complete login.');
        setLoading(false);
        return;
      }
      
      console.log('💾 Storing token and user in localStorage');
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Dispatch event to notify App component
      window.dispatchEvent(new Event('authchange'));
      
      // Small delay to ensure state updates
      console.log('🚀 Navigating to dashboard');
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (err) {
      console.error('❌ Login error:', err);
      const errorMsg = err.response?.data?.detail || err.message || 'Login failed';
      console.error('Error details:', errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await authService.loginWithGoogle();
    } catch (err) {
      setError(err.response?.data?.detail || 'Google login failed');
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authBox}>
        <h1>🏏 Login to SSC</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" onClick={handleGoogleLogin} disabled={loading}>
            Continue with Google
          </button>
        </form>
        
        <p>
          Don't have an account? <a href="/register">Register here</a>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authService.register(name, email, password);
      const { access_token, user } = response.data;

      if (!access_token || !user) {
        setMessage(response.data?.message || 'Registration successful. Check your email and login.');
        return;
      }
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Dispatch event to notify App component
      window.dispatchEvent(new Event('authchange'));
      
      // Small delay to ensure state updates
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authBox}>
        <h1>🏏 Join SSC</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <p>
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
}
