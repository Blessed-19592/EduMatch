import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api, { getApiErrorMessage } from '../../api/api';
import './AdminReviewPage.css';

const PAGE_SIZE = 50;
const TABS = [
  { value: 'submitted', label: 'Awaiting review' },
  { value: 'approved', label: 'Approved profiles' },
  { value: 'hidden', label: 'Hidden profiles' },
];

export default function AdminReviewPage() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState('submitted');
  const [profiles, setProfiles] = useState([]);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [workingStudentId, setWorkingStudentId] = useState(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);

  const loadProfiles = useCallback(async (nextStatus = status, nextOffset = 0) => {
    const requestId = ++requestSequence.current;

    try {
      const response = await api.get('/admin/profiles', {
        params: {
          status: nextStatus,
          limit: PAGE_SIZE,
          offset: nextOffset,
        },
      });

      if (requestId !== requestSequence.current) return;

      setProfiles((current) => nextOffset === 0
        ? response.data.profiles
        : [...current, ...response.data.profiles]);
      setOffset(nextOffset);
      setTotalCount(response.data.totalCount);
    } catch (requestError) {
      if (requestId === requestSequence.current) {
        setError(getApiErrorMessage(requestError, 'Could not load student profiles.'));
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [status]);

  useEffect(() => {
    loadProfiles(status, 0);
  }, [loadProfiles, status]);

  const runAction = async (profile, endpoint, action, requiresNotes) => {
    const reason = notes[profile.studentId]?.trim() || '';

    if (requiresNotes && (reason.length < 10 || reason.length > 1000)) {
      setError('Enter a reason between 10 and 1000 characters before taking this action.');
      return;
    }

    setWorkingStudentId(profile.studentId);
    setError('');
    setNotice('');

    try {
      const response = await api.post(
        `/admin/profiles/${profile.studentId}/${endpoint}`,
        {
          action,
          ...(reason ? { notes: reason } : {}),
        }
      );
      setNotice(response.data.message);
      setNotes((current) => ({ ...current, [profile.studentId]: '' }));
      setLoading(true);
      await loadProfiles(status, 0);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'The profile action could not be completed.'));
    } finally {
      setWorkingStudentId(null);
    }
  };

  const loadMore = () => {
    setLoadingMore(true);
    loadProfiles(status, offset + PAGE_SIZE);
  };

  const approveAllSubmitted = async () => {
    if (bulkApproving || totalCount === 0) return;

    const confirmed = window.confirm(
      `Approve all ${totalCount} submitted profiles? This will not approve draft profiles or make hidden profiles visible.`
    );

    if (!confirmed) return;

    setBulkApproving(true);
    setError('');
    setNotice('');

    try {
      const response = await api.post('/admin/profiles/review/approve-all');
      setNotice(response.data.message);
      setLoading(true);
      await loadProfiles(status, 0);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Bulk approval could not be completed.'));
    } finally {
      setBulkApproving(false);
    }
  };

  return (
    <main className="admin-review-page">
      <header className="admin-review-header">
        <div>
          <span className="admin-review-eyebrow">EDUMATCH ADMINISTRATION</span>
          <h1>Student profile review</h1>
          <p>Review collaboration profiles and manage their visibility in student discovery.</p>
        </div>
        <div className="admin-review-account">
          <span>Signed in as <strong>{user?.fullName || 'Administrator'}</strong></span>
          <button type="button" className="admin-review-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-review-tabs" aria-label="Profile review queues">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.value}
            className={status === tab.value ? 'active' : ''}
            aria-pressed={status === tab.value}
            disabled={workingStudentId !== null || bulkApproving}
            onClick={() => {
              setLoading(true);
              setError('');
              setStatus(tab.value);
              setNotice('');
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="admin-review-list-heading">
        <h2>{TABS.find((tab) => tab.value === status)?.label}</h2>
        {!loading && <span>{totalCount} {totalCount === 1 ? 'profile' : 'profiles'}</span>}
      </div>

      {status === 'submitted' && totalCount > 0 && (
        <div className="admin-review-bulk-approval">
          <p>
            This action approves every submitted profile, including profiles not yet loaded on this page.
            Draft and registry-only students are not included.
          </p>
          <button
            type="button"
            className="admin-review-primary"
            disabled={loading || bulkApproving || workingStudentId !== null}
            onClick={approveAllSubmitted}
          >
            {bulkApproving ? 'Approving profiles…' : `Approve all ${totalCount} submitted`}
          </button>
        </div>
      )}

      {notice && <p className="admin-review-feedback success" role="status">{notice}</p>}
      {error && (
        <p className="admin-review-feedback error" role="alert">
          {error}
          <button
            type="button"
            className="admin-review-retry"
            onClick={() => {
              setLoading(true);
              setError('');
              loadProfiles(status, 0);
            }}
          >
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <div className="admin-review-empty" role="status">Loading profiles…</div>
      ) : profiles.length === 0 ? (
        <div className="admin-review-empty">
          <h2>Nothing to review here</h2>
          <p>
            {status === 'submitted'
              ? 'Submitted student profiles will appear in this queue.'
              : status === 'approved'
                ? 'There are no approved, visible profiles to manage.'
                : 'No student profiles are currently hidden.'}
          </p>
        </div>
      ) : (
        <div className="admin-review-list">
          {profiles.map((profile) => (
            <article className="admin-review-card" key={profile.studentId}>
              <div className="admin-review-card-header">
                <div>
                  <h3>{profile.fullName}</h3>
                  <p>
                    {profile.course || 'Course unavailable'}
                    {profile.yearOfStudy ? ` · Year ${profile.yearOfStudy}` : ''}
                    {profile.department ? ` · ${profile.department}` : ''}
                  </p>
                </div>
                <div className="admin-review-badges">
                  <span className={`admin-review-badge ${profile.reviewStatus}`}>
                    {profile.reviewStatus.replaceAll('_', ' ')}
                  </span>
                  {profile.moderationStatus === 'hidden' && (
                    <span className="admin-review-badge hidden">Hidden</span>
                  )}
                </div>
              </div>

              <p className="admin-review-bio">
                {profile.bio || 'No introduction provided.'}
              </p>

              <div className="admin-review-details">
                <ReviewList title="Skills" items={profile.skills.map((skill) => (
                  `${skill.name} (${skill.proficiency})`
                ))} />
                <ReviewList title="Interests" items={profile.interests} />
                <ReviewList title="Collaboration intentions" items={profile.intentions} />
              </div>

              {profile.latestReviewNotes && (
                <p className="admin-review-last-note">
                  <strong>Latest review note:</strong> {profile.latestReviewNotes}
                </p>
              )}

              {profile.reviewHistory.length > 0 && (
                <details className="admin-review-history">
                  <summary>Review history ({profile.reviewHistory.length})</summary>
                  <ol>
                    {profile.reviewHistory.map((entry, index) => (
                      <li key={`${entry.action}-${entry.createdAt}-${index}`}>
                        <strong>{entry.action.replaceAll('_', ' ')}</strong>
                        <span>
                          {entry.reviewedBy || 'Student'} · {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        {entry.notes && <p>{entry.notes}</p>}
                      </li>
                    ))}
                  </ol>
                </details>
              )}

              {profile.submittedAt && (
                <p className="admin-review-submitted">
                  Submitted {new Date(profile.submittedAt).toLocaleString()}
                </p>
              )}

              <label className="admin-review-notes-label" htmlFor={`notes-${profile.studentId}`}>
                Decision or moderation reason
              </label>
              <textarea
                id={`notes-${profile.studentId}`}
                value={notes[profile.studentId] || ''}
                onChange={(event) => setNotes((current) => ({
                  ...current,
                  [profile.studentId]: event.target.value,
                }))}
                placeholder="Required for requesting changes, hiding or restoring a profile."
                minLength={10}
                maxLength={1000}
                rows={3}
                disabled={workingStudentId !== null || bulkApproving}
              />

              <div className="admin-review-actions">
                {profile.reviewStatus === 'submitted' && (
                  <>
                    <button
                      type="button"
                      className="admin-review-primary"
                      disabled={workingStudentId !== null || bulkApproving}
                      onClick={() => runAction(profile, 'review', 'approve', false)}
                    >
                      Approve profile
                    </button>
                    <button
                      type="button"
                      className="admin-review-secondary"
                      disabled={workingStudentId !== null || bulkApproving}
                      onClick={() => runAction(profile, 'review', 'request_changes', true)}
                    >
                      Request changes
                    </button>
                  </>
                )}

                {profile.moderationStatus === 'visible' ? (
                  <button
                    type="button"
                    className="admin-review-danger"
                    disabled={workingStudentId !== null || bulkApproving}
                    onClick={() => runAction(profile, 'moderation', 'hide', true)}
                  >
                    Hide profile
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-review-secondary"
                    disabled={workingStudentId !== null}
                    onClick={() => runAction(profile, 'moderation', 'restore', true)}
                  >
                    Restore profile
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && profiles.length < totalCount && (
        <button
          type="button"
          className="admin-review-load-more"
          disabled={loadingMore || bulkApproving}
          onClick={loadMore}
        >
          {loadingMore ? 'Loading…' : 'Load more profiles'}
        </button>
      )}
    </main>
  );
}

function ReviewList({ title, items }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length > 0
        ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
        : <p>None listed</p>}
    </section>
  );
}
