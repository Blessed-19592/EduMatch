import { useEffect, useMemo, useState } from 'react';
import api, { getApiErrorMessage } from '../../api/api';
import './PortfolioPage.css';

const EVIDENCE_TYPES = [
  { value: 'github_repository', label: 'GitHub Repository' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'live_demo', label: 'Live Demo' },
  { value: 'design_portfolio', label: 'Design Portfolio' },
  { value: 'research', label: 'Research' },
  { value: 'video_presentation', label: 'Video Presentation' },
  { value: 'other', label: 'Other' },
];

const emptyPortfolioForm = {
  title: '',
  description: '',
  evidenceType: 'github_repository',
  evidenceUrl: '',
  repositoryUrl: '',
  liveDemoUrl: '',
};

const emptyEvidenceForm = {
  portfolioId: '',
  evidenceType: 'github_repository',
  title: '',
  description: '',
  evidenceUrl: '',
};

function formatLabel(value) {
  if (!value) return 'Not specified';

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return 'Not available';

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getReviewStatus(profile) {
  return profile?.profile_review_status || 'draft';
}

function getStatusClass(status) {
  return String(status || 'pending')
    .toLowerCase()
    .replaceAll('_', '-');
}

function getArray(payload, key) {
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export default function PortfolioPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [profile, setProfile] = useState(null);
  const [portfolios, setPortfolios] = useState([]);
  const [skills, setSkills] = useState([]);
  const [assessments, setAssessments] = useState([]);

  const [portfolioForm, setPortfolioForm] = useState(emptyPortfolioForm);
  const [editingPortfolioId, setEditingPortfolioId] = useState(null);
  const [showPortfolioForm, setShowPortfolioForm] = useState(false);
  const [portfolioSaving, setPortfolioSaving] = useState(false);

  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [assessmentSaving, setAssessmentSaving] = useState(false);

  const [expandedAssessmentId, setExpandedAssessmentId] = useState(null);
  const [assessmentEvidence, setAssessmentEvidence] = useState({});
  const [evidenceForms, setEvidenceForms] = useState({});
  const [evidenceSavingId, setEvidenceSavingId] = useState(null);

  const reviewStatus = getReviewStatus(profile);
  const isLocked = reviewStatus === 'submitted';

  const assessedSkillIds = useMemo(
    () => new Set(assessments.map((item) => item.skill_id)),
    [assessments]
  );

  const availableSkills = useMemo(
    () => skills.filter((skill) => !assessedSkillIds.has(skill.skill_id)),
    [skills, assessedSkillIds]
  );

  async function loadPage() {
    setLoading(true);
    setError('');

    try {
      const [
        profileRes,
        portfolioRes,
        skillsRes,
        assessmentsRes,
      ] = await Promise.all([
        api.get('/students/me/profile'),
        api.get('/students/me/portfolios'),
        api.get('/me/skills'),
        api.get('/students/me/assessments'),
      ]);

      setProfile(
  profileRes.data?.data ||
  profileRes.data?.profile ||
  profileRes.data
);
      setPortfolios(getArray(portfolioRes.data, 'portfolios'));
      setSkills(getArray(skillsRes.data, 'skills'));
      setAssessments(getArray(assessmentsRes.data, 'assessments'));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to load your portfolio and assessments.'
        )
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  function updatePortfolioField(event) {
    const { name, value } = event.target;

    setPortfolioForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateEvidenceField(assessmentId, event) {
    const { name, value } = event.target;

    setEvidenceForms((current) => ({
      ...current,
      [assessmentId]: {
        ...(current[assessmentId] || emptyEvidenceForm),
        [name]: value,
      },
    }));
  }

  function openNewPortfolioForm() {
    setEditingPortfolioId(null);
    setPortfolioForm(emptyPortfolioForm);
    setShowPortfolioForm(true);
    setError('');
    setNotice('');
  }

  function openEditPortfolioForm(portfolio) {
    setEditingPortfolioId(portfolio.portfolio_id);

    setPortfolioForm({
      title: portfolio.title || '',
      description: portfolio.description || '',
      evidenceType: portfolio.evidence_type || 'other',
      evidenceUrl: portfolio.evidence_url || '',
      repositoryUrl: portfolio.repository_url || '',
      liveDemoUrl: portfolio.live_demo_url || '',
    });

    setShowPortfolioForm(true);
    setError('');
    setNotice('');
  }

  function closePortfolioForm() {
    setShowPortfolioForm(false);
    setEditingPortfolioId(null);
    setPortfolioForm(emptyPortfolioForm);
  }

  async function savePortfolio(event) {
    event.preventDefault();

    if (isLocked) return;

    setPortfolioSaving(true);
    setError('');
    setNotice('');

    try {
      const payload = {
        title: portfolioForm.title.trim(),
        description: portfolioForm.description.trim() || null,
        evidenceType: portfolioForm.evidenceType,
        evidenceUrl: portfolioForm.evidenceUrl.trim(),
        repositoryUrl: portfolioForm.repositoryUrl.trim() || null,
        liveDemoUrl: portfolioForm.liveDemoUrl.trim() || null,
      };

      if (editingPortfolioId) {
        await api.patch(
          `/students/me/portfolios/${editingPortfolioId}`,
          payload
        );

        setNotice('Portfolio entry updated successfully.');
      } else {
        await api.post('/students/me/portfolios', payload);

        setNotice('Portfolio entry added successfully.');
      }

      closePortfolioForm();
      await loadPage();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to save this portfolio entry.'
        )
      );
    } finally {
      setPortfolioSaving(false);
    }
  }

  async function deletePortfolio(portfolioId) {
    if (isLocked) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this portfolio entry?'
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await api.delete(`/students/me/portfolios/${portfolioId}`);

      setNotice('Portfolio entry deleted successfully.');
      await loadPage();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to delete this portfolio entry.'
        )
      );
    }
  }

  async function createAssessment(event) {
    event.preventDefault();

    if (!selectedSkillId || isLocked) return;

    setAssessmentSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await api.post('/students/me/assessments', {
        skillId: selectedSkillId,
      });

      if (response.data?.alreadyExists) {
        setNotice('An assessment already exists for this skill.');
      } else {
        setNotice('Self-reported assessment created successfully.');
      }

      setSelectedSkillId('');
      await loadPage();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to create the assessment.'
        )
      );
    } finally {
      setAssessmentSaving(false);
    }
  }

  async function toggleAssessmentEvidence(assessmentId) {
    if (expandedAssessmentId === assessmentId) {
      setExpandedAssessmentId(null);
      return;
    }

    setExpandedAssessmentId(assessmentId);

    if (assessmentEvidence[assessmentId]) return;

    setError('');

    try {
      const response = await api.get(
        `/students/me/assessments/${assessmentId}/evidence`
      );

      setAssessmentEvidence((current) => ({
        ...current,
        [assessmentId]: getArray(response.data, 'evidence'),
      }));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to load assessment evidence.'
        )
      );
    }
  }

  async function submitAssessmentEvidence(event, assessmentId) {
    event.preventDefault();

    if (isLocked) return;

    const form = evidenceForms[assessmentId] || emptyEvidenceForm;

    if (!form.portfolioId && !form.evidenceUrl.trim()) {
      setError('Select a portfolio entry or provide an evidence URL.');
      return;
    }

    setEvidenceSavingId(assessmentId);
    setError('');
    setNotice('');

    try {
      const payload = {
        portfolioId: form.portfolioId || null,
        evidenceType: form.evidenceType,
        title: form.title.trim(),
        description: form.description.trim() || null,
        evidenceUrl: form.evidenceUrl.trim() || null,
      };

      const response = await api.post(
        `/students/me/assessments/${assessmentId}/evidence`,
        payload
      );

      setAssessmentEvidence((current) => ({
        ...current,
        [assessmentId]: [
          response.data.evidence,
          ...(current[assessmentId] || []),
        ],
      }));

      setEvidenceForms((current) => ({
        ...current,
        [assessmentId]: emptyEvidenceForm,
      }));

      setNotice('Assessment evidence submitted successfully.');
      await loadPage();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to submit assessment evidence.'
        )
      );
    } finally {
      setEvidenceSavingId(null);
    }
  }

  async function deleteAssessmentEvidence(evidenceId, assessmentId) {
    if (isLocked) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this evidence?'
    );

    if (!confirmed) return;

    setError('');
    setNotice('');

    try {
      await api.delete(`/students/me/evidence/${evidenceId}`);

      setAssessmentEvidence((current) => ({
        ...current,
        [assessmentId]: (current[assessmentId] || []).filter(
          (item) => item.evidence_id !== evidenceId
        ),
      }));

      setNotice('Assessment evidence deleted successfully.');
      await loadPage();
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          'Unable to delete assessment evidence.'
        )
      );
    }
  }

  if (loading) {
    return (
      <div className="portfolio-page">
        <div className="portfolio-loading">
          Loading your portfolio and skill assessments...
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-page">
      <header className="portfolio-page-header">
        <div>
          <h1>Portfolio & Skills</h1>
          <p className="portfolio-page-description">
            Present your work, provide evidence of your abilities and
            keep track of your skill assessments.
          </p>
        </div>
      </header>

      {error && (
        <div className="portfolio-alert portfolio-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="portfolio-alert portfolio-alert-success" role="status">
          {notice}
        </div>
      )}

      {isLocked && (
        <div className="portfolio-review-notice">
          <strong>Your profile is under review.</strong>
          <p>
            Portfolio and assessment evidence changes are temporarily
            unavailable while your profile is submitted for review.
          </p>
        </div>
      )}

      {reviewStatus === 'approved' && (
        <div className="portfolio-review-notice portfolio-approved-notice">
          <strong>Your profile has been approved.</strong>
          <p>
            Changes to your portfolio or assessment evidence may return
            your profile to draft status and require another review.
          </p>
        </div>
      )}

      {/* PORTFOLIO SECTION */}

      <section className="portfolio-section">
        <div className="portfolio-section-header">
          <div>
            <h2>My Portfolio</h2>
            <p>
              Showcase projects, research, documentation and other work
              that demonstrates your experience.
            </p>
          </div>

          <button
            type="button"
            className="portfolio-primary-button"
            onClick={openNewPortfolioForm}
            disabled={isLocked}
          >
            Add Portfolio Entry
          </button>
        </div>

        {showPortfolioForm && (
          <form className="portfolio-form" onSubmit={savePortfolio}>
            <div className="portfolio-form-heading">
              <h3>
                {editingPortfolioId
                  ? 'Edit Portfolio Entry'
                  : 'New Portfolio Entry'}
              </h3>

              <button
                type="button"
                className="portfolio-text-button"
                onClick={closePortfolioForm}
              >
                Cancel
              </button>
            </div>

            <div className="portfolio-form-grid">
              <label className="portfolio-field portfolio-field-full">
                <span>Title</span>
                <input
                  type="text"
                  name="title"
                  value={portfolioForm.title}
                  onChange={updatePortfolioField}
                  minLength={2}
                  maxLength={150}
                  required
                  placeholder="e.g. Student Management System"
                />
              </label>

              <label className="portfolio-field">
                <span>Evidence Type</span>
                <select
                  name="evidenceType"
                  value={portfolioForm.evidenceType}
                  onChange={updatePortfolioField}
                  required
                >
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="portfolio-field">
                <span>Evidence URL</span>
                <input
                  type="url"
                  name="evidenceUrl"
                  value={portfolioForm.evidenceUrl}
                  onChange={updatePortfolioField}
                  required
                  placeholder="https://..."
                />
              </label>

              <label className="portfolio-field portfolio-field-full">
                <span>Description</span>
                <textarea
                  name="description"
                  value={portfolioForm.description}
                  onChange={updatePortfolioField}
                  maxLength={2000}
                  rows={4}
                  placeholder="Describe the work, your contribution and what it demonstrates."
                />
              </label>

              <label className="portfolio-field">
                <span>Repository URL <small>(Optional)</small></span>
                <input
                  type="url"
                  name="repositoryUrl"
                  value={portfolioForm.repositoryUrl}
                  onChange={updatePortfolioField}
                  placeholder="https://github.com/..."
                />
              </label>

              <label className="portfolio-field">
                <span>Live Demo URL <small>(Optional)</small></span>
                <input
                  type="url"
                  name="liveDemoUrl"
                  value={portfolioForm.liveDemoUrl}
                  onChange={updatePortfolioField}
                  placeholder="https://..."
                />
              </label>
            </div>

            <div className="portfolio-form-actions">
              <button
                type="button"
                className="portfolio-secondary-button"
                onClick={closePortfolioForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="portfolio-primary-button"
                disabled={portfolioSaving}
              >
                {portfolioSaving
                  ? 'Saving...'
                  : editingPortfolioId
                    ? 'Save Changes'
                    : 'Add Entry'}
              </button>
            </div>
          </form>
        )}

        {portfolios.length === 0 ? (
          <div className="portfolio-empty-state">
            <h3>No portfolio entries yet</h3>
            <p>
              Add your projects, research or other work to start building
              your portfolio.
            </p>
          </div>
        ) : (
          <div className="portfolio-entry-list">
            {portfolios.map((portfolio) => (
              <article
                className="portfolio-entry-card"
                key={portfolio.portfolio_id}
              >
                <div className="portfolio-entry-top">
                  <div>
                    <span className="portfolio-type-label">
                      {formatLabel(portfolio.evidence_type)}
                    </span>
                    <h3>{portfolio.title}</h3>
                  </div>

                  <span className="portfolio-entry-date">
                    {formatDate(portfolio.created_at)}
                  </span>
                </div>

                {portfolio.description && (
                  <p className="portfolio-entry-description">
                    {portfolio.description}
                  </p>
                )}

                <div className="portfolio-entry-links">
                  <a
                    href={portfolio.evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Evidence
                  </a>

                  {portfolio.repository_url && (
                    <a
                      href={portfolio.repository_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Repository
                    </a>
                  )}

                  {portfolio.live_demo_url && (
                    <a
                      href={portfolio.live_demo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Live Demo
                    </a>
                  )}
                </div>

                <div className="portfolio-entry-actions">
                  <button
                    type="button"
                    className="portfolio-text-button"
                    onClick={() => openEditPortfolioForm(portfolio)}
                    disabled={isLocked}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="portfolio-danger-button"
                    onClick={() => deletePortfolio(portfolio.portfolio_id)}
                    disabled={isLocked}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* SKILL ASSESSMENTS SECTION */}

      <section className="portfolio-section">
        <div className="portfolio-section-header">
          <div>
            <h2>Skill Assessments</h2>
            <p>
              Create self-reported assessments for skills already
              included in your student profile and provide supporting evidence.
            </p>
          </div>
        </div>

        <form className="assessment-create-form" onSubmit={createAssessment}>
          <label className="portfolio-field">
            <span>Select a skill from your profile</span>
            <select
              value={selectedSkillId}
              onChange={(event) => setSelectedSkillId(event.target.value)}
              disabled={isLocked || availableSkills.length === 0}
            >
              <option value="">Choose a skill</option>

              {availableSkills.map((skill) => (
                <option key={skill.skill_id} value={skill.skill_id}>
                  {skill.skill_name} — {formatLabel(skill.proficiency_level)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="portfolio-primary-button"
            disabled={
              isLocked ||
              assessmentSaving ||
              !selectedSkillId
            }
          >
            {assessmentSaving ? 'Creating...' : 'Create Assessment'}
          </button>
        </form>

        {skills.length === 0 && (
          <div className="portfolio-empty-state">
            <h3>No skills added to your profile</h3>
            <p>
              Add skills to your profile before creating skill assessments.
            </p>
          </div>
        )}

        {skills.length > 0 && availableSkills.length === 0 && (
          <p className="portfolio-helper-text">
            All your profile skills already have assessments.
          </p>
        )}

        {assessments.length === 0 ? (
          <div className="portfolio-empty-state">
            <h3>No skill assessments yet</h3>
            <p>
              Create an assessment for one of your listed skills.
            </p>
          </div>
        ) : (
          <div className="assessment-list">
            {assessments.map((assessment) => {
              const isExpanded =
                expandedAssessmentId === assessment.assessment_id;

              const evidence =
                assessmentEvidence[assessment.assessment_id] || [];

              const isSelfReported =
                assessment.assessment_method === 'self_reported';

              const evidenceForm =
                evidenceForms[assessment.assessment_id] ||
                emptyEvidenceForm;

              return (
                <article
                  className="assessment-card"
                  key={assessment.assessment_id}
                >
                  <div className="assessment-card-header">
                    <div>
                      <span className="portfolio-type-label">
                        {assessment.category || 'Skill'}
                      </span>

                      <h3>{assessment.skill_name}</h3>

                      <p className="assessment-method">
                        Assessment method: {formatLabel(assessment.assessment_method)}
                      </p>
                    </div>

                    <span
                      className={`assessment-status status-${getStatusClass(
                        assessment.assessment_status
                      )}`}
                    >
                      {formatLabel(assessment.assessment_status)}
                    </span>
                  </div>

                  {assessment.assessment_summary && (
                    <p className="assessment-summary">
                      {assessment.assessment_summary}
                    </p>
                  )}

                  <div className="assessment-details">
                    {assessment.assessed_at && (
                      <span>
                        Assessed: {formatDate(assessment.assessed_at)}
                      </span>
                    )}

                    <span>
                      Created: {formatDate(assessment.created_at)}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="portfolio-text-button"
                    onClick={() =>
                      toggleAssessmentEvidence(assessment.assessment_id)
                    }
                  >
                    {isExpanded ? 'Hide Evidence' : 'View Evidence'}
                  </button>

                  {isExpanded && (
                    <div className="assessment-evidence-panel">
                      <h4>Supporting Evidence</h4>

                      {evidence.length === 0 ? (
                        <p className="portfolio-helper-text">
                          No evidence has been submitted for this assessment.
                        </p>
                      ) : (
                        <div className="assessment-evidence-list">
                          {evidence.map((item) => (
                            <div
                              className="assessment-evidence-item"
                              key={item.evidence_id}
                            >
                              <div>
                                <strong>{item.title}</strong>
                                <p>{formatLabel(item.evidence_type)}</p>

                                {item.description && (
                                  <p>{item.description}</p>
                                )}

                                {item.evidence_url && (
                                  <a
                                    href={item.evidence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Open Evidence
                                  </a>
                                )}

                                {item.portfolio_id && (
                                  <span className="portfolio-linked-label">
                                    Linked to portfolio entry
                                  </span>
                                )}
                              </div>

                              {isSelfReported && (
                                <button
                                  type="button"
                                  className="portfolio-danger-button"
                                  onClick={() =>
                                    deleteAssessmentEvidence(
                                      item.evidence_id,
                                      assessment.assessment_id
                                    )
                                  }
                                  disabled={isLocked}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isSelfReported && (
                        <form
                          className="evidence-form"
                          onSubmit={(event) =>
                            submitAssessmentEvidence(
                              event,
                              assessment.assessment_id
                            )
                          }
                        >
                          <h4>Add Supporting Evidence</h4>

                          <div className="portfolio-form-grid">
                            <label className="portfolio-field">
                              <span>Evidence Title</span>
                              <input
                                type="text"
                                name="title"
                                value={evidenceForm.title}
                                onChange={(event) =>
                                  updateEvidenceField(
                                    assessment.assessment_id,
                                    event
                                  )
                                }
                                minLength={2}
                                maxLength={150}
                                required
                                disabled={isLocked}
                                placeholder="Evidence title"
                              />
                            </label>

                            <label className="portfolio-field">
                              <span>Evidence Type</span>
                              <select
                                name="evidenceType"
                                value={evidenceForm.evidenceType}
                                onChange={(event) =>
                                  updateEvidenceField(
                                    assessment.assessment_id,
                                    event
                                  )
                                }
                                disabled={isLocked}
                              >
                                {EVIDENCE_TYPES.map((type) => (
                                  <option
                                    key={type.value}
                                    value={type.value}
                                  >
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="portfolio-field portfolio-field-full">
                              <span>Link to Portfolio Entry <small>(Optional)</small></span>
                              <select
                                name="portfolioId"
                                value={evidenceForm.portfolioId}
                                onChange={(event) =>
                                  updateEvidenceField(
                                    assessment.assessment_id,
                                    event
                                  )
                                }
                                disabled={isLocked}
                              >
                                <option value="">No portfolio entry selected</option>

                                {portfolios.map((portfolio) => (
                                  <option
                                    key={portfolio.portfolio_id}
                                    value={portfolio.portfolio_id}
                                  >
                                    {portfolio.title}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="portfolio-field portfolio-field-full">
                              <span>External Evidence URL <small>(Optional)</small></span>
                              <input
                                type="url"
                                name="evidenceUrl"
                                value={evidenceForm.evidenceUrl}
                                onChange={(event) =>
                                  updateEvidenceField(
                                    assessment.assessment_id,
                                    event
                                  )
                                }
                                disabled={isLocked}
                                placeholder="https://..."
                              />
                            </label>

                            <label className="portfolio-field portfolio-field-full">
                              <span>Description <small>(Optional)</small></span>
                              <textarea
                                name="description"
                                value={evidenceForm.description}
                                onChange={(event) =>
                                  updateEvidenceField(
                                    assessment.assessment_id,
                                    event
                                  )
                                }
                                maxLength={2000}
                                rows={3}
                                disabled={isLocked}
                                placeholder="Explain how this evidence demonstrates your skill."
                              />
                            </label>
                          </div>

                          <button
                            type="submit"
                            className="portfolio-primary-button"
                            disabled={
                              isLocked ||
                              evidenceSavingId === assessment.assessment_id
                            }
                          >
                            {evidenceSavingId === assessment.assessment_id
                              ? 'Submitting...'
                              : 'Submit Evidence'}
                          </button>
                        </form>
                      )}

                      {!isSelfReported && (
                        <p className="portfolio-helper-text">
                          This assessment was independently assessed.
                          Students cannot modify its assessment results.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}