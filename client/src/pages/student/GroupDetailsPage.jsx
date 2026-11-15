import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faUsers, faCalendarDays, faBullseye,
  faClipboardCheck, faListCheck, faGraduationCap,
  faCodeBranch, faSpinner, faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
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

function DetailSection({ icon, title, children }) {
  return (
    <section className="gd-section">
      <div className="gd-section-heading">
        <span><FontAwesomeIcon icon={icon} /></span>
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
    return <div className="group-details-page"><div className="gd-state"><FontAwesomeIcon icon={faSpinner} spin /> Loading group details…</div></div>;
  }

  if (error || !group) {
    return (
      <div className="group-details-page">
        <button type="button" className="gd-back" onClick={onBack}><FontAwesomeIcon icon={faArrowLeft} /> Back to My Groups</button>
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
  const isMember = group.is_member === true || group.membership_status === 'active';
  const full = String(group.group_status || '').toLowerCase() === 'full' || (maxMembers > 0 && memberCount >= maxMembers);

  return (
    <div className="group-details-page">
      <button type="button" className="gd-back" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} /> Back to My Groups
      </button>

      <header className="gd-hero">
        <div className="gd-hero-icon"><FontAwesomeIcon icon={faUsers} /></div>
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
      </header>

      <div className="gd-summary">
        <div><FontAwesomeIcon icon={faUsers} /><strong>{memberCount} / {maxMembers || '—'}</strong><span>Active members</span></div>
        <div><FontAwesomeIcon icon={faCalendarDays} /><strong>{formatDate(group.created_at)}</strong><span>Date created</span></div>
        <div><FontAwesomeIcon icon={faGraduationCap} /><strong>{group.accepts_all_years || years.length === 0 ? 'All years' : years.map((year) => `Year ${year}`).join(', ')}</strong><span>Academic eligibility</span></div>
      </div>

      {group.description && (
        <DetailSection icon={faClipboardCheck} title="About this group">
          <p className="gd-body-copy">{group.description}</p>
        </DetailSection>
      )}

      <div className="gd-content-grid">
        <DetailSection icon={faBullseye} title="Objectives">
          <p>{group.objectives || 'No objectives have been added yet.'}</p>
        </DetailSection>
        <DetailSection icon={faClipboardCheck} title="Expected deliverables">
          <p>{group.expected_deliverables || 'No expected deliverables have been added yet.'}</p>
        </DetailSection>
        <DetailSection icon={faListCheck} title="Member responsibilities">
          <p>{group.member_responsibilities || 'No responsibilities have been specified yet.'}</p>
        </DetailSection>
        <DetailSection icon={faCodeBranch} title="Member expectations">
          <p>{group.member_expectations || 'No additional expectations have been specified yet.'}</p>
        </DetailSection>
      </div>

      <DetailSection icon={faGraduationCap} title="Required skills">
        {skills.length ? (
          <div className="gd-tags">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
        ) : <p>No specific skills are required for this group.</p>}
      </DetailSection>

      {notice && <div className="gd-notice" role="alert">{notice}</div>}

      {isMember && !isOwner && (
        <div className="gd-actions">
          <p>You are an active member of this group.</p>
          <button type="button" className="gd-leave-button" onClick={leaveGroup} disabled={leaving}>
            <FontAwesomeIcon icon={leaving ? faSpinner : faRightFromBracket} spin={leaving} />
            {leaving ? 'Leaving group…' : 'Leave group'}
          </button>
        </div>
      )}

      {isOwner && (
        <div className="gd-owner-note">
          You own this group. Membership requests can be reviewed from the Membership Requests section when it is added.
        </div>
      )}
    </div>
  );
}
