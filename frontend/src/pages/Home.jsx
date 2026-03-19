import React from 'react';
import styles from './home.module.css';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1>🏏 Welcome to SSC</h1>
          <p>Sculpt Soft Cricketers platform for performance, finances, match history, and smart club operations.</p>
          <div className={styles.buttons}>
            <Link to="/register" className={styles.primaryBtn}>
              Register
            </Link>
            <Link to="/login" className={styles.secondaryBtn}>
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.container}>
          <h2>✨ Features</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.icon}>🤖</div>
              <h3>AI-Based Performance</h3>
              <p>Smart insights on form, consistency, strengths, and next-match focus areas.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.icon}>👑</div>
              <h3>Premium Membership</h3>
              <p>Get featured on our dashboard and stand out as a premium player</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.icon}>💰</div>
              <h3>Finance Tracking</h3>
              <p>Track paid players, pending funds, guest expenses, and remaining funds.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.icon}>💬</div>
              <h3>Admin Dashboard Chat</h3>
              <p>Players and admins can chat directly for quick support and team coordination.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.icon}>📈</div>
              <h3>Stats Charts</h3>
              <p>Visual charts for top runs, match trends, and team performance pulse.</p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.icon}>🔔</div>
              <h3>Expiry Notifications</h3>
              <p>Automatic premium expiry reminders and notification center in dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.pricing}>
        <div className={styles.container}>
          <h2>💳 Pricing</h2>
          <div className={styles.pricingGrid}>
            <div className={styles.priceCard}>
              <h3>Free Plan</h3>
              <p className={styles.price}>₹0</p>
              <ul>
                <li>✓ Player Profile</li>
                <li>✓ Performance Tracking</li>
                <li>✓ Basic Stats</li>
                <li>✗ Featured Status</li>
              </ul>
            </div>

            <div className={`${styles.priceCard} ${styles.premium}`}>
              <h3>Premium Plan</h3>
              <p className={styles.price}>₹1000<span>/month</span></p>
              <ul>
                <li>✓ Everything in Free</li>
                <li>✓ Featured on Dashboard</li>
                <li>✓ Priority Support</li>
                <li>✓ Advanced Analytics</li>
              </ul>
              <Link to="/register" className={styles.upgradeBtn}>
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
