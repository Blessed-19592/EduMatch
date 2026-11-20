import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/api';
import './GroupInvitationsPage.css';

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
        declined: 'Declined',
        cancelled: 'Cancelled',
    };

    return labels[status] || status;
};

export default function GroupInvitationsPage() {
    const [activeTab, setActiveTab] = useState('received');
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [notice, setNotice] = useState('');

    const loadInvitations = useCallback(async () => {
        try {
            setLoading(true);
            setError('');

            const { data } = await api.get(
                `/group-invitations?type=${activeTab}`
            );

            setInvitations(data?.data?.invitations || []);
        } catch (requestError) {
            setError(
                getApiErrorMessage(
                    requestError,
                    'Could not load group invitations.'
                )
            );
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadInvitations();
    }, [loadInvitations]);

    const respondToInvitation = async (invitationId, decision) => {
        const action = decision === 'accepted' ? 'accept' : 'decline';

        if (!window.confirm(`Are you sure you want to ${action} this invitation?`)) {
            return;
        }

        try {
            setProcessingId(invitationId);
            setError('');
            setNotice('');

            const { data } = await api.patch(
                `/group-invitations/${invitationId}/respond`,
                { decision }
            );

            setNotice(data.message || `Invitation ${decision} successfully.`);
            await loadInvitations();
        } catch (requestError) {
            setError(
                getApiErrorMessage(
                    requestError,
                    'Could not process this invitation.'
                )
            );
        } finally {
            setProcessingId(null);
        }
    };

    const cancelInvitation = async (invitationId) => {
        if (!window.confirm('Are you sure you want to cancel this invitation?')) {
            return;
        }

        try {
            setProcessingId(invitationId);
            setError('');
            setNotice('');

            const { data } = await api.patch(
                `/group-invitations/${invitationId}/cancel`
            );

            setNotice(data.message || 'Invitation cancelled successfully.');
            await loadInvitations();
        } catch (requestError) {
            setError(
                getApiErrorMessage(
                    requestError,
                    'Could not cancel this invitation.'
                )
            );
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="group-invitations-page">
            <header className="gi-header">
                <div>
                    <span className="gi-eyebrow">REQUEST MANAGEMENT</span>
                    <h1>Group Invitations</h1>
                    <p>
                        Manage invitations to join student collaboration groups.
                    </p>
                </div>
            </header>

            <div className="gi-tabs" role="tablist" aria-label="Invitation categories">
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
                <div className="gi-alert success" role="status">
                    {notice}
                </div>
            )}

            {error && (
                <div className="gi-alert error" role="alert">
                    {error}
                    <button type="button" onClick={loadInvitations}>
                        Try again
                    </button>
                </div>
            )}

            {loading ? (
                <div className="gi-state">
                    Loading invitations...
                </div>
            ) : invitations.length === 0 ? (
                <div className="gi-empty-state">
                    <div className="gi-empty-icon">↗</div>
                    <h2>
                        {activeTab === 'received'
                            ? 'No invitations received'
                            : 'No invitations sent'}
                    </h2>
                    <p>
                        {activeTab === 'received'
                            ? 'When someone invites you to join their group, the invitation will appear here.'
                            : 'Invitations you send to eligible collaborators will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="gi-list">
                    {invitations.map((invitation) => {
                        const isPending =
                            invitation.invitation_status === 'pending';

                        const isProcessing =
                            processingId === invitation.invitation_id;

                        return (
                            <article
                                className="gi-card"
                                key={invitation.invitation_id}
                            >
                                <div className="gi-card-top">
                                    <div className="gi-card-info">
                                        <span className="gi-type-label">
                                            GROUP INVITATION
                                        </span>

                                        <h2>{invitation.group_name}</h2>

                                        <p className="gi-person">
                                            {activeTab === 'received'
                                                ? 'Invited by '
                                                : 'Invited '}
                                            <strong>
                                                {invitation.other_student_name}
                                            </strong>
                                        </p>
                                    </div>

                                    <span
                                        className={`gi-status ${invitation.invitation_status}`}
                                    >
                                        {statusLabel(invitation.invitation_status)}
                                    </span>
                                </div>

                                {invitation.message && (
                                    <div className="gi-message">
                                        <span>Message</span>
                                        <p>{invitation.message}</p>
                                    </div>
                                )}

                                <div className="gi-card-footer">
                                    <span className="gi-date">
                                        {formatDate(invitation.created_at)}
                                    </span>

                                    {isPending && activeTab === 'received' && (
                                        <div className="gi-actions">
                                            <button
                                                type="button"
                                                className="gi-decline-button"
                                                disabled={isProcessing}
                                                onClick={() =>
                                                    respondToInvitation(
                                                        invitation.invitation_id,
                                                        'declined'
                                                    )
                                                }
                                            >
                                                Decline
                                            </button>

                                            <button
                                                type="button"
                                                className="gi-accept-button"
                                                disabled={isProcessing}
                                                onClick={() =>
                                                    respondToInvitation(
                                                        invitation.invitation_id,
                                                        'accepted'
                                                    )
                                                }
                                            >
                                                {isProcessing
                                                    ? 'Processing...'
                                                    : 'Accept invitation'}
                                            </button>
                                        </div>
                                    )}

                                    {isPending && activeTab === 'sent' && (
                                        <button
                                            type="button"
                                            className="gi-cancel-button"
                                            disabled={isProcessing}
                                            onClick={() =>
                                                cancelInvitation(
                                                    invitation.invitation_id
                                                )
                                            }
                                        >
                                            {isProcessing
                                                ? 'Cancelling...'
                                                : 'Cancel invitation'}
                                        </button>
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