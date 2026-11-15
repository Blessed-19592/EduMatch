import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/api';
import './MembershipRequestsPage.css';

const unwrapRequests = (payload) => payload?.requests || payload?.data?.requests || [];

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
};

export default function MembershipRequestsPage({ groupId, groupName, onBack, onRequestsChanged }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [processingId, setProcessingId] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/groups/${groupId}/requests`);
      setRequests(unwrapRequests(data));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load membership requests.'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const respond = async (requestId, decision) => {
    setProcessingId(requestId);
    setNotice('');
    setError('');
    try {
      await api.patch(`/groups/requests/${requestId}`, { decision });
      setNotice(decision === 'accepted' ? 'The student has been added to your group.' : 'The membership request was declined.');
      await loadRequests();
      onRequestsChanged?.();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your decision could not be saved.'));
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="membership-requests-page">
      <button type="button" className="mr-back" onClick={onBack}>Back to group details</button>
      <header className="mr-header">
        <span className="mr-eyebrow">GROUP MANAGEMENT</span>
        <h1>Membership Requests</h1>
        <p>Review students who want to join <strong>{groupName || 'your group'}</strong>.</p>
      </header>

      {notice && <div className="mr-notice" role="status">{notice}</div>}
      {error && <div className="mr-error" role="alert">{error}</div>}

      {loading ? (
        <div className="mr-state">Loading membership requests…</div>
      ) : requests.length === 0 ? (
        <div className="mr-empty">
          <h2>No pending requests</h2>
          <p>New requests to join this group will appear here.</p>
          <button type="button" onClick={loadRequests}>Refresh requests</button>
        </div>
      ) : (
        <>
          <div className="mr-list-heading">
            <h2>Pending requests</h2>
            <span>{requests.length} {requests.length === 1 ? 'request' : 'requests'}</span>
          </div>
          <div className="mr-list">
            {requests.map((request) => {
              const busy = processingId === request.request_id;
              return (
                <article className="mr-card" key={request.request_id}>
                  <div className="mr-card-top">
                    <div>
                      <h3>{request.full_name || 'Student'}</h3>
                      <p className="mr-academic-info">
                        {request.course_name || 'Course not available'}
                        {request.year_of_study ? ` · Year ${request.year_of_study}` : ''}
                      </p>
                    </div>
                    <time>{formatDate(request.created_at)}</time>
                  </div>
                  <div className="mr-message">
                    <h4>Message</h4>
                    <p>{request.message?.trim() || 'No message was included with this request.'}</p>
                  </div>
                  <div className="mr-actions">
                    <button type="button" className="mr-reject" onClick={() => respond(request.request_id, 'rejected')} disabled={Boolean(processingId)}>
                      {busy ? 'Saving…' : 'Decline'}
                    </button>
                    <button type="button" className="mr-accept" onClick={() => respond(request.request_id, 'accepted')} disabled={Boolean(processingId)}>
                      {busy ? 'Saving…' : 'Accept request'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
