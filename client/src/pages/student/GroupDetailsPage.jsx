import { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
import ImageAvatar from '../../components/ImageAvatar';
import MembershipRequestsPage from './MembershipRequestsPage';
import GroupInvitationPanel from './GroupInvitationPanel';
import './GroupDetailsPage.css';

const unwrapGroup = (payload) => payload?.group || payload?.data?.group || payload?.data || null;
const asArray = (value) => Array.isArray(value) ? value : [];

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

function DetailSection({ title, children }) {
  return (
    <section className="gd-section">
      <div className="gd-section-heading">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function GroupDetailsPage({ groupId, membershipRole, onBack, onMembershipChanged }) {
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [pictureUploading, setPictureUploading] = useState(false);
  const [pictureFeedback, setPictureFeedback] = useState(null);
  const pictureInput = useRef(null);
  const pictureFeedbackTimer = useRef(null);
  const [showRequests, setShowRequests] = useState(false);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/groups/${groupId}`);
      setGroup(unwrapGroup(data));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load group details.'));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { loadDetails(); }, [loadDetails]);

  useEffect(() => () => {
    if (pictureFeedbackTimer.current) {
      window.clearTimeout(pictureFeedbackTimer.current);
    }
  }, []);

  const uploadPicture = async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (pictureFeedbackTimer.current) {
      window.clearTimeout(pictureFeedbackTimer.current);
      pictureFeedbackTimer.current = null;
    }
    setPictureUploading(true);
    setPictureFeedback(null);

    try {
      const params = new URLSearchParams({
        name: file.name,
        type: file.type,
      });
      const response = await api.post(
        `/groups/${groupId}/picture?${params.toString()}`,
        await file.arrayBuffer(),
        { headers: { 'Content-Type': 'application/octet-stream' } }
      );
      const pictureUrl = response.data?.data?.groupPictureUrl;

      if (!pictureUrl) {
        throw new Error('The server did not confirm the uploaded picture.');
      }

      setGroup(current => ({
        ...current,
        group_picture_url: `${pictureUrl}?v=${Date.now()}`,
      }));
      setPictureFeedback({
        type: 'success',
        message: 'Group picture updated successfully.',
      });
      pictureFeedbackTimer.current = window.setTimeout(() => {
        setPictureFeedback(null);
        pictureFeedbackTimer.current = null;
      }, 3500);
    } catch (requestError) {
      setPictureFeedback({
        type: 'error',
        message: getApiErrorMessage(requestError, 'Could not upload the group picture.'),
      });
    } finally {
      setPictureUploading(false);
      input.value = '';
    }
  };

  const leaveGroup = async () => {
    const confirmed = window.confirm('Are you sure you want to leave this group?');
    if (!confirmed) return;

    setLeaving(true);
    setNotice('');
    try {
      await api.delete(`/groups/${groupId}/membership`);
      onMembershipChanged?.();
    } catch (requestError) {
      setNotice(getApiErrorMessage(requestError, 'You could not leave this group.'));
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return <div className="group-details-page"><div className="gd-state">Loading group details…</div></div>;
  }

  if (error || !group) {
    return (
      <div className="group-details-page">
        <button type="button" className="gd-back" onClick={onBack}>Back to My Groups</button>
        <div className="gd-state gd-error" role="alert">
          <p>{error || 'This group could not be found.'}</p>
          <button type="button" onClick={loadDetails}>Try again</button>
        </div>
      </div>
    );
  }

  const skills = asArray(group.required_skills);
  const years = asArray(group.allowed_years);
  const memberCount = Number(group.current_members) || 0;
  const maxMembers = Number(group.max_members) || 0;
  const isOwner = membershipRole === 'owner' || group.membership_role === 'owner' || group.is_owner === true;

  if (showRequests && isOwner) {
    return (
      <MembershipRequestsPage
        groupId={groupId}
        groupName={group.group_name}
        onBack={() => setShowRequests(false)}
        onRequestsChanged={loadDetails}
      />
    );
  }

  const isMember = group.is_member === true || group.membership_status === 'active';
  const groupStatus = String(group.group_status || '').toLowerCase();
  const full = groupStatus === 'full' || (maxMembers > 0 && memberCount >= maxMembers);
  const isOpen = groupStatus === 'open' && !full;

  return (
    <div className="group-details-page">
      <button type="button" className="gd-back" onClick={onBack}>Back to My Groups</button>

      <header className="gd-hero">
        <ImageAvatar
          src={group.group_picture_url}
          name={group.group_name}
          className="gd-hero-icon"
          fallback={<FontAwesomeIcon icon={faUsers} />}
        />
        <div className="gd-hero-copy">
          <span className="gd-eyebrow">GROUP OVERVIEW</span>
          <h1>{group.group_name}</h1>
          <p>{group.intention_name || 'Student collaboration group'}</p>
          <div className="gd-badges">
            <span className={full ? 'gd-badge full' : 'gd-badge open'}>{full ? 'Full' : 'Open'}</span>
            {isOwner && <span className="gd-badge owner">You are the owner</span>}
            {isMember && !isOwner && <span className="gd-badge member">You are a member</span>}
          </div>
        </div>
        {isOwner && (
          <div className="gd-picture-control">
            <input
              ref={pictureInput}
              className="gd-picture-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose a group picture"
              disabled={pictureUploading}
              onChange={uploadPicture}
            />
            <button
              type="button"
              className="gd-picture-button"
              disabled={pictureUploading}
              onClick={() => pictureInput.current?.click()}
            >
              {pictureUploading
                ? 'Uploading…'
                : group.group_picture_url
                  ? 'Change group picture'
                  : 'Add group picture'}
            </button>
            <small>JPG, PNG, or WebP. Maximum file size: 5 MB.</small>
          </div>
        )}
      </header>

      {pictureFeedback && (
        <div
          className={`gd-picture-feedback ${pictureFeedback.type}`}
          role={pictureFeedback.type === 'error' ? 'alert' : 'status'}
        >
          {pictureFeedback.message}
        </div>
      )}

      <div className="gd-summary">
        <div><strong>{memberCount} / {maxMembers || '—'}</strong><span>Active members</span></div>
        <div><strong>{formatDate(group.created_at)}</strong><span>Date created</span></div>
        <div><strong>{group.accepts_all_years || years.length === 0 ? 'All years' : years.map((year) => `Year ${year}`).join(', ')}</strong><span>Academic eligibility</span></div>
      </div>

      {group.description && (
        <DetailSection title="About this group">
          <p className="gd-body-copy">{group.description}</p>
        </DetailSection>
      )}

      <div className="gd-content-grid">
        <DetailSection title="Objectives">
          <p>{group.objectives || 'No objectives have been added yet.'}</p>
        </DetailSection>
        <DetailSection title="Expected deliverables">
          <p>{group.expected_deliverables || 'No expected deliverables have been added yet.'}</p>
        </DetailSection>
        <DetailSection title="Member responsibilities">
          <p>{group.member_responsibilities || 'No responsibilities have been specified yet.'}</p>
        </DetailSection>
        <DetailSection title="Member expectations">
          <p>{group.member_expectations || 'No additional expectations have been specified yet.'}</p>
        </DetailSection>
      </div>

      <DetailSection title="Required skills">
        {skills.length ? (
          <div className="gd-tags">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        ) : <p>No specific skills are required for this group.</p>}
      </DetailSection>

      {notice && <div className="gd-notice" role="alert">{notice}</div>}

      {isMember && !isOwner && (
        <div className="gd-actions">
          <p>You are an active member of this group.</p>
          <button type="button" className="gd-leave-button" onClick={leaveGroup} disabled={leaving}>
            {leaving ? 'Leaving group…' : 'Leave group'}
          </button>
        </div>
      )}

      {isOwner && (
        <>
          <div className="gd-owner-note">
            <div>
              <strong>Manage membership requests</strong>
              <p>Review students who have asked to join this group.</p>
            </div>
            <button type="button" className="gd-requests-button" onClick={() => setShowRequests(true)}>
              View requests
            </button>
          </div>

          {isOpen && (
            <GroupInvitationPanel groupId={groupId} />
          )}
        </>
      )}
    </div>
  );
}
