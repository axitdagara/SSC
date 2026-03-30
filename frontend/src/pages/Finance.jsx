import React, { useEffect, useMemo, useState } from 'react';
import { financeService } from '../utils/api';
import { FinancePageSkeleton } from '../components/Skeleton';
import styles from './finance.module.css';

export function FinancePage() {
  const [overview, setOverview] = useState(null);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [guestFundForm, setGuestFundForm] = useState({
    match_name: '',
    guest_fund: '',
    notes: '',
  });

  const [manualCreditForm, setManualCreditForm] = useState({
    amount: '',
    notes: '',
  });

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const isAdmin = user?.role === 'admin';

  const loadData = async () => {
    try {
      setError('');
      const [overviewRes, paymentsRes, transactionsRes] = await Promise.all([
        financeService.getOverview(),
        financeService.getPlayerPayments(),
        financeService.getTransactions(),
      ]);

      setOverview(overviewRes.data);
      setPayments(paymentsRes.data || []);
      setTransactions(transactionsRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load finance dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGuestFund = async (e) => {
    e.preventDefault();
    try {
      await financeService.addGuestFundExpense({
        match_name: guestFundForm.match_name,
        guest_fund: Number(guestFundForm.guest_fund),
        notes: guestFundForm.notes,
      });
      setGuestFundForm({ match_name: '', guest_fund: '', notes: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add guest fund expense');
    }
  };

  const handleManualCredit = async (e) => {
    e.preventDefault();
    try {
      await financeService.addManualCredit({
        amount: Number(manualCreditForm.amount),
        notes: manualCreditForm.notes,
      });
      setManualCreditForm({ amount: '', notes: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add manual credit');
    }
  };

  if (loading) return <FinancePageSkeleton />;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Club Finance</h1>
          <p>Track paid players, pending funds, and remaining budget after each match.</p>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span>Total Collected</span>
            <strong>Rs {overview?.total_collected?.toFixed(2) || '0.00'}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Pending Funds</span>
            <strong>Rs {overview?.pending_funds?.toFixed(2) || '0.00'}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Funds Remaining</span>
            <strong>Rs {overview?.funds_remaining?.toFixed(2) || '0.00'}</strong>
          </div>
          <div className={styles.metricCard}>
            <span>Guest Fund Used</span>
            <strong>Rs {overview?.total_guest_fund_used?.toFixed(2) || '0.00'}</strong>
          </div>
        </div>

        {isAdmin && (
          <div className={styles.formsGrid}>
            <form className={styles.formCard} onSubmit={handleGuestFund}>
              <h3>Record Match Guest Fund</h3>
              <input
                type="text"
                placeholder="Match name"
                value={guestFundForm.match_name}
                onChange={(e) => setGuestFundForm((prev) => ({ ...prev, match_name: e.target.value }))}
                required
              />
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Guest fund amount"
                value={guestFundForm.guest_fund}
                onChange={(e) => setGuestFundForm((prev) => ({ ...prev, guest_fund: e.target.value }))}
                required
              />
              <textarea
                placeholder="Notes (optional)"
                value={guestFundForm.notes}
                onChange={(e) => setGuestFundForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <button type="submit">Update Remaining Funds</button>
            </form>

            <form className={styles.formCard} onSubmit={handleManualCredit}>
              <h3>Add Manual Credit</h3>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Credit amount"
                value={manualCreditForm.amount}
                onChange={(e) => setManualCreditForm((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
              <textarea
                placeholder="Reason / notes"
                value={manualCreditForm.notes}
                onChange={(e) => setManualCreditForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <button type="submit">Add Credit</button>
            </form>
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Player Payments (Rs 1000 plan)</h2>
            <span>{payments.length} players</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Email</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5">No players found</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.user_id}>
                      <td>{payment.name}</td>
                      <td>{payment.email}</td>
                      <td>Rs {payment.amount_paid?.toFixed(2) || '0.00'}</td>
                      <td>Rs {payment.due_amount?.toFixed(2) || '0.00'}</td>
                      <td>
                        <span className={payment.has_paid ? styles.badgePaid : styles.badgePending}>
                          {payment.has_paid ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Recent Finance Transactions</h2>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan="5">No transactions yet</td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={item.transaction_type === 'credit' ? styles.badgePaid : styles.badgePending}>
                          {item.transaction_type}
                        </span>
                      </td>
                      <td>{item.category}</td>
                      <td>Rs {Number(item.amount).toFixed(2)}</td>
                      <td>{item.description || '-'}</td>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
