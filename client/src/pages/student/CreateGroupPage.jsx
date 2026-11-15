import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faCheck, faCircleInfo, faPlus, faSearch,
  faUsers, faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons';
import api, { getApiErrorMessage } from '../../api/api';
import './CreateGroupPage.css';

const yearOptions = [1, 2, 3, 4];

const emptyForm = {
  groupName: '',
  description: '',
  maxMembers: 5,
  intentionId: '',
  objectives: '',
  expectedDeliverables: '',
  memberResponsibilities: '',
  memberExpectations: '',
  requiredSkillIds: [],
  acceptsAllYears: true,
  allowedYears: [],
};

function getArray(response) {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data?.intentions)) return response.data.intentions;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export default function CreateGroupPage({ onNavigate }) {
  const [form, setForm] = useState(emptyForm);
  const [intentions, setIntentions] = useState([]);
  const [skills, setSkills] = useState([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    async function loadCatalogs() {
      setLoadingCatalogs(true);
      setError('');
      try {
        const [intentionsResponse, skillsResponse] = await Promise.all([
          api.get('/catalog/collaboration-intentions'),
          api.get('/catalog/skills'),
        ]);
        if (!active) return;
        const intentionRows = getArray(intentionsResponse);
        const orderedCodes = ['STUDY_GROUP', 'PEER_LEARNING', 'COURSEWORK', 'PERSONAL_PROJECTS', 'ADVANCED_PROJECTS'];
        intentionRows.sort((a, b) => {
          const ai = orderedCodes.indexOf(a.intention_code);
          const bi = orderedCodes.indexOf(b.intention_code);
          return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        });
        setIntentions(intentionRows);
        setSkills(getArray(skillsResponse));
      } catch (requestError) {
        if (active) setError(getApiErrorMessage(requestError, 'Could not load the group options.'));
      } finally {
        if (active) setLoadingCatalogs(false);
      }
    }
    loadCatalogs();
    return () => { active = false; };
  }, []);

  const filteredSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((skill) => (skill.skill_name || '').toLowerCase().includes(query));
  }, [skills, skillSearch]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleSkill(skillId) {
    setForm((current) => ({
      ...current,
      requiredSkillIds: current.requiredSkillIds.includes(skillId)
        ? current.requiredSkillIds.filter((id) => id !== skillId)
        : [...current.requiredSkillIds, skillId],
    }));
  }

  function toggleYear(year) {
    setForm((current) => {
      const selected = current.allowedYears.includes(year)
        ? current.allowedYears.filter((item) => item !== year)
        : [...current.allowedYears, year].sort();
      return { ...current, allowedYears: selected };
    });
  }

  function validate() {
    if (form.groupName.trim().length < 3) return 'Group name must contain at least 3 characters.';
    if (!form.intentionId) return 'Choose the main collaboration intention for this group.';
    if (form.objectives.trim().length < 10) return 'Describe the group objectives using at least 10 characters.';
    if (form.expectedDeliverables.trim().length < 10) return 'Describe the expected deliverables using at least 10 characters.';
    if (form.memberResponsibilities.trim().length < 10) return 'Describe member responsibilities using at least 10 characters.';
    if (form.memberExpectations.trim().length < 10) return 'Describe member expectations using at least 10 characters.';
    if (!form.acceptsAllYears && form.allowedYears.length === 0) return 'Select at least one eligible academic year.';
    if (form.requiredSkillIds.length > 50) return 'You can select up to 50 required skills.';
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const payload = {
      groupName: form.groupName.trim(),
      description: form.description.trim(),
      maxMembers: Number(form.maxMembers),
      intentionId: form.intentionId,
      objectives: form.objectives.trim(),
      expectedDeliverables: form.expectedDeliverables.trim(),
      memberResponsibilities: form.memberResponsibilities.trim(),
      memberExpectations: form.memberExpectations.trim(),
      requiredSkillIds: form.requiredSkillIds,
      acceptsAllYears: form.acceptsAllYears,
      allowedYears: form.acceptsAllYears ? [] : form.allowedYears,
    };

    setSubmitting(true);
    try {
      await api.post('/groups', payload);
      setSuccess('Your group has been created successfully.');
      setForm(emptyForm);
      setSkillSearch('');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Unable to create the group. Please review the information and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingCatalogs) {
    return <div className="create-group-page"><div className="cg-loading">Loading group options…</div></div>;
  }

  return (
    <div className="create-group-page">
      <div className="cg-heading-row">
        <div>
          <span className="cg-eyebrow">BUILD YOUR TEAM</span>
          <h1>Create a group</h1>
          <p>Set a clear purpose and invite students who want to work towards the same goal.</p>
        </div>
        <div className="cg-heading-icon"><FontAwesomeIcon icon={faUsers} /></div>
      </div>

      {error && <div className="cg-alert cg-alert-error" role="alert">{error}</div>}
      {success && (
        <div className="cg-alert cg-alert-success" role="status">
          <FontAwesomeIcon icon={faCheck} /> {success}
          <button type="button" onClick={() => onNavigate?.('Discover Groups')}>View groups</button>
        </div>
      )}

      <form className="cg-form" onSubmit={handleSubmit}>
        <section className="cg-card">
          <div className="cg-section-heading">
            <span className="cg-step">01</span>
            <div><h2>Group basics</h2><p>Give your group a recognizable name and purpose.</p></div>
          </div>

          <div className="cg-field">
            <label htmlFor="cg-name">Group name <span>Required</span></label>
            <input id="cg-name" value={form.groupName} maxLength={100} onChange={(e) => update('groupName', e.target.value)} placeholder="e.g. Database Systems Study Group" required />
            <small>3–100 characters.</small>
          </div>

          <div className="cg-field">
            <label htmlFor="cg-description">Short description <span>Optional</span></label>
            <textarea id="cg-description" rows="3" maxLength={3000} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Briefly explain what the group is about." />
          </div>

          <div className="cg-form-grid">
            <div className="cg-field">
              <label htmlFor="cg-intention">Main collaboration intention <span>Required</span></label>
              <select id="cg-intention" value={form.intentionId} onChange={(e) => update('intentionId', e.target.value)} required>
                <option value="">Choose an intention</option>
                {intentions.map((item) => <option key={item.intention_id} value={item.intention_id}>{item.intention_name}</option>)}
              </select>
              <small>A group has one primary intention.</small>
            </div>
            <div className="cg-field">
              <label htmlFor="cg-size">Maximum group size <span>Required</span></label>
              <select id="cg-size" value={form.maxMembers} onChange={(e) => update('maxMembers', Number(e.target.value))}>
                {Array.from({ length: 14 }, (_, index) => index + 2).map((size) => <option key={size} value={size}>{size} members</option>)}
              </select>
              <small>Includes you as the group creator. Maximum 15.</small>
            </div>
          </div>
        </section>

        <section className="cg-card">
          <div className="cg-section-heading">
            <span className="cg-step">02</span>
            <div><h2>Purpose and expectations</h2><p>Make sure prospective members understand how the group will work.</p></div>
          </div>

          <div className="cg-field">
            <label htmlFor="cg-objectives">Group objectives <span>Required</span></label>
            <textarea id="cg-objectives" rows="4" minLength={10} maxLength={5000} value={form.objectives} onChange={(e) => update('objectives', e.target.value)} placeholder="What does the group aim to achieve?" required />
          </div>
          <div className="cg-field">
            <label htmlFor="cg-deliverables">Expected deliverables <span>Required</span></label>
            <textarea id="cg-deliverables" rows="3" minLength={10} maxLength={5000} value={form.expectedDeliverables} onChange={(e) => update('expectedDeliverables', e.target.value)} placeholder="What should the group produce or complete?" required />
          </div>
          <div className="cg-form-grid">
            <div className="cg-field">
              <label htmlFor="cg-responsibilities">Member responsibilities <span>Required</span></label>
              <textarea id="cg-responsibilities" rows="4" minLength={10} maxLength={5000} value={form.memberResponsibilities} onChange={(e) => update('memberResponsibilities', e.target.value)} placeholder="What will each member be responsible for?" required />
            </div>
            <div className="cg-field">
              <label htmlFor="cg-expectations">Member expectations <span>Required</span></label>
              <textarea id="cg-expectations" rows="4" minLength={10} maxLength={5000} value={form.memberExpectations} onChange={(e) => update('memberExpectations', e.target.value)} placeholder="What standards or commitments do you expect?" required />
            </div>
          </div>
        </section>

        <section className="cg-card">
          <div className="cg-section-heading">
            <span className="cg-step">03</span>
            <div><h2>Who can join?</h2><p>Set academic-year eligibility and the skills your group needs.</p></div>
          </div>

          <div className="cg-field">
            <label>Academic year eligibility</label>
            <div className="cg-choice-row">
              <label className={`cg-choice ${form.acceptsAllYears ? 'selected' : ''}`}>
                <input type="radio" name="yearEligibility" checked={form.acceptsAllYears} onChange={() => setForm((current) => ({ ...current, acceptsAllYears: true, allowedYears: [] }))} />
                <span>All academic years</span>
              </label>
              <label className={`cg-choice ${!form.acceptsAllYears ? 'selected' : ''}`}>
                <input type="radio" name="yearEligibility" checked={!form.acceptsAllYears} onChange={() => update('acceptsAllYears', false)} />
                <span>Choose specific years</span>
              </label>
            </div>
            {!form.acceptsAllYears && (
              <div className="cg-year-options">
                {yearOptions.map((year) => (
                  <button type="button" key={year} className={form.allowedYears.includes(year) ? 'selected' : ''} onClick={() => toggleYear(year)}>Year {year}</button>
                ))}
              </div>
            )}
          </div>

          <div className="cg-field">
            <label>Required skills <span>Optional</span></label>
            <div className="cg-skill-search"><FontAwesomeIcon icon={faSearch} /><input value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search skills…" /></div>
            <div className="cg-skill-list">
              {filteredSkills.slice(0, 80).map((skill) => (
                <label className="cg-skill-option" key={skill.skill_id}>
                  <input type="checkbox" checked={form.requiredSkillIds.includes(skill.skill_id)} onChange={() => toggleSkill(skill.skill_id)} />
                  <span>{skill.skill_name}</span>
                </label>
              ))}
              {filteredSkills.length === 0 && <p className="cg-no-skills">No matching skills found.</p>}
            </div>
            <small>{form.requiredSkillIds.length} skill(s) selected. You can select up to 50.</small>
          </div>
        </section>

        <div className="cg-submit-row">
          <div className="cg-submit-note"><FontAwesomeIcon icon={faCircleInfo} /> You can manage membership requests after creating the group.</div>
          <button className="cg-submit-button" type="submit" disabled={submitting || intentions.length === 0}>
            <FontAwesomeIcon icon={faPlus} /> {submitting ? 'Creating group…' : 'Create group'}
          </button>
        </div>
      </form>

      {intentions.length === 0 && <div className="cg-alert cg-alert-error">No collaboration intentions were returned by the server. Refresh the page or check the intention catalogue.</div>}
      <button type="button" className="cg-back-button" onClick={() => onNavigate?.('Discover Groups')}><FontAwesomeIcon icon={faArrowLeft} /> Back to Discover Groups</button>
    </div>
  );
}
