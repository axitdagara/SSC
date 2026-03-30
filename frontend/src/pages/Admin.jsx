import React, { useEffect, useMemo, useState } from 'react';
import { adminService } from '../utils/api';
import { AdminPageSkeleton } from '../components/Skeleton';
import styles from './admin.module.css';

const USERS_PER_PAGE = 10;

export function AdminPage() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [threads, setThreads] = useState([]);
  const [activeThreadUser, setActiveThreadUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUserIds, setUpdatingUserIds] = useState({});
  const [openActionMenuUserId, setOpenActionMenuUserId] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState({});
  const [threadLoadingUserId, setThreadLoadingUserId] = useState(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }, []);

  const isAdmin = user?.role === 'admin';

  const loadDashboard = async () => {
    try {
      setError('');
      const [statsRes, usersRes, chatRes] = await Promise.all([
        adminService.getSystemStats(),
        adminService.getAllUsers(0, 100),
        adminService.getChatThreads(),
      ]);

      setStats(statsRes.data);
      setUsers(usersRes.data || []);
      setThreads(chatRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    loadDashboard();
  }, [isAdmin]);

  useEffect(() => {
    const closeMenuOnOutsideClick = (event) => {
      if (!event.target.closest('[data-action-menu]')) {
        setOpenActionMenuUserId(null);
      }
    };

    document.addEventListener('mousedown', closeMenuOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeMenuOnOutsideClick);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return users;

    return users.filter((row) => {
      const name = String(row.name || '').toLowerCase();
      const email = String(row.email || '').toLowerCase();
      const role = String(row.role || '').toLowerCase();
      const id = String(row.id || '').toLowerCase();
      return name.includes(query) || email.includes(query) || role.includes(query) || id.includes(query);
    });
  }, [users, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pageStart = (currentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + USERS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
    setOpenActionMenuUserId(null);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setActionBusy = (userId, actionName, busy) => {
    const key = `${String(userId)}:${actionName}`;
    setActionLoading((prev) => {
      if (busy) {
        return { ...prev, [key]: true };
      }

      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isActionBusy = (userId, actionName) => {
    return !!actionLoading[`${String(userId)}:${actionName}`];
  };

  const isAnyActionBusy = (userId) => {
    const prefix = `${String(userId)}:`;
    return Object.keys(actionLoading).some((key) => key.startsWith(prefix));
  };

  const openThread = async (thread) => {
    try {
      setThreadLoadingUserId(String(thread.user_id));
      setActiveThreadUser(thread);
      const threadRes = await adminService.getChatThread(thread.user_id);
      setMessages(threadRes.data || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to open chat thread');
    } finally {
      setThreadLoadingUserId(null);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activeThreadUser || !newMessage.trim()) return;

    try {
      setIsSendingMessage(true);
      await adminService.sendAdminMessage(activeThreadUser.user_id, newMessage.trim());
      setNewMessage('');
      const threadRes = await adminService.getChatThread(activeThreadUser.user_id);
      setMessages(threadRes.data || []);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleApprovePremiumRequest = async () => {
    if (!activeThreadUser) return;
    try {
      await adminService.approvePremiumRequest(activeThreadUser.user_id, 30);
      alert('Premium request approved successfully.');
      const threadRes = await adminService.getChatThread(activeThreadUser.user_id);
      setMessages(threadRes.data || []);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve premium request');
    }
  };

  const hasPendingPremiumRequest = messages.some((msg) => (
    msg.sender_role === 'player'
    && String(msg.message || '').startsWith('PREMIUM_UPGRADE_REQUEST')
  ));

  const handleTogglePremium = async (userId) => {
    try {
      setActionBusy(userId, 'premium', true);
      await adminService.toggleUserPremium(userId, 30);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update premium status');
    } finally {
      setActionBusy(userId, 'premium', false);
    }
  };

  const handleDeactivate = async (userId) => {
    try {
      setUpdatingUserIds((prev) => ({ ...prev, [String(userId)]: true }));
      setActionBusy(userId, 'active', true);
      await adminService.deactivateUser(userId);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to deactivate user');
    } finally {
      setUpdatingUserIds((prev) => ({ ...prev, [String(userId)]: false }));
      setActionBusy(userId, 'active', false);
    }
  };

  const handleActivate = async (userId) => {
    try {
      setUpdatingUserIds((prev) => ({ ...prev, [String(userId)]: true }));
      setActionBusy(userId, 'active', true);
      await adminService.activateUser(userId);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to activate user');
    } finally {
      setUpdatingUserIds((prev) => ({ ...prev, [String(userId)]: false }));
      setActionBusy(userId, 'active', false);
    }
  };

  const handleToggleActive = async (item) => {
    if (item.is_active) {
      await handleDeactivate(item.id);
    } else {
      await handleActivate(item.id);
    }
  };

  const handleSetRole = async (userId, role) => {
    try {
      setActionBusy(userId, 'role', true);
      await adminService.updateUserRole(userId, role);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setActionBusy(userId, 'role', false);
    }
  };

  const handleHardDelete = async (userId) => {
    if (!window.confirm('Delete this user permanently? This cannot be undone.')) return;
    try {
      setActionBusy(userId, 'delete', true);
      await adminService.hardDeleteUser(userId);
      await loadDashboard();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete user');
    } finally {
      setActionBusy(userId, 'delete', false);
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm('Reset this user password to 123456?')) return;
    try {
      setActionBusy(userId, 'reset', true);
      await adminService.resetUserPassword(userId);
      alert('Password reset successfully. New password: 123456');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setActionBusy(userId, 'reset', false);
    }
  };

  if (loading) return <AdminPageSkeleton />;

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.denied}>Admin access required.</div>
      </div>
    );
  }

  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Admin Control Center</h1>
          <p>Manage users, finances, and live player support conversations.</p>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Users</span>
            <strong>{stats?.total_users || 0}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Active Users</span>
            <strong>{stats?.active_users || 0}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Premium Users</span>
            <strong>{stats?.premium_users || 0}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Total Matches</span>
            <strong>{stats?.total_matches || 0}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Pending Funds</span>
            <strong>Rs {Number(stats?.pending_funds || 0).toFixed(2)}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Funds Remaining</span>
            <strong>Rs {Number(stats?.funds_remaining || 0).toFixed(2)}</strong>
          </div>
        </div>

        <div className={styles.layoutGrid}>
          <section className={styles.card}>
            <h2>User Operations</h2>
            <div className={styles.userTools}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search by name, email, role, or id"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className={styles.userCount}>
                Showing {paginatedUsers.length} of {filteredUsers.length}
              </span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Premium</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((item, index) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.role}</td>
                      <td>
                        {isActionBusy(item.id, 'premium') ? (
                          <button className={`${styles.premiumCellBtn} ${styles.loadingBtn}`} disabled>
                            <span className={styles.btnSpinner}></span>
                            Processing...
                          </button>
                        ) : (
                        <button
                          className={`${styles.premiumCellBtn} ${item.is_premium ? styles.premiumDeactivate : styles.premiumActivate}`}
                          disabled={isAnyActionBusy(item.id)}
                          onClick={() => handleTogglePremium(item.id)}
                        >
                          {item.is_premium ? 'Deactivate Premium' : 'Activate Premium'}
                        </button>
                        )}
                      </td>
                      <td>{item.is_active ? 'Active' : 'Inactive'}</td>
                      <td className={styles.actionRow}>
                        <label className={styles.switch} title={item.is_active ? 'Deactivate user' : 'Activate user'}>
                          <input
                            type="checkbox"
                            checked={!!item.is_active}
                            disabled={!!updatingUserIds[String(item.id)] || isAnyActionBusy(item.id)}
                            onChange={() => handleToggleActive(item)}
                          />
                          <span className={`${styles.slider} ${isActionBusy(item.id, 'active') ? styles.sliderBusy : ''}`}></span>
                        </label>
                        <div className={styles.actionMenuWrap} data-action-menu>
                          <button
                            className={styles.kebabBtn}
                            disabled={isAnyActionBusy(item.id)}
                            onClick={() => setOpenActionMenuUserId((prev) => (prev === item.id ? null : item.id))}
                            title="More actions"
                            aria-label="More actions"
                            aria-haspopup="menu"
                            aria-expanded={openActionMenuUserId === item.id}
                          >
                            {isAnyActionBusy(item.id) ? <span className={styles.miniSpinner} aria-hidden="true"></span> : <span aria-hidden="true">⋮</span>}
                          </button>
                          {openActionMenuUserId === item.id && (
                            <div
                              className={`${styles.actionMenu} ${index >= paginatedUsers.length - 5 ? styles.actionMenuUp : ''}`}
                              role="menu"
                            >
                              <button
                                type="button"
                                className={styles.menuItem}
                                disabled={isAnyActionBusy(item.id)}
                                onClick={() => {
                                  setOpenActionMenuUserId(null);
                                  setViewUser(item);
                                }}
                              >
                                View User
                              </button>
                              {item.role === 'admin' ? (
                                <button
                                  type="button"
                                  className={`${styles.menuItem} ${styles.menuWarn}`}
                                  disabled={isAnyActionBusy(item.id)}
                                  onClick={() => {
                                    setOpenActionMenuUserId(null);
                                    handleSetRole(item.id, 'player');
                                  }}
                                >
                                  Remove Admin
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.menuItem} ${styles.menuSuccess}`}
                                  disabled={isAnyActionBusy(item.id)}
                                  onClick={() => {
                                    setOpenActionMenuUserId(null);
                                    handleSetRole(item.id, 'admin');
                                  }}
                                >
                                  Make Admin
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.menuItem}
                                disabled={isAnyActionBusy(item.id)}
                                onClick={() => {
                                  setOpenActionMenuUserId(null);
                                  handleResetPassword(item.id);
                                }}
                              >
                                Reset Password
                              </button>
                              <button
                                type="button"
                                className={`${styles.menuItem} ${styles.menuDanger}`}
                                disabled={isAnyActionBusy(item.id)}
                                onClick={() => {
                                  setOpenActionMenuUserId(null);
                                  handleHardDelete(item.id);
                                }}
                              >
                                Delete User
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </button>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Admin Dashboard Chats</h2>
            <div className={styles.chatLayout}>
              <div className={styles.threadList}>
                {threads.length === 0 ? (
                  <p>No player chats yet.</p>
                ) : (
                  threads.map((thread) => (
                    <button
                      key={thread.user_id}
                      className={`${styles.threadBtn} ${activeThreadUser?.user_id === thread.user_id ? styles.threadBtnActive : ''}`}
                      disabled={threadLoadingUserId === String(thread.user_id)}
                      onClick={() => openThread(thread)}
                    >
                      <div>
                        <strong>{thread.name}</strong>
                        <small>{thread.email}</small>
                      </div>
                      {threadLoadingUserId === String(thread.user_id) ? (
                        <span className={styles.threadLoader}></span>
                      ) : (
                        thread.unread_count > 0 && <span>{thread.unread_count}</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className={styles.chatWindow}>
                {!activeThreadUser ? (
                  <p>Select a player thread to start chatting.</p>
                ) : (
                  <>
                    <div className={styles.chatHeader}>
                      <h3>{activeThreadUser.name}</h3>
                      <small>{activeThreadUser.email}</small>
                      {hasPendingPremiumRequest && (
                        <button className={styles.pageBtn} onClick={handleApprovePremiumRequest}>
                          Approve Premium
                        </button>
                      )}
                    </div>
                    <div className={styles.messages}>
                      {messages.length === 0 ? (
                        <p>No messages yet.</p>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={msg.sender_role === 'admin' ? styles.msgAdmin : styles.msgPlayer}
                          >
                            <span>{msg.message}</span>
                            <small>{new Date(msg.created_at).toLocaleString()}</small>
                          </div>
                        ))
                      )}
                    </div>
                    <form className={styles.chatForm} onSubmit={handleSend}>
                      <input
                        type="text"
                        placeholder="Reply to player..."
                        value={newMessage}
                        disabled={isSendingMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                      />
                      <button type="submit" disabled={isSendingMessage || !newMessage.trim()}>
                        {isSendingMessage ? (
                          <>
                            <span className={styles.btnSpinner}></span>
                            Sending...
                          </>
                        ) : (
                          'Send'
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {viewUser && (
        <div className={styles.modalOverlay} onClick={() => setViewUser(null)}>
          <div className={styles.userModal} onClick={(e) => e.stopPropagation()}>
            <h3>User Details</h3>
            <div className={styles.userDetailsGrid}>
              <span>Name</span><strong>{viewUser.name || '-'}</strong>
              <span>Email</span><strong>{viewUser.email || '-'}</strong>
              <span>Role</span><strong>{viewUser.role || '-'}</strong>
              <span>Status</span><strong>{viewUser.is_active ? 'Active' : 'Inactive'}</strong>
              <span>Premium</span><strong>{viewUser.is_premium ? 'Yes' : 'No'}</strong>
              <span>Matches</span><strong>{Number(viewUser.matches || 0)}</strong>
              <span>Runs</span><strong>{Number(viewUser.runs || 0)}</strong>
              <span>Wickets</span><strong>{Number(viewUser.wickets || 0)}</strong>
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setViewUser(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
