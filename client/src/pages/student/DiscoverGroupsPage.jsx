import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faMagnifyingGlass, faLocationDot, faUserGroup, faArrowLeft, faPaperPlane, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
import './DiscoverGroupsPage.css';

const SCOPES = [
  { value: 'course', label: 'My course' },
  { value: 'department', label: 'My department' },
  { value: 'school', label: 'My school' },
  { value: 'university', label: 'Whole university' },
];
const YEARS = [1, 2, 3, 4];
const INTENTION_LABELS = {
  STUDY_GROUP: 'Study Group', PEER_LEARNING: 'Peer Learning Partnership', COURSEWORK: 'Coursework & Academic Assignments',
  PERSONAL_PROJECTS: 'Personal Projects', ADVANCED_PROJECTS: 'Advanced Projects',
};
const intentionLabel = (group) => group.intention_name || group.intentionName || INTENTION_LABELS[group.intention_code] || 'Collaboration';
const unwrapGroup = (payload) => payload?.group || payload?.data?.group || payload?.data || null;

export default function DiscoverGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [scope, setScope] = useState('course');
  const [memberYears, setMemberYears] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [notice, setNotice] = useState('');

  const loadGroups = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { scope };
      if (memberYears.length) params.memberYears = memberYears.join(',');
      const { data } = await api.get('/groups', { params });
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load groups.'));
    } finally { setLoading(false); }
  }, [scope, memberYears]);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;
    return groups.filter((g) => [g.group_name, g.description, g.intention_name, g.creator_name, g.course_name, g.department_name, g.faculty_name, ...(g.required_skills || [])]
      .filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [groups, search]);

  const toggleYear = (year) => setMemberYears((current) => current.includes(year) ? current.filter((v) => v !== year) : [...current, year]);

  const openDetails = async (groupId) => {
    setDetailLoading(true); setSelectedGroup({ loading: true }); setNotice(''); setRequestMessage('');
    try {
      const { data } = await api.get(`/groups/${groupId}`);
      setSelectedGroup(unwrapGroup(data));
    } catch (err) {
      setSelectedGroup(null); setNotice(getApiErrorMessage(err, 'Could not load group details.'));
    } finally { setDetailLoading(false); }
  };

  const submitRequest = async () => {
    if (!selectedGroup?.group_id) return;
    setSendingRequest(true); setNotice('');
    try {
      await api.post(`/groups/${selectedGroup.group_id}/requests`, requestMessage.trim() ? { message: requestMessage.trim() } : {});
      setSelectedGroup((current) => ({ ...current, has_pending_request: true }));
      setNotice('Your request has been sent to the group owner.');
      setGroups((current) => current.map((g) => g.group_id === selectedGroup.group_id ? { ...g, has_pending_request: true } : g));
    } catch (err) { setNotice(getApiErrorMessage(err, 'Your request could not be sent.')); }
    finally { setSendingRequest(false); }
  };

  const closeDetails = () => { setSelectedGroup(null); setNotice(''); };

  return (
    <div className="discover-groups-page">
      <div className="discover-groups-heading">
        <div>
          <h1>Discover Groups</h1>
          <p>Explore student groups that match what you want to learn or build.</p>
        </div>
      </div>

      <div className="discover-toolbar">
        <label className="discover-search"><FontAwesomeIcon icon={faMagnifyingGlass} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups, intentions or skills..." /></label>
        <label className="discover-scope"><FontAwesomeIcon icon={faLocationDot} /><span className="discover-scope-label">Groups in</span><select aria-label="Group discovery area" value={scope} onChange={(e) => setScope(e.target.value)}>{SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      </div>

      <section className="discover-filter-panel">
        <div className="discover-filter-title"><strong>Members' year of study</strong><span>Optional</span></div>
        <div className="discover-year-options">{YEARS.map((year) => <button key={year} type="button" className={memberYears.includes(year) ? 'selected' : ''} onClick={() => toggleYear(year)} aria-pressed={memberYears.includes(year)}>Year {year}</button>)}
          {memberYears.length > 0 && <button className="discover-clear" type="button" onClick={() => setMemberYears([])}>Clear</button>}
        </div>
        <small>Show groups that already have active members from the selected year(s).</small>
      </section>

      <div className="discover-results-line"><strong>{loading ? 'Loading groups...' : `${visibleGroups.length} ${visibleGroups.length === 1 ? 'group' : 'groups'} found`}</strong><button type="button" onClick={loadGroups} disabled={loading}>Refresh</button></div>

      {error && <div className="discover-alert error">{error} <button onClick={loadGroups} type="button">Try again</button></div>}
      {!loading && !error && visibleGroups.length === 0 && <div className="discover-empty"><div><FontAwesomeIcon icon={faUsers} /></div><h2>No groups found</h2><p>Try a wider discovery area or clear the year filter. New groups will appear here when students create them.</p></div>}
      {loading && <div className="discover-loading"><FontAwesomeIcon icon={faSpinner} spin /> Loading available groups...</div>}

      <div className="discover-grid">
        {visibleGroups.map((group) => {
          const count = Number(group.current_members || 0); const max = Number(group.max_members || 0);
          const full = count >= max;
          return <article className="discover-group-card" key={group.group_id}>
            <div className="discover-card-top"><span className="discover-intention">{intentionLabel(group)}</span><span className="discover-open">Open</span></div>
            <h2>{group.group_name}</h2>
            <p className="discover-card-description">{group.description || group.objectives || 'This group has not added a short description yet.'}</p>
            <div className="discover-card-meta"><span><FontAwesomeIcon icon={faUserGroup} /> {count}/{max} members</span><span>By {group.creator_name || 'Student'}</span></div>
            <div className="discover-card-location">{[group.course_name, group.department_name, group.faculty_name].filter(Boolean).join(' · ') || 'Kisii University'}</div>
            <div className="discover-skills">{(group.required_skills || []).slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}{(group.required_skills || []).length > 4 && <span>+{group.required_skills.length - 4}</span>}</div>
            <div className="discover-card-bottom"><span className={full ? 'capacity-full' : 'capacity-open'}>{full ? 'At capacity' : `${max - count} ${max - count === 1 ? 'spot' : 'spots'} left`}</span><button type="button" onClick={() => openDetails(group.group_id)}>View details <span>→</span></button></div>
          </article>;
        })}
      </div>

      {selectedGroup && <div className="discover-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDetails(); }}>
        <section className="discover-modal" role="dialog" aria-modal="true" aria-label="Group details">
          <button type="button" className="discover-modal-close" onClick={closeDetails} aria-label="Close"><FontAwesomeIcon icon={faXmark} /></button>
          {detailLoading || selectedGroup.loading ? <div className="discover-loading"><FontAwesomeIcon icon={faSpinner} spin /> Loading group details...</div> : <>
            <button className="discover-back-link" type="button" onClick={closeDetails}><FontAwesomeIcon icon={faArrowLeft} /> Back to groups</button>
            <span className="discover-intention">{intentionLabel(selectedGroup)}</span>
            <h2>{selectedGroup.group_name}</h2><p className="discover-modal-byline">Created by {selectedGroup.creator_name || 'Student'} · {selectedGroup.current_members || 0} of {selectedGroup.max_members} members</p>
            {selectedGroup.description && <p>{selectedGroup.description}</p>}
            <div className="discover-detail-block"><h3>Objectives</h3><p>{selectedGroup.objectives || 'Not provided.'}</p></div>
            <div className="discover-detail-block"><h3>Expected deliverables</h3><p>{selectedGroup.expected_deliverables || 'Not provided.'}</p></div>
            <div className="discover-detail-block"><h3>Member responsibilities</h3><p>{selectedGroup.member_responsibilities || 'Not provided.'}</p></div>
            <div className="discover-detail-block"><h3>Member expectations</h3><p>{selectedGroup.member_expectations || 'Not provided.'}</p></div>
            <div className="discover-detail-block"><h3>Required skills</h3><div className="discover-skills">{(selectedGroup.required_skills || []).length ? selectedGroup.required_skills.map((s) => <span key={s}>{s}</span>) : <p>No specific skills listed.</p>}</div></div>
            {notice && <div className="discover-alert">{notice}</div>}
            {selectedGroup.is_member ? <div className="discover-request-status">You're already a member of this group.</div> : selectedGroup.has_pending_request ? <div className="discover-request-status">Your membership request is pending.</div> : Number(selectedGroup.current_members) >= Number(selectedGroup.max_members) || selectedGroup.group_status !== 'open' ? <div className="discover-request-status">This group is not currently accepting members.</div> : <div className="discover-request-box"><label htmlFor="join-message">Message to the group owner <span>Optional</span></label><textarea id="join-message" rows="3" maxLength="1000" value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder="Briefly introduce yourself or explain why you'd like to join..."/><button type="button" onClick={submitRequest} disabled={sendingRequest}><FontAwesomeIcon icon={sendingRequest ? faSpinner : faPaperPlane} spin={sendingRequest} /> {sendingRequest ? 'Sending...' : 'Request to join'}</button></div>}
          </>}
        </section>
      </div>}
    </div>
  );
}
