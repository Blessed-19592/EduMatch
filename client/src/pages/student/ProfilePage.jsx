import { useCallback, useEffect, useMemo, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/api';
import './ProfilePage.css';

const AVAILABILITY = ['Weekdays', 'Weekends', 'Evenings', 'Flexible'];
const SKILLS_PREVIEW_LIMIT = 6;
const INTERESTS_PREVIEW_LIMIT = 8;
const INTENTION_ORDER = [
  'STUDY_GROUP', 'PEER_LEARNING', 'COURSEWORK', 'PERSONAL_PROJECTS', 'ADVANCED_PROJECTS',
];
const INTENTION_DESCRIPTIONS = {
  STUDY_GROUP: 'Revise topics, prepare for tests and learn together.',
  PEER_LEARNING: 'Share knowledge and improve skills with other students.',
  COURSEWORK: 'Work together on assignments and academic coursework.',
  PERSONAL_PROJECTS: 'Build personal projects and practical experience.',
  ADVANCED_PROJECTS: 'Collaborate on challenging, ambitious projects.',
};
const EMPTY_PREFERENCES = {
  preferredExperienceLevel: 'any',
  preferredCommitmentLevel: 'any',
  preferredWorkingStyle: 'any',
  additionalPreferences: '',
  preferredSkillIds: [],
  preferredFacultyIds: [],
  preferredDepartmentIds: [],
  preferredCourseIds: [],
};

const getArray = (payload, key) => {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};
const pick = (object, camel, snake, fallback = '') => object?.[camel] ?? object?.[snake] ?? fallback;

function SectionHeading({ title, description }) {
  return (
    <div className="profile-section-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function ChoiceChips({ options, value, onChange, multiple = false, disabled = false }) {
  const selected = multiple ? value : [value];
  const toggle = (option) => {
    if (disabled) return;
    if (multiple) {
      onChange(selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option]);
    } else onChange(option);
  };
  return (
    <div className="profile-choice-list">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          className={`profile-choice ${selected.includes(option) ? 'selected' : ''}`}
          onClick={() => toggle(option)}
          disabled={disabled}
          aria-pressed={selected.includes(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState(null);
  const [skillsCatalog, setSkillsCatalog] = useState([]);
  const [interestCatalog, setInterestCatalog] = useState([]);
  const [intentionsCatalog, setIntentionsCatalog] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [interestsExpanded, setInterestsExpanded] = useState(false);
  const [selectedIntentions, setSelectedIntentions] = useState([]);
  const [preferences, setPreferences] = useState(EMPTY_PREFERENCES);
  const [skillSearch, setSkillSearch] = useState('');
  const [interestSearch, setInterestSearch] = useState('');

  const [form, setForm] = useState({
    bio: '', collaborationStatus: 'available', preferredMeetingMode: 'any',
    preferredMeetingTimes: [], commitmentLevel: 'flexible',
  });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [profileRes, skillsRes, mySkillsRes, interestsRes, myInterestsRes, intentionsRes, myIntentionsRes, preferencesRes] = await Promise.all([
        api.get('/students/me/profile'),
        api.get('/catalog/skills'),
        api.get('/me/skills'),
        api.get('/catalog/interests'),
        api.get('/me/interests'),
        api.get('/catalog/collaboration-intentions'),
        api.get('/me/intentions'),
        api.get('/students/me/partner-preferences'),
      ]);

      const p = profileRes.data?.data || {};
      setProfile(p);
      setForm({
        bio: p.bio || '',
        collaborationStatus: p.collaboration_status || 'available',
        preferredMeetingMode: p.preferred_meeting_mode || 'any',
        preferredMeetingTimes: Array.isArray(p.preferred_meeting_times) ? p.preferred_meeting_times : [],
        commitmentLevel: p.commitment_level || 'flexible',
      });
      setSkillsCatalog(getArray(skillsRes.data));
      setSelectedSkills(getArray(mySkillsRes.data).map((item) => ({
        skillId: item.skill_id,
        skillName: item.skill_name,
        proficiencyLevel: item.proficiency_level || 'beginner',
      })));
      setInterestCatalog(getArray(interestsRes.data));
      setSelectedInterests(getArray(myInterestsRes.data).map((item) => item.interest_id));
      const catalogIntentions = Array.isArray(intentionsRes.data?.intentions) ? intentionsRes.data.intentions : [];
      setIntentionsCatalog(catalogIntentions.sort((a, b) => {
        const ai = INTENTION_ORDER.indexOf(a.intention_code);
        const bi = INTENTION_ORDER.indexOf(b.intention_code);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      }));
      setSelectedIntentions((Array.isArray(myIntentionsRes.data?.intentions) ? myIntentionsRes.data.intentions : []).map((item) => item.intention_id));

      const rawPrefs = preferencesRes.data?.data || {};
      setPreferences({
        preferredExperienceLevel: pick(rawPrefs, 'preferredExperienceLevel', 'preferred_experience_level', 'any'),
        preferredCommitmentLevel: pick(rawPrefs, 'preferredCommitmentLevel', 'preferred_commitment_level', 'any'),
        preferredWorkingStyle: pick(rawPrefs, 'preferredWorkingStyle', 'preferred_working_style', 'any'),
        additionalPreferences: pick(rawPrefs, 'additionalPreferences', 'additional_preferences', ''),
        preferredSkillIds: rawPrefs.preferredSkillIds || rawPrefs.preferred_skill_ids || (rawPrefs.preferredSkills || []).map((item) => item.skillId),
        preferredFacultyIds: rawPrefs.preferredFacultyIds || rawPrefs.preferred_faculty_ids || (rawPrefs.preferredFaculties || []).map((item) => item.facultyId),
        preferredDepartmentIds: rawPrefs.preferredDepartmentIds || rawPrefs.preferred_department_ids || (rawPrefs.preferredDepartments || []).map((item) => item.departmentId),
        preferredCourseIds: rawPrefs.preferredCourseIds || rawPrefs.preferred_course_ids || (rawPrefs.preferredCourses || []).map((item) => item.courseId),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not load your profile. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const locked = profile?.profile_review_status === 'submitted';
  const visibleSkills = useMemo(() => skillsCatalog.filter((item) =>
    `${item.skill_name} ${item.category}`.toLowerCase().includes(skillSearch.toLowerCase())), [skillsCatalog, skillSearch]);
  const visibleInterests = useMemo(() => interestCatalog.filter((item) =>
    `${item.interest_name} ${item.interest_category}`.toLowerCase().includes(interestSearch.toLowerCase())), [interestCatalog, interestSearch]);
  const displayedSkills = skillsExpanded
    ? visibleSkills
    : visibleSkills.slice(0, SKILLS_PREVIEW_LIMIT);
  const displayedInterests = interestsExpanded
    ? visibleInterests
    : visibleInterests.slice(0, INTERESTS_PREVIEW_LIMIT);

  const saveSection = async (section, request, successMessage) => {
    setSaving(section); setError(''); setNotice('');
    try {
      await request();
      setNotice(successMessage);
      if (section === 'profile') {
        const refreshed = await api.get('/students/me/profile');
        setProfile(refreshed.data?.data || profile);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Your changes could not be saved.'));
    } finally { setSaving(''); }
  };

  const toggleSkill = (skill) => {
    setSelectedSkills((current) => current.some((item) => item.skillId === skill.skill_id)
      ? current.filter((item) => item.skillId !== skill.skill_id)
      : [...current, { skillId: skill.skill_id, skillName: skill.skill_name, proficiencyLevel: 'beginner' }]);
  };
  const updateSkillLevel = (skillId, proficiencyLevel) => setSelectedSkills((current) => current.map((item) => item.skillId === skillId ? { ...item, proficiencyLevel } : item));

  if (loading) return <div className="profile-loading"><span>Loading your profile…</span></div>;

  if (!profile && error) return (
    <div className="profile-page"><div className="profile-alert error">{error}<button type="button" onClick={loadProfile}>Retry</button></div></div>
  );

  return (
    <div className="profile-page">
      <div className="profile-page-header">
        <div>
          <h1>My Profile</h1>
          <p>Tell other students what you know, what interests you and how you like to collaborate.</p>
        </div>
        <div className={`profile-status status-${profile?.profile_review_status || 'draft'}`}>
          <span />{(profile?.profile_review_status || 'draft').replaceAll('_', ' ')}
        </div>
      </div>

      {error && <div className="profile-alert error" role="alert">{error}</div>}
      {notice && <div className="profile-alert success" role="status">{notice}</div>}
      {locked && <div className="profile-lock-notice"><div><strong>Your profile is under review</strong><p>You can view your information, but editing is temporarily disabled until the review is complete.</p></div></div>}

      <section className="profile-card">
        <SectionHeading title="Personal & academic information" description="Your academic identity comes from the university student registry." />
        <div className="profile-identity-grid">
          <ReadOnlyField label="Full name" value={profile?.full_name} />
          <ReadOnlyField label="Registration number" value={profile?.registration_number} />
          <ReadOnlyField label="University email" value={profile?.email} />
          <ReadOnlyField label="Institution" value={profile?.institution_name} />
          <ReadOnlyField label="Faculty / School" value={profile?.faculty_name} />
          <ReadOnlyField label="Department" value={profile?.department_name} />
          <ReadOnlyField label="Course" value={profile?.course_name} />
          <ReadOnlyField label="Year of study" value={profile?.year_of_study ? `Year ${profile.year_of_study}` : ''} />
        </div>
        <div className="profile-field profile-bio-field">
          <label htmlFor="profile-bio">A little about you</label>
          <textarea id="profile-bio" rows="4" maxLength="1000" value={form.bio} disabled={locked} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Introduce yourself, your academic interests or what you enjoy learning…" />
          <small>{form.bio.length}/1000 characters</small>
        </div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'profile'} disabled={locked || !!saving} onClick={() => saveSection('profile', () => api.patch('/students/me/profile', { bio: form.bio || null }), 'Personal information saved.')}>{saving === 'profile' ? 'Saving…' : 'Save personal information'}</button></div>
      </section>

      <section className="profile-card">
        <SectionHeading title="Skills & proficiency" description="Choose skills you can contribute and indicate your current proficiency." />
        <div className="profile-search"><input value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search skills…" aria-label="Search skills" /></div>
        <div className="profile-catalog-list" id="profile-skills-list">
          {displayedSkills.map((skill) => {
            const chosen = selectedSkills.find((item) => item.skillId === skill.skill_id);
            return <div className={`profile-catalog-row ${chosen ? 'chosen' : ''}`} key={skill.skill_id}>
              <button type="button" className="profile-catalog-select" disabled={locked} onClick={() => toggleSkill(skill)}><span className="profile-checkbox" aria-hidden="true" /><span><strong>{skill.skill_name}</strong><small>{skill.category}</small></span></button>
              {chosen && <select aria-label={`Proficiency in ${skill.skill_name}`} disabled={locked} value={chosen.proficiencyLevel} onChange={(e) => updateSkillLevel(skill.skill_id, e.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select>}
            </div>;
          })}
          {visibleSkills.length === 0 && <p className="profile-empty-hint">No matching skills found in the catalogue.</p>}
        </div>
        {visibleSkills.length > SKILLS_PREVIEW_LIMIT && <button type="button" className="profile-expand-button" aria-expanded={skillsExpanded} aria-controls="profile-skills-list" onClick={() => setSkillsExpanded((expanded) => !expanded)}>{skillsExpanded ? 'Show less' : `Show ${visibleSkills.length - SKILLS_PREVIEW_LIMIT} more skills`}</button>}
        <div className="profile-selection-summary">{selectedSkills.length} skill{selectedSkills.length === 1 ? '' : 's'} selected · Up to 50</div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'skills'} disabled={locked || !!saving || selectedSkills.length > 50} onClick={() => saveSection('skills', () => api.put('/me/skills', { skills: selectedSkills.map(({ skillId, proficiencyLevel }) => ({ skillId, proficiencyLevel })) }), 'Skills and proficiency saved.')}>{saving === 'skills' ? 'Saving…' : 'Save skills'}</button></div>
      </section>

      <section className="profile-card">
        <SectionHeading title="Interests" description="Select subjects and activities you would enjoy exploring with other students." />
        <div className="profile-search"><input value={interestSearch} onChange={(e) => setInterestSearch(e.target.value)} placeholder="Search interests…" aria-label="Search interests" /></div>
        <div className="profile-tag-grid" id="profile-interests-list">
          {displayedInterests.map((interest) => {
            const chosen = selectedInterests.includes(interest.interest_id);
            return <button type="button" key={interest.interest_id} disabled={locked} className={`profile-tag ${chosen ? 'selected' : ''}`} onClick={() => setSelectedInterests((current) => chosen ? current.filter((id) => id !== interest.interest_id) : [...current, interest.interest_id])}>{interest.interest_name}<small>{interest.interest_category}</small></button>;
          })}
        </div>
        {visibleInterests.length > INTERESTS_PREVIEW_LIMIT && <button type="button" className="profile-expand-button" aria-expanded={interestsExpanded} aria-controls="profile-interests-list" onClick={() => setInterestsExpanded((expanded) => !expanded)}>{interestsExpanded ? 'Show less' : `Show ${visibleInterests.length - INTERESTS_PREVIEW_LIMIT} more interests`}</button>}
        <div className="profile-selection-summary">{selectedInterests.length} selected · Up to 30</div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'interests'} disabled={locked || !!saving || selectedInterests.length > 30} onClick={() => saveSection('interests', () => api.put('/me/interests', { interestIds: selectedInterests }), 'Interests saved.')}>{saving === 'interests' ? 'Saving…' : 'Save interests'}</button></div>
      </section>

      <section className="profile-card">
        <SectionHeading title="Collaboration intentions" description="Choose one or more reasons you want to connect with other students." />
        <div className="profile-intention-grid">
          {intentionsCatalog.map((item) => {
            const chosen = selectedIntentions.includes(item.intention_id);
            return <button type="button" key={item.intention_id} disabled={locked} className={`profile-intention ${chosen ? 'selected' : ''}`} onClick={() => setSelectedIntentions((current) => chosen ? current.filter((id) => id !== item.intention_id) : current.length < 5 ? [...current, item.intention_id] : current)}>
              <span className="profile-intention-check" aria-hidden="true" /><strong>{item.intention_name}</strong><p>{INTENTION_DESCRIPTIONS[item.intention_code] || item.description}</p>
            </button>;
          })}
        </div>
        <div className="profile-selection-summary">{selectedIntentions.length} of 5 intentions selected</div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'intentions'} disabled={locked || !!saving || selectedIntentions.length > 5} onClick={() => saveSection('intentions', () => api.put('/me/intentions', { intentionIds: selectedIntentions }), 'Collaboration intentions saved.')}>{saving === 'intentions' ? 'Saving…' : 'Save intentions'}</button></div>
      </section>

      <section className="profile-card">
        <SectionHeading title="Collaboration preferences" description="Set a few simple preferences for the kind of teamwork that suits you." />
        <div className="profile-form-grid">
          <div className="profile-field"><label>Collaboration status</label><select disabled={locked} value={form.collaborationStatus} onChange={(e) => setForm({ ...form, collaborationStatus: e.target.value })}><option value="available">Available to collaborate</option><option value="currently_collaborating">Currently collaborating</option><option value="unavailable">Not available right now</option></select></div>
          <div className="profile-field"><label>Preferred meeting mode</label><select disabled={locked} value={form.preferredMeetingMode} onChange={(e) => setForm({ ...form, preferredMeetingMode: e.target.value })}><option value="any">No preference</option><option value="remote">Remote</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></div>
          <div className="profile-field"><label>Commitment level</label><select disabled={locked} value={form.commitmentLevel} onChange={(e) => setForm({ ...form, commitmentLevel: e.target.value })}><option value="flexible">Flexible</option><option value="moderate">Moderate</option><option value="high">High</option></select></div>
        </div>
        <div className="profile-field profile-availability"><label>When are you generally available?</label><p>Choose all that apply. Keep it simple — you can update this later.</p><ChoiceChips options={AVAILABILITY} value={form.preferredMeetingTimes} onChange={(value) => setForm({ ...form, preferredMeetingTimes: value })} multiple disabled={locked} /></div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'preferences'} disabled={locked || !!saving} onClick={() => saveSection('preferences', () => api.patch('/students/me/profile', { collaborationStatus: form.collaborationStatus, preferredMeetingMode: form.preferredMeetingMode, preferredMeetingTimes: form.preferredMeetingTimes, commitmentLevel: form.commitmentLevel }), 'Collaboration preferences saved.')}>{saving === 'preferences' ? 'Saving…' : 'Save collaboration preferences'}</button></div>
      </section>

      <section className="profile-card">
        <SectionHeading title="Preferred teammates" description="Tell us a little about the students you would work well with. Leave any option at ‘Any’ if you are open to everyone." />
        <div className="profile-form-grid">
          <div className="profile-field"><label>Experience level</label><select disabled={locked} value={preferences.preferredExperienceLevel} onChange={(e) => setPreferences({ ...preferences, preferredExperienceLevel: e.target.value })}><option value="any">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select></div>
          <div className="profile-field"><label>Commitment</label><select disabled={locked} value={preferences.preferredCommitmentLevel} onChange={(e) => setPreferences({ ...preferences, preferredCommitmentLevel: e.target.value })}><option value="any">Any commitment</option><option value="flexible">Flexible</option><option value="moderate">Moderate</option><option value="high">High</option></select></div>
          <div className="profile-field"><label>Working style</label><select disabled={locked} value={preferences.preferredWorkingStyle} onChange={(e) => setPreferences({ ...preferences, preferredWorkingStyle: e.target.value })}><option value="any">Any style</option><option value="independent">Independent</option><option value="collaborative">Collaborative</option><option value="structured">Structured</option><option value="flexible">Flexible</option></select></div>
        </div>
        <div className="profile-field profile-bio-field"><label htmlFor="preferred-teammates-notes">Anything else you value in a teammate? <span>Optional</span></label><textarea id="preferred-teammates-notes" rows="3" maxLength="1000" disabled={locked} value={preferences.additionalPreferences} onChange={(e) => setPreferences({ ...preferences, additionalPreferences: e.target.value })} placeholder="For example: communicates clearly, shares ideas and respects deadlines…" /></div>
        <div className="profile-actions"><button type="button" className="profile-save-button" aria-busy={saving === 'teammates'} disabled={locked || !!saving} onClick={() => saveSection('teammates', () => api.put('/students/me/partner-preferences', { ...preferences, additionalPreferences: preferences.additionalPreferences || null }), 'Preferred teammate settings saved.')}>{saving === 'teammates' ? 'Saving…' : 'Save teammate preferences'}</button></div>
      </section>

      <div className="profile-bottom-note"><span>Your profile details help EduMatch suggest relevant students and groups. You control what you share, and you can update your profile whenever it is not under review.</span></div>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return <div className="profile-readonly-field"><span>{label}</span><strong>{value || 'Not available in student registry'}</strong></div>;
}
