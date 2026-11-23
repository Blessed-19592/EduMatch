import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faCheckDouble,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../api/api';
import './NotificationCenter.css';

const validPages = new Set([
  'Collaboration Requests',
  'Group Invitations',
  'Membership Requests',
  'Messages',
]);

function formatNotificationDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function NotificationCenter({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      const response = await api.get('/notifications');
      const payload = response.data?.data;

      setNotifications(Array.isArray(payload?.notifications) ? payload.notifications : []);
      setUnreadCount(Number(payload?.unreadCount) || 0);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load notifications.'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(() => loadNotifications(), 30000);

    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  async function markAllRead() {
    setUpdating(true);
    setError('');

    try {
      await api.patch('/notifications/read-all');
      await loadNotifications();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not update notifications.'));
    } finally {
      setUpdating(false);
    }
  }

  async function openNotification(notification) {
    setError('');

    try {
      if (!notification.read_at) {
        await api.patch(`/notifications/${notification.notification_id}/read`);
      }

      const targetPage = validPages.has(notification.target_page)
        ? notification.target_page
        : 'Settings';

      setOpen(false);
      onNavigate?.(targetPage);
      await loadNotifications();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not open this notification.'));
    }
  }

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) {
            setError('');
            loadNotifications(true);
          }
        }}
      >
        <FontAwesomeIcon icon={faBell} />
        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          className="notification-panel"
          id="notification-panel"
          aria-label="Notifications"
        >
          <header className="notification-panel-header">
            <div>
              <h2>Notifications</h2>
              <p>{unreadCount} unread</p>
            </div>
            <div className="notification-panel-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notification-mark-all"
                  onClick={markAllRead}
                  disabled={updating}
                >
                  <FontAwesomeIcon icon={faCheckDouble} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                className="notification-close"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
          </header>

          {error && <p className="notification-error" role="alert">{error}</p>}

          {loading ? (
            <p className="notification-empty">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="notification-empty">You’re all caught up.</p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  type="button"
                  className={`notification-item ${notification.read_at ? '' : 'unread'}`}
                  key={notification.notification_id}
                  onClick={() => openNotification(notification)}
                >
                  <span className="notification-item-dot" aria-hidden="true" />
                  <span className="notification-item-content">
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <small>{formatNotificationDate(notification.created_at)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
