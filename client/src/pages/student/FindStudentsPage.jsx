import './FindStudentsPage.css';
import { useCallback, useEffect, useState } from 'react';
import api from '../../api/api';
import {
  RefreshCw,
  Users,
  GraduationCap,
  Building2,
  UserRound,
  AlertCircle,
  Send,
  X,
  CheckCircle,
} from 'lucide-react';



const YEARS = [1, 2, 3, 4];

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    'Unable to retrieve student recommendations.'
  );
}

function MatchCard({
  student,
  isRequesting,
  requestStatus,
  activeRequest,
  onOpenRequest,
  onCloseRequest,
  message,
  onMessageChange,
  onSubmitRequest,
  feedback,
}) {
  const isActive = activeRequest === student.studentId;

  return (
    <article className="content-card find-student-card">
      <div className="find-student-card-top">
        <div className="find-student-avatar">
          <UserRound size={25} />
        </div>

        <div className="find-student-identity">
          <h3>{student.fullName}</h3>
          <span>
            {student.yearOfStudy
              ? `Year ${student.yearOfStudy}`
              : 'Academic year unavailable'}
          </span>
        </div>

        <div className="match-score">
          <strong>{student.score}%</strong>
          <span>Match</span>
        </div>
      </div>

      <div className="find-student-academics">
        <p>
          <GraduationCap size={16} />
          {student.course || 'Course unavailable'}
        </p>

        <p>
          <Building2 size={16} />
          {student.department || 'Department unavailable'}
        </p>
      </div>

      {student.reasons?.length > 0 && (
        <div className="match-reasons">
          <h4>Why this student matches</h4>

          <ul>
            {student.reasons.map((reason, index) => (
              <li key={`${student.studentId}-${index}`}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="find-student-request-section">

        {requestStatus === 'accepted' ? (
          <div className="collaboration-request-success">
            <CheckCircle size={17} />
            Collaboration accepted
          </div>
        ) : requestStatus === 'pending' ? (
          <div className="collaboration-request-success">
            <CheckCircle size={17} />
            Request pending
          </div>
        ) : (
          <>
            {!isActive && (
              <button
                type="button"
                className="primary-button collaboration-request-button"
                onClick={() => onOpenRequest(student.studentId)}
              >
                <Send size={16} />
                Request to Collaborate
              </button>
            )}

            {isActive && (
              <form
                className="collaboration-request-form"
                onSubmit={(event) => onSubmitRequest(event, student.studentId)}
              >
                <label htmlFor={`message-${student.studentId}`}>
                  Introduce yourself and explain why you'd like to collaborate.
                </label>

                <textarea
                  id={`message-${student.studentId}`}
                  value={message}
                  onChange={(event) => onMessageChange(event.target.value)}
                  placeholder="Hi! I noticed we share similar interests. I'd like us to collaborate on..."
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  required
                />

                <div className="collaboration-message-count">
                  {message.length}/1000 characters
                </div>

                {feedback && (
                  <p className="collaboration-request-error" role="alert">
                    {feedback}
                  </p>
                )}

                <div className="collaboration-request-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onCloseRequest}
                    disabled={isRequesting}
                  >
                    <X size={15} />
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={
                      isRequesting ||
                      message.trim().length < 10 ||
                      message.length > 1000
                    }
                  >
                    {isRequesting ? (
                      <>
                        <RefreshCw
                          size={15}
                          className="find-students-spinning"
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Send Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default function FindStudentsPage() {
  const [students, setStudents] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeRequest, setActiveRequest] = useState(null);
  const [message, setMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatuses, setRequestStatuses] = useState({});
  const [requestFeedback, setRequestFeedback] = useState({});

  // Retrieve existing sent and received requests.
  const fetchExistingRequests = useCallback(async () => {
    try {
      const [sentResponse, receivedResponse] = await Promise.all([
        api.get('/student-collaboration-requests', {
          params: { type: 'sent' },
        }),
        api.get('/student-collaboration-requests', {
          params: { type: 'received' },
        }),
      ]);

      const statuses = {};

      const allRequests = [
        ...(sentResponse.data.data || []),
        ...(receivedResponse.data.data || []),
      ];

      allRequests.forEach((request) => {
        if (
          ['pending', 'accepted'].includes(request.request_status)
        ) {
          const existing = statuses[request.student_id];

          if (
            !existing ||
            request.request_status === 'accepted'
          ) {
            statuses[request.student_id] = request.request_status;
          }
        }
      });

      setRequestStatuses(statuses);
    } catch (err) {
      console.error(
        'Unable to load existing collaboration requests:',
        err
      );
    }
  }, []);

  const fetchMatches = useCallback(async (years = selectedYears) => {
    setError('');
    setLoading(true);

    try {
      const params = { limit: 20 };

      if (years.length > 0) {
        params.years = years.join(',');
      }

      const response = await api.get('/matches/students', {
        params,
      });

      setStudents(response.data.matches ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedYears]);

  // Load matches and existing requests when the page opens.
  useEffect(() => {
    fetchMatches(selectedYears);
  }, [fetchMatches]);

  useEffect(() => {
    fetchExistingRequests();
  }, [fetchExistingRequests]);

  function toggleYear(year) {
    setSelectedYears((current) =>
      current.includes(year)
        ? current.filter((item) => item !== year)
        : [...current, year].sort()
    );
  }

  function clearFilters() {
    setSelectedYears([]);
  }

  function openRequestForm(studentId) {
    setActiveRequest(studentId);
    setMessage('');
    setRequestFeedback({});
  }

  function closeRequestForm() {
    if (sendingRequest) return;

    setActiveRequest(null);
    setMessage('');
    setRequestFeedback({});
  }

  async function handleSendRequest(event, studentId) {
    event.preventDefault();

    if (message.trim().length < 10 || message.trim().length > 1000) {
      setRequestFeedback({
        [studentId]: 'Your message must contain between 10 and 1000 characters.',
      });
      return;
    }

    setSendingRequest(true);
    setRequestFeedback({});

    try {
      await api.post(
        `/student-collaboration-requests/${studentId}`,
        {
          message: message.trim(),
        }
      );

      setRequestStatuses((current) => ({
        ...current,
        [studentId]: 'pending',
      }));

      setActiveRequest(null);
      setMessage('');
    } catch (err) {
      setRequestFeedback({
        [studentId]: getErrorMessage(err),
      });
    } finally {
      setSendingRequest(false);
    }
  }

  return (
    <section className="find-students-page">
      <div className="find-students-heading">
        <div>
          <h1>Find Students</h1>
          <p>
            Discover students whose skills, interests and collaboration
            goals complement yours.
          </p>
        </div>
      </div>

      <div className="find-students-filter">
        <div className="find-students-filter-heading">
          <div>
            <h2>Academic year</h2>
            <p>Choose years to update your recommendations automatically.</p>
          </div>

          {selectedYears.length > 0 && (
            <button
              type="button"
              className="text-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="find-students-year-options">
          {YEARS.map((year) => (
            <button
              key={year}
              type="button"
              className={`year-filter-button ${
                selectedYears.includes(year) ? 'selected' : ''
              }`}
              aria-pressed={selectedYears.includes(year)}
              onClick={() => toggleYear(year)}
            >
              Year {year}
            </button>
          ))}
        </div>

        <p className="filter-hint">
          {selectedYears.length === 0
            ? 'Showing students from all academic years.'
            : `Filtering by Year ${selectedYears.join(', Year ')}.`}
        </p>
      </div>

      <div className="find-students-results-heading">
        <div>
          <h2>Recommended students</h2>
          <p>Ranked according to your compatibility.</p>
        </div>

        {!loading && (
          <span className="find-students-count">
            {students.length} {students.length === 1 ? 'match' : 'matches'}
          </span>
        )}
      </div>

      {error && (
        <div className="find-students-error" role="alert">
          <AlertCircle size={19} />
          <span>{error}</span>
          <button type="button" onClick={() => fetchMatches(selectedYears)}>
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="content-card find-students-empty">
          <RefreshCw className="find-students-spinning" size={25} />
          <h3>Finding compatible students...</h3>
          <p>We're comparing collaboration goals and academic profiles.</p>
        </div>
      ) : !error && students.length === 0 ? (
        <div className="content-card find-students-empty">
          <div className="find-students-empty-icon">
            <Users size={28} />
          </div>
          <h3>No matching students found</h3>
          <p>
            Try selecting different academic years or check back when
            more students have completed their profiles.
          </p>

          {selectedYears.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={clearFilters}
            >
              Show all academic years
            </button>
          )}
        </div>
      ) : !error ? (
        <div className="find-students-grid">
          {students.map((student) => (
            <MatchCard
              key={student.studentId}
              student={student}
              onOpenRequest={openRequestForm}
              onCloseRequest={closeRequestForm}
              activeRequest={activeRequest}
              message={message}
              onMessageChange={setMessage}
              onSubmitRequest={handleSendRequest}
              isRequesting={sendingRequest}
              requestStatus={requestStatuses[student.studentId]}
              feedback={requestFeedback[student.studentId]}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}