import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Send } from 'lucide-react';
import api, { getApiErrorMessage } from '../../api/api';
import ImageAvatar from '../../components/ImageAvatar';
import './PublicStudentProfilePage.css';

function getSafeExternalUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function ProfileSection({ title, children }) {
  return (
    <section className="public-profile-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function formatCollaborationStatus(status) {
  if (status === 'currently_collaborating') return 'Currently collaborating';
  if (status === 'unavailable') return 'Not currently available';
  return 'Available to collaborate';
}

async function fetchPublicStudentProfile(studentId, signal) {
  const { data } = await api.get(
    `/students/${encodeURIComponent(studentId)}/profile`,
    signal ? { signal } : undefined
  );
  if (!data?.data || typeof data.data !== 'object') {
    throw new Error('The server returned an invalid student profile.');
  }
  return data.data;
}

export default function PublicStudentProfilePage({
  studentId,
  currentUserId,
  onBack
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestFeedback, setRequestFeedback] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setProfile(await fetchPublicStudentProfile(studentId));
    } catch (requestError) {
      setProfile(null);
      setError(getApiErrorMessage(
        requestError,
        'This student profile is unavailable.'
      ));
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetchPublicStudentProfile(studentId, controller.signal)
      .then((loadedProfile) => {
        if (active) setProfile(loadedProfile);
      })
      .catch((requestError) => {
        if (active) {
          setProfile(null);
          setError(getApiErrorMessage(
            requestError,
            'This student profile is unavailable.'
          ));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [studentId]);

  const handleSendRequest = async (event) => {
    event.preventDefault();
    const trimmedMessage = requestMessage.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
      setRequestFeedback('Your message must contain between 10 and 1000 characters.');
      return;
    }

    setSendingRequest(true);
    setRequestFeedback('');
    try {
      await api.post(
        `/student-collaboration-requests/${encodeURIComponent(studentId)}`,
        { message: trimmedMessage }
      );
      setRequestSent(true);
      setRequestOpen(false);
      setRequestMessage('');
    } catch (requestError) {
      setRequestFeedback(getApiErrorMessage(
        requestError,
        'Could not send the collaboration request.'
      ));
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <section className="public-profile-page">
        <button type="button" className="public-profile-back" onClick={onBack}>
          <ArrowLeft size={17} /> Back to Find Students
        </button>
        <div className="public-profile-state" role="status">Loading student profile…</div>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="public-profile-page">
        <button type="button" className="public-profile-back" onClick={onBack}>
          <ArrowLeft size={17} /> Back to Find Students
        </button>
        <div className="public-profile-state public-profile-error" role="alert">
          <p>{error || 'This student profile is unavailable.'}</p>
          <button type="button" onClick={loadProfile}>Try again</button>
        </div>
      </section>
    );
  }

  const academicDetails = [
    profile.course,
    profile.department,
    profile.faculty,
    profile.institution,
    profile.yearOfStudy ? `Year ${profile.yearOfStudy}` : null
  ].filter(Boolean);
  const portfolioItems = Array.isArray(profile.portfolios)
    ? profile.portfolios
    : [];
  const isOwnProfile = String(currentUserId) === String(studentId);
  const hasAvailabilityDetails = Boolean(
    profile.availabilityHoursPerWeek ||
    (profile.preferredMeetingMode && profile.preferredMeetingMode !== 'any') ||
    profile.preferredMeetingTimes?.length
  );

  return (
    <section className="public-profile-page">
      <button type="button" className="public-profile-back" onClick={onBack}>
        <ArrowLeft size={17} /> Back to Find Students
      </button>

      <header className="public-profile-hero">
        <ImageAvatar
          src={profile.profilePictureUrl}
          name={profile.fullName}
          colorKey={studentId}
          className="public-profile-avatar"
        />
        <div className="public-profile-identity">
          <span className="public-profile-eyebrow">STUDENT PROFILE</span>
          <h1>{profile.fullName}</h1>
          {academicDetails.length > 0 && (
            <p>{academicDetails.join(' · ')}</p>
          )}
          <span className={`public-profile-status ${profile.collaborationStatus || 'available'}`}>
            {formatCollaborationStatus(profile.collaborationStatus)}
          </span>
        </div>
      </header>

      {profile.bio && (
        <ProfileSection title="About">
          <p className="public-profile-bio">{profile.bio}</p>
        </ProfileSection>
      )}

      {profile.collaborationIntentions?.length > 0 && (
        <ProfileSection title="Looking to collaborate on">
          <div className="public-profile-tags">
            {profile.collaborationIntentions.map((intention) => (
              <span key={intention.intentionCode}>{intention.intentionName}</span>
            ))}
          </div>
        </ProfileSection>
      )}

      {profile.skills?.length > 0 && (
        <ProfileSection title="Skills">
          <div className="public-profile-tags">
            {profile.skills.map((skill) => (
              <span key={`${skill.skillName}-${skill.category}`}>
                {skill.skillName}
                {skill.proficiencyLevel ? ` · ${skill.proficiencyLevel}` : ''}
              </span>
            ))}
          </div>
        </ProfileSection>
      )}

      {profile.interests?.length > 0 && (
        <ProfileSection title="Interests">
          <div className="public-profile-tags">
            {profile.interests.map((interest) => (
              <span key={`${interest.interestName}-${interest.category}`}>
                {interest.interestName}
              </span>
            ))}
          </div>
        </ProfileSection>
      )}

      {hasAvailabilityDetails && (
        <ProfileSection title="Availability">
          <div className="public-profile-facts">
            {profile.availabilityHoursPerWeek && (
              <p><strong>Time:</strong> About {profile.availabilityHoursPerWeek} hours per week</p>
            )}
            {profile.preferredMeetingMode &&
              profile.preferredMeetingMode !== 'any' && (
                <p><strong>Meeting preference:</strong> {profile.preferredMeetingMode.replace('_', ' ')}</p>
              )}
            {profile.preferredMeetingTimes?.length > 0 && (
              <p><strong>Preferred times:</strong> {profile.preferredMeetingTimes.join(', ')}</p>
            )}
          </div>
        </ProfileSection>
      )}

      {portfolioItems.length > 0 && (
        <ProfileSection title="Portfolio">
          <div className="public-profile-portfolios">
            {portfolioItems.map((portfolio, index) => {
              const links = [
                ['View work', portfolio.evidenceUrl],
                ['Repository', portfolio.repositoryUrl],
                ['Live demo', portfolio.liveDemoUrl]
              ].map(([label, url]) => [label, getSafeExternalUrl(url)])
                .filter(([, url]) => url);

              return (
                <article
                  className="public-profile-portfolio"
                  key={`${portfolio.title}-${index}`}
                >
                  <h3>{portfolio.title}</h3>
                  {portfolio.description && <p>{portfolio.description}</p>}
                  {links.length > 0 && (
                    <div className="public-profile-links">
                      {links.map(([label, url]) => (
                        <a
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label} <ArrowUpRight size={14} />
                        </a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </ProfileSection>
      )}

      {!isOwnProfile && profile.collaborationStatus !== 'unavailable' && (
        <section className="public-profile-connect">
          {requestSent ? (
            <p role="status">Collaboration request sent.</p>
          ) : requestOpen ? (
            <form onSubmit={handleSendRequest}>
              <label htmlFor="public-profile-request-message">
                Introduce yourself and explain why you&apos;d like to collaborate.
              </label>
              <textarea
                id="public-profile-request-message"
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                minLength={10}
                maxLength={1000}
                rows={4}
                required
              />
              <div className="public-profile-request-count">
                {requestMessage.length}/1000 characters
              </div>
              {requestFeedback && <p role="alert">{requestFeedback}</p>}
              <div className="public-profile-request-actions">
                <button
                  type="button"
                  className="public-profile-secondary-button"
                  onClick={() => {
                    setRequestOpen(false);
                    setRequestFeedback('');
                  }}
                  disabled={sendingRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="public-profile-primary-button"
                  disabled={
                    sendingRequest ||
                    requestMessage.trim().length < 10 ||
                    requestMessage.length > 1000
                  }
                >
                  <Send size={16} />
                  {sendingRequest ? 'Sending…' : 'Send request'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <h2>Interested in collaborating?</h2>
                <p>Send a short introduction to start a conversation.</p>
              </div>
              <button
                type="button"
                className="public-profile-primary-button"
                onClick={() => setRequestOpen(true)}
              >
                <Send size={16} /> Request to collaborate
              </button>
            </>
          )}
        </section>
      )}
    </section>
  );
}
