import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/api';
import './MembershipRequestsInboxPage.css';

const formatDate = (value) => {
    if (!value) return 'Recently';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Recently';

    return new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(date);
};

const statusLabel = (status) => {
    const labels = {
        pending: 'Pending',
        accepted: 'Accepted',
        rejected: 'Rejected',
    };

    return labels[status] || status;
};

export default function MembershipRequestsPage() {
    const [activeTab, setActiveTab] = useState('received');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const { data } = await api.get(
                `/groups/requests?type=${activeTab}`
            );

            setRequests(data?.data?.requests || []);
        } catch (requestError) {
            setError(
                getApiErrorMessage(
                    requestError,
                    'Could not load membership requests.'
                )
            );
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const respondToRequest = async (requestId, decision) => {
        const action = decision === 'accepted' ? 'accept' : 'reject';

        if (!window.confirm(`Are you sure you want to ${action} this request?`)) {
            return;
        }

        try {
            setProcessingId(requestId);
            setError('');
            setNotice('');

            const { data } = await api.patch(
                `/groups/requests/${requestId}`,
                { decision }
            );

            setNotice(data.message || `Request ${decision} successfully.`);

            await loadRequests();
        } catch (requestError) {
            setError(
                getApiErrorMessage(
                    requestError,
                    'Could not process this membership request.'
                )
            );
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="membership-requests-page">
            <header className="mr-header">
                <div>
                    <span className="mr-eyebrow">REQUEST MANAGEMENT</span>
                    <h1>Membership Requests</h1>
                    <p>
                        Manage requests to join your groups and track
                        the requests you have submitted.
                    </p>
                </div>
            </header>

            <div className="mr-tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'received'}
                    className={activeTab === 'received' ? 'active' : ''}
                    onClick={() => {
                        setActiveTab('received');
                        setNotice('');
                    }}
                >
                    Received
                </button>

                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'sent'}
                    className={activeTab === 'sent' ? 'active' : ''}
                    onClick={() => {
                        setActiveTab('sent');
                        setNotice('');
                    }}
                >
                    Sent
                </button>
            </div>

            {notice && (
                <div className="mr-alert success" role="status">
                    {notice}
                </div>
            )}

            {error && (
                <div className="mr-alert error" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={loadRequests}>
                        Try again
                    </button>
                </div>
            )}

            {loading ? (
                <div className="mr-state">Loading membership requests...</div>
            ) : requests.length === 0 ? (
                <div className="mr-empty-state">
                    <div className="mr-empty-icon">↗</div>

                    <h2>
                        {activeTab === 'received'
                            ? 'No membership requests received'
                            : 'No membership requests sent'}
                    </h2>

                    <p>
                        {activeTab === 'received'
                            ? 'When students request to join your groups, their requests will appear here.'
                            : 'Requests you submit to join other groups will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="mr-list">
                    {requests.map((request) => {
                        const isPending =
                            request.request_status === 'pending';

                        const isProcessing =
                            processingId === request.request_id;

                        return (
                            <article
                                className="mr-card"
                                key={request.request_id}
                            >
                                <div className="mr-card-top">
                                    <div className="mr-card-info">
                                        
                                        <h2>{request.group_name}</h2>

                                        <p className="mr-person">
                                            {activeTab === 'received'
                                                ? 'Requested by '
                                                : 'Group owner: '}

                                            <strong>
                                                {request.other_student_name}
                                            </strong>
                                        </p>
                                    </div>

                                    <span
                                        className={`mr-status ${request.request_status}`}
                                    >
                                        {statusLabel(request.request_status)}
                                    </span>
                                </div>

                                {request.message && (
                                    <div className="mr-message">
                                        <span>Message</span>
                                        <p>{request.message}</p>
                                    </div>
                                )}

                                <div className="mr-card-footer">
                                    <span className="mr-date">
                                        {formatDate(request.created_at)}
                                    </span>

                                    {isPending &&
                                        activeTab === 'received' && (
                                            <div className="mr-actions">
                                                <button
                                                    type="button"
                                                    className="mr-reject-button"
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                        respondToRequest(
                                                            request.request_id,
                                                            'rejected'
                                                        )
                                                    }
                                                >
                                                    Reject
                                                </button>

                                                <button
                                                    type="button"
                                                    className="mr-accept-button"
                                                    disabled={isProcessing}
                                                    onClick={() =>
                                                        respondToRequest(
                                                            request.request_id,
                                                            'accepted'
                                                        )
                                                    }
                                                >
                                                    {isProcessing
                                                        ? 'Processing...'
                                                        : 'Accept request'}
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}