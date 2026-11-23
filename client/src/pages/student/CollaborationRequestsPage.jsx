import { useCallback, useEffect, useState } from 'react';
import api from '../../api/api';
import {
  RefreshCw,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  UserRound,
  GraduationCap,
  CalendarDays,
} from 'lucide-react';

import './CollaborationRequestsPage.css';



function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    'Something went wrong. Please try again.'
  );
}

function formatDate(date) {
  if (!date) return 'Date unavailable';

  return new Date(date).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const statusConfig = {
    pending: { icon: Clock, label: 'Pending' },
    accepted: { icon: CheckCircle, label: 'Accepted' },
    declined: { icon: XCircle, label: 'Declined' },
    cancelled: { icon: XCircle, label: 'Cancelled' },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={`collaboration-status ${status}`}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

function RequestCard({
  request,
  type,
  onRespond,
  onCancel,
  processing,
}) {
  const studentName = request.full_name || 'Student';
  const studentInitials = studentName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const isReceived = type === 'received';
  const isPending = request.request_status === 'pending';

  return (
    <article className="content-card collaboration-request-card">
      <div className="collaboration-request-card-header">
        <div className="collaboration-request-student">
          <div className="collaboration-request-avatar">
            {studentInitials || <UserRound size={22} />}
          </div>

          <div>
            <h3>{studentName}</h3>

            <p>
              {request.course_name || 'Course unavailable'}
            </p>
          </div>
        </div>

        <StatusBadge status={request.request_status} />
      </div>

      <div className="collaboration-request-academics">
        {request.year_of_study && (
          <span>
            <GraduationCap size={15} />
            Year {request.year_of_study}
          </span>
        )}

        <span>
          <CalendarDays size={15} />
          {formatDate(request.created_at)}
        </span>
      </div>

      <div className="collaboration-request-message">
        <span>{isReceived ? 'Their message' : 'Your message'}</span>
        <p>{request.message}</p>
      </div>

      {isPending && (
        <div className="collaboration-request-card-actions">
          {isReceived ? (
            <>
              <button
                type="button"
                className="decline-request-button"
                onClick={() => onRespond(request.request_id, 'declined')}
                disabled={processing === request.request_id}
              >
                <XCircle size={16} />
                Decline
              </button>

              <button
                type="button"
                className="accept-request-button"
                onClick={() => onRespond(request.request_id, 'accepted')}
                disabled={processing === request.request_id}
              >
                {processing === request.request_id ? (
                  <RefreshCw size={16} className="collaboration-spinning" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Accept
              </button>
            </>
          ) : (
            <button
              type="button"
              className="decline-request-button"
              onClick={() => onCancel(request.request_id)}
              disabled={processing === request.request_id}
            >
              {processing === request.request_id ? (
                <RefreshCw size={16} className="collaboration-spinning" />
              ) : (
                <XCircle size={16} />
              )}
              Cancel Request
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function CollaborationRequestsPage() {
  const [activeTab, setActiveTab] = useState('received');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/student-collaboration-requests', {
  params: { type: activeTab },
});

      setRequests(response.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleRespond(requestId, decision) {
    const action = decision === 'accepted' ? 'accept' : 'decline';

    if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
      return;
    }

    setProcessing(requestId);
    setError('');

    try {
      await api.patch(
  `/student-collaboration-requests/${requestId}/respond`,
  { decision }
);

      await fetchRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessing(null);
    }
  }

  async function handleCancel(requestId) {
    if (!window.confirm('Are you sure you want to cancel this request?')) {
      return;
    }

    setProcessing(requestId);
    setError('');

    try {
      await api.patch(
  `/student-collaboration-requests/${requestId}/cancel`,
  {}
);

      await fetchRequests();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setProcessing(null);
    }
  }

  return (
    <section className="collaboration-requests-page">
      <div className="collaboration-requests-heading">
        <div>
          <h1>Collaboration Requests</h1>
          <p>
            Manage invitations from other students and track
            the requests you've sent. Lists update when you switch tabs.
          </p>
        </div>
      </div>

      <div className="collaboration-request-tabs">
        <button
          type="button"
          className={activeTab === 'received' ? 'active' : ''}
          onClick={() => setActiveTab('received')}
        >
          Received
        </button>

        <button
          type="button"
          className={activeTab === 'sent' ? 'active' : ''}
          onClick={() => setActiveTab('sent')}
        >
          Sent
        </button>
      </div>

      <div className="collaboration-requests-results">
        <div className="collaboration-requests-results-heading">
          <div>
            <h2>
              {activeTab === 'received'
                ? 'Received requests'
                : 'Sent requests'}
            </h2>

            <p>
              {activeTab === 'received'
                ? 'Students who want to collaborate with you.'
                : 'Students you have invited to collaborate.'}
            </p>
          </div>

          {!loading && !error && (
            <span className="collaboration-requests-count">
              {requests.length}{' '}
              {requests.length === 1 ? 'request' : 'requests'}
            </span>
          )}
        </div>

        {error && (
          <div className="collaboration-requests-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>

            <button type="button" onClick={fetchRequests}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="content-card collaboration-requests-empty">
            <RefreshCw
              size={25}
              className="collaboration-spinning"
            />
            <h3>Loading requests...</h3>
          </div>
        ) : !error && requests.length === 0 ? (
          <div className="content-card collaboration-requests-empty">
            <div className="collaboration-empty-icon">
              <Users size={28} />
            </div>

            <h3>
              {activeTab === 'received'
                ? 'No received requests yet'
                : 'You haven\'t sent any requests'}
            </h3>

            <p>
              {activeTab === 'received'
                ? 'When another student invites you to collaborate, their request will appear here.'
                : 'Find students whose interests and skills complement yours and invite them to collaborate.'}
            </p>
          </div>
        ) : !error ? (
          <div className="collaboration-requests-list">
            {requests.map((request) => (
              <RequestCard
                key={request.request_id}
                request={request}
                type={activeTab}
                onRespond={handleRespond}
                onCancel={handleCancel}
                processing={processing}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}