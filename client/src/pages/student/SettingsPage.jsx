import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBell,
  faEye,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
import './SettingsPage.css';

const notificationOptions = [
  {
    key: 'notifyCollaborationRequests',
    title: 'Collaboration requests',
    description: 'When another student sends or responds to a collaboration request.',
  },
  {
    key: 'notifyGroupInvitations',
    title: 'Group invitations',
    description: 'When you receive a group invitation.',
  },
  {
    key: 'notifyMembershipUpdates',
    title: 'Membership updates',
    description: 'When a group membership request is submitted or decided.',
  },
  {
    key: 'notifyMessages',
    title: 'Group messages',
    description: 'When a group member sends a new message.',
  },
];

function PreferenceToggle({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      className={`settings-toggle ${checked ? 'is-on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export default function SettingsPage({
  user,
  settings,
  loading,
  error: loadError,
  onNavigate,
  onSettingsChange,
  onRetry,
}) {
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;

    const timeoutId = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function saveSetting(key, value) {
    if (!settings) return;

    const previousValue = settings[key];
    onSettingsChange({ ...settings, [key]: value });
    setSavingKey(key);
    setError('');
    setNotice('');

    try {
      const response = await api.patch('/settings', { [key]: value });
      const savedSettings = response.data?.data?.settings;

      if (!savedSettings) {
        throw new Error('The server returned an invalid settings response.');
      }

      onSettingsChange(savedSettings);
      setNotice('Setting saved successfully.');
    } catch (requestError) {
      onSettingsChange({ ...settings, [key]: previousValue });
      setError(getApiErrorMessage(requestError, 'Could not save this setting.'));
    } finally {
      setSavingKey('');
    }
  }

  const controlsDisabled = loading || !settings || Boolean(savingKey);

  return (
    <div className="settings-page">
      <header className="settings-heading">
        <h1>Settings</h1>
        <p>Manage your account preferences, privacy, and notifications.</p>
      </header>

      {error && <div className="settings-feedback error" role="alert">{error}</div>}
      {notice && <div className="settings-feedback success" role="status">{notice}</div>}

      {loadError && (
        <div className="settings-feedback error" role="alert">
          {loadError}
          <button type="button" className="settings-retry-button" onClick={onRetry}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="settings-loading">Loading your settings...</div>
      ) : !settings ? (
        <div className="settings-loading">Settings are unavailable until they can be loaded.</div>
      ) : (
        <div className="settings-layout">
          <section className="settings-card settings-account-card">
            <div className="settings-card-heading">
              <span className="settings-card-icon"><FontAwesomeIcon icon={faUser} /></span>
              <div>
                <h2>Account</h2>
                <p>Your account identity and profile information.</p>
              </div>
            </div>

            <div className="settings-account-details">
              <div>
                <span>Name</span>
                <strong>{user?.fullName || 'Student'}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{user?.email || 'Not available'}</strong>
              </div>
              <div>
                <span>Account type</span>
                <strong>{user?.role === 'admin' ? 'Administrator' : 'Student'}</strong>
              </div>
            </div>

            <button
              type="button"
              className="settings-secondary-button"
              onClick={() => onNavigate?.('My Profile')}
            >
              Manage my profile
            </button>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-card-icon"><FontAwesomeIcon icon={faEye} /></span>
              <div>
                <h2>Privacy</h2>
                <p>Choose whether other students can discover your profile.</p>
              </div>
            </div>

            <div className="settings-option-row">
              <div>
                <h3>Show my profile in Find Students and matching</h3>
                <p>
                  When turned off, your profile is excluded from student
                  discovery and recommendations.
                </p>
              </div>
              <PreferenceToggle
                checked={settings.profileDiscoverable}
                disabled={controlsDisabled}
                label="Show my profile in Find Students and matching"
                onChange={(value) => saveSetting('profileDiscoverable', value)}
              />
            </div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading">
              <span className="settings-card-icon"><FontAwesomeIcon icon={faBell} /></span>
              <div>
                <h2>In-app notifications</h2>
                <p>Choose which collaboration updates appear in your notification center.</p>
              </div>
            </div>

            <div className="settings-options-list">
              {notificationOptions.map((option) => (
                <div className="settings-option-row" key={option.key}>
                  <div>
                    <h3>{option.title}</h3>
                    <p>{option.description}</p>
                  </div>
                  <PreferenceToggle
                    checked={settings[option.key]}
                    disabled={controlsDisabled}
                    label={option.title}
                    onChange={(value) => saveSetting(option.key, value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <p className="settings-save-note">
            Changes are saved automatically to your EduMatch account.
          </p>
        </div>
      )}
    </div>
  );
}
