import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  Search,
  RefreshCw,
  Users,
  GraduationCap,
  Building2,
  Sparkles,
  Filter,
  UserRound,
  AlertCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const YEARS = [1, 2, 3, 4];

function getErrorMessage(error) {
  return (
    error.response?.data?.message ||
    error.message ||
    'Unable to retrieve student recommendations.'
  );
}

function MatchCard({ student }) {
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
          <h4>
            <Sparkles size={15} />
            Why this student matches
          </h4>

          <ul>
            {student.reasons.map((reason, index) => (
              <li key={`${student.studentId}-${index}`}>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function FindStudentsPage() {
  const [students, setStudents] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(async (years = selectedYears) => {
    setError('');
    setLoading(true);

    try {
      const params = { limit: 20 };

      if (years.length > 0) {
        params.years = years.join(',');
      }

      const response = await axios.get(
        `${API_URL}/api/matches/students`,
        {
          params,
          withCredentials: true,
        }
      );

      setStudents(response.data.matches ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
      setStudents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYears]);

  useEffect(() => {
    fetchMatches(selectedYears);
  }, [fetchMatches]);

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

  function refreshMatches() {
    setRefreshing(true);
    fetchMatches(selectedYears);
  }

  return (
    <section className="find-students-page">
      <div className="find-students-heading">
        <div>
          <span className="page-eyebrow">COLLABORATION DISCOVERY</span>
          <h1>Find Students</h1>
          <p>
            Discover students whose skills, interests and collaboration
            goals complement yours.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={refreshMatches}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'find-students-spinning' : ''}
          />
          Refresh
        </button>
      </div>

      <div className="content-card find-students-filter">
        <div className="find-students-filter-heading">
          <div>
            <h2>
              <Filter size={18} />
              Academic year
            </h2>
            <p>Choose which students you want to discover.</p>
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
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}