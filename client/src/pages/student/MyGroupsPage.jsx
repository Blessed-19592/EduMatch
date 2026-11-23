import { useCallback, useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faSearch, faArrowRight,
  faCircleCheck, faClock, faChevronDown, faChevronUp,
} from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
import GroupDetailsPage from './GroupDetailsPage';
import './MyGroupsPage.css';

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

const intentionDescriptions = {
  'Study Group': 'Revise topics, prepare for tests and learn together.',
  'Peer Learning Partnership': 'Share knowledge and improve skills with other students.',
  'Coursework & Academic Assignments': 'Work together on assignments and academic coursework.',
  'Personal Projects': 'Build personal projects and practical experience.',
  'Advanced Projects': 'Collaborate on challenging, ambitious projects.',
};

function StatusBadge({ status }) {
  const full = String(status || '').toLowerCase() === 'full';
  return (
    <span className={`mg-status ${full ? 'is-full' : 'is-open'}`}>
      <span className="mg-status-dot" />{full ? 'Full' : 'Open'}
    </span>
  );
}

function GroupCard({ group, expanded, onToggle, onViewDetails }) {
  const memberCount = numberValue(group.current_members);
  const maxMembers = numberValue(group.max_members);
  const isOwner = group.membership_role === 'owner';
  const skills = Array.isArray(group.required_skills) ? group.required_skills : [];
  const years = Array.isArray(group.allowed_years) ? group.allowed_years : [];
  const pendingRequests = numberValue(group.pending_requests);

  return (
    <article className="mg-card">
      <div className="mg-card-topline">
        <span className={`mg-role ${isOwner ? 'owner' : 'member'}`}>{isOwner ? 'Group owner' : 'Member'}</span>
        <StatusBadge status={group.group_status} />
      </div>

      <div className="mg-card-title-row">
        <div className="mg-card-symbol"><FontAwesomeIcon icon={faUsers} /></div>
        <div className="mg-card-title">
          <h2>{group.group_name}</h2>
          <p>{group.intention_name || 'Collaboration group'}</p>
        </div>
      </div>

      <p className="mg-description">{group.description || 'No group description has been added.'}</p>

      <div className="mg-card-stats">
        <div><strong>{memberCount} <span>/ {maxMembers}</span></strong><small>Members</small></div>
        <div><strong>{formatDate(group.joined_at)}</strong><small>{isOwner ? 'Created' : 'Joined'}</small></div>
        {isOwner && <div><strong>{pendingRequests}</strong><small>Pending requests</small></div>}
      </div>

      <div className="mg-card-actions">
        <button type="button" className="mg-open-details" onClick={onViewDetails}>
          Open full details <FontAwesomeIcon icon={faArrowRight} />
        </button>
        <button
          type="button"
          className="mg-details-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide quick information' : 'Show quick information'}
          <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
        </button>
      </div>

      {expanded && (
        <div className="mg-expanded">
          {group.objectives && <div><h3>Objectives</h3><p>{group.objectives}</p></div>}
          {group.expected_deliverables && <div><h3>Expected deliverables</h3><p>{group.expected_deliverables}</p></div>}
          {group.member_responsibilities && <div><h3>Member responsibilities</h3><p>{group.member_responsibilities}</p></div>}
          {group.member_expectations && <div><h3>Member expectations</h3><p>{group.member_expectations}</p></div>}
          <div className="mg-extra-grid">
            <div>
              <h3>Required skills</h3>
              {skills.length ? <div className="mg-tags">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : <p> No specific skills listed.</p>}
            </div>
            <div>
              <h3>Eligible academic years</h3>
              <p>{group.accepts_all_years || years.length === 0 ? 'All academic years' : years.map((year) => `Year ${year}`).join(', ')}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

export default function MyGroupsPage({ onNavigate }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const loadGroups = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await api.get('/groups/my-groups');
      const rows = Array.isArray(response.data?.groups) ? response.data.groups : [];
      setGroups(rows);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Could not load your groups. Please try again.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return groups.filter((group) => {
      const matchesRole = filter === 'all'
        || (filter === 'owned' && group.membership_role === 'owner')
        || (filter === 'joined' && group.membership_role !== 'owner');
      const matchesQuery = !normalizedQuery || [group.group_name, group.description, group.intention_name]
        .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesRole && matchesQuery;
    });
  }, [groups, filter, query]);

  const ownedCount = groups.filter((group) => group.membership_role === 'owner').length;
  const joinedCount = groups.length - ownedCount;

  if (selectedGroupId) {
    return (
      <GroupDetailsPage
        groupId={selectedGroupId.group_id}
        membershipRole={selectedGroupId.membership_role}
        onBack={() => setSelectedGroupId(null)}
        onMembershipChanged={() => {
          setSelectedGroupId(null);
          loadGroups(true);
        }}
      />
    );
  }

  if (loading) {
    return <div className="my-groups-page"><div className="mg-loading">Loading your groups…</div></div>;
  }

  return (
    <div className="my-groups-page">
      <header className="mg-heading-row">
        <div>
          <h1>My groups</h1>
          <p>Keep track of the groups you have created or joined.</p>
        </div>
      </header>

      {error && (
        <div className="mg-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => loadGroups()}>Try again</button>
        </div>
      )}

      <section className="mg-summary" aria-label="Group summary">
        <div><span>Total groups</span><strong>{groups.length}</strong></div>
        <div><span>Groups you own</span><strong>{ownedCount}</strong></div>
        <div><span>Groups you joined</span><strong>{joinedCount}</strong></div>
      </section>

      <div className="mg-toolbar">
        <div className="mg-filters" role="group" aria-label="Filter groups">
          {[
            ['all', 'All groups'],
            ['owned', 'Created by me'],
            ['joined', 'Joined by me'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <label className="mg-search">
          <FontAwesomeIcon icon={faSearch} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your groups" aria-label="Search your groups" />
        </label>
      </div>

      {refreshing && <p className="mg-refresh-note">Updating your groups…</p>}

      {filteredGroups.length > 0 ? (
        <div className="mg-grid">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.group_id}
              group={group}
              expanded={expandedGroup === group.group_id}
              onToggle={() => setExpandedGroup((current) => current === group.group_id ? null : group.group_id)}
              onViewDetails={() => setSelectedGroupId(group)}
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="mg-empty">
          <div className="mg-empty-icon"><FontAwesomeIcon icon={faUsers} /></div>
          <h2>You haven't joined any groups yet</h2>
          <p>Discover a group that matches your interests, or create one and bring students together.</p>
          <div className="mg-empty-actions">
            <button type="button" className="mg-primary-button" onClick={() => onNavigate?.('Discover Groups')}>Discover groups <FontAwesomeIcon icon={faArrowRight} /></button>
            <button type="button" className="mg-secondary-button" onClick={() => onNavigate?.('Create Group')}>Create a group</button>
          </div>
        </div>
      ) : (
        <div className="mg-no-results">
          <FontAwesomeIcon icon={faCircleCheck} />
          <h2>No matching groups</h2>
          <p>Try a different search term or filter.</p>
          <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="mg-footer-note"><FontAwesomeIcon icon={faClock} /> Your membership list reflects groups where your membership is currently active.</div>
      )}
    </div>
  );
}
