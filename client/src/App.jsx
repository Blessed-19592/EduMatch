import { useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RequestCodePage from './pages/auth/RequestCodePage';
import VerifyCodePage from './pages/auth/VerifyCodePage';
import CompleteRegistrationPage from './pages/auth/CompleteRegistrationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/student/ProfilePage';
import DiscoverGroupsPage from './pages/student/DiscoverGroupsPage';
import './components/auth/Auth.css';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import {
  faGaugeHigh,
  faUser,
  faGlobe,
  faUsers,
  faFolderOpen,
  faComments,
  faClipboardCheck,
  faGear,
  faGraduationCap,
  faBookOpen,
  faArrowUpRightFromSquare,
  faBars,
  faXmark,
  faChevronDown,
  faBell,
  faMagnifyingGlass,
  faPlus,
  faCalendarDays,
  faClock,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';

import './App.css';

const navigation = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', icon: faGaugeHigh },
      { label: 'My Profile', icon: faUser },
    ],
  },
  {
    title: 'COLLABORATION',
    items: [
      { label: 'Find Students', icon: faGlobe },
      { label: 'Discover Groups', icon: faUsers },
      { label: 'My Groups', icon: faFolderOpen },
      { label: 'Messages', icon: faComments },
    ],
  },
  {
    title: 'PRODUCTIVITY',
    items: [
      { label: 'My Tasks', icon: faClipboardCheck },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { label: 'Settings', icon: faGear },
    ],
  },
];

function Topbar({ activePage, openSidebar, user, onLogout, onNavigate }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href="/" aria-label="EduMatch home">
          <div className="brand-icon">
            <FontAwesomeIcon icon={faGraduationCap} />
          </div>

          <div className="brand-text">
            <h2>EduMatch</h2>
            <span>LEARN. CONNECT. GROW.</span>
          </div>
        </a>

        <button
          className="menu-button"
          onClick={openSidebar}
          aria-label="Open navigation"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>

        <div className="breadcrumb">
          <span>EduMatch</span>
          <span className="breadcrumb-divider">/</span>
          <strong>{activePage}</strong>
        </div>
      </div>

      <div className="header-right">
        <div className="search-box">
          <FontAwesomeIcon icon={faMagnifyingGlass} />

          <input
            type="search"
            placeholder="Search students, groups..."
            aria-label="Search students and groups"
          />
        </div>

        <button
          className="notification-button"
          aria-label="Notifications"
        >
          <FontAwesomeIcon icon={faBell} />
          <span className="notification-dot" />
        </button>

        <div className="header-divider" />

        <div className="profile-container">
          <button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
          >
            <div className="avatar">{(user?.fullName || 'Student').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>

            <div className="profile-info">
              <strong>{user?.fullName || 'Student'}</strong>
              <span>{user?.role === 'admin' ? 'Administrator' : 'My account'}</span>
            </div>

            <FontAwesomeIcon
              icon={faChevronDown}
              className="profile-chevron"
            />
          </button>

          {profileOpen && (
            <div className="profile-dropdown">
              <button onClick={() => { setProfileOpen(false); onNavigate('My Profile'); }}>
                My Profile
              </button>

              <button onClick={() => setProfileOpen(false)}>
                Account Settings
              </button>

              <button onClick={() => { setProfileOpen(false); onLogout(); }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({ activePage, setActivePage, open, closeSidebar }) {
  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-content">
          {navigation.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-heading">{section.title}</p>

              {section.items.map((item) => (
                <button
                  key={item.label}
                  className={`nav-item ${
                    activePage === item.label ? 'active' : ''
                  }`}
                  onClick={() => {
                    setActivePage(item.label);
                    closeSidebar();
                  }}
                >
                  <FontAwesomeIcon
                    icon={item.icon}
                    className="nav-icon"
                  />

                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <FontAwesomeIcon icon={faBookOpen} />
            </div>

            <div className="help-text">
              <strong>Need some help?</strong>
              <span>Explore the platform</span>
            </div>

            <FontAwesomeIcon
              icon={faArrowUpRightFromSquare}
              className="help-arrow"
            />
          </div>

          <div className="sidebar-footer">
            <FontAwesomeIcon icon={faGraduationCap} />
            <span>Kisii University</span>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
    </>
  );
}

function StatCard({ icon, label, value, description }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <FontAwesomeIcon icon={icon} />
        </div>

        <span className="stat-period">Overview</span>
      </div>

      <h3>{value}</h3>

      <p className="stat-label">{label}</p>

      <span className="stat-description">{description}</span>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="dashboard">
      <div className="welcome-section">
        <div>
          <span className="welcome-label">
            STUDENT WORKSPACE
          </span>

          <h1>Welcome to EduMatch</h1>

          <p>
            Your space to connect, collaborate and achieve more
            together.
          </p>
        </div>

        <button className="primary-button">
          <FontAwesomeIcon icon={faPlus} />
          Create a group
        </button>
      </div>

      <div className="dashboard-stats">
        <StatCard
          icon={faUsers}
          value="—"
          label="My Groups"
          description="Your active collaborations"
        />

        <StatCard
          icon={faWandMagicSparkles}
          value="—"
          label="Matches"
          description="Potential collaborators"
        />

        <StatCard
          icon={faClipboardCheck}
          value="—"
          label="Pending Tasks"
          description="Tasks awaiting completion"
        />

        <StatCard
          icon={faComments}
          value="—"
          label="Messages"
          description="Your group conversations"
        />
      </div>

      <div className="dashboard-grid">
        <section className="content-card main-card">
          <div className="card-heading">
            <div>
              <h2>My Collaborations</h2>
              <p>
                Stay connected with your academic teams.
              </p>
            </div>

            <button className="text-button">
              View all
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </button>
          </div>

          <div className="empty-state">
            <div className="empty-icon">
              <FontAwesomeIcon icon={faUsers} />
            </div>

            <h3>Your collaborations start here</h3>

            <p>
              Discover students with similar interests and
              join groups working towards shared goals.
            </p>

            <button className="secondary-button">
              Explore groups
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            </button>
          </div>
        </section>

        <section className="content-card activity-card">
          <div className="card-heading">
            <div>
              <h2>Upcoming Tasks</h2>
              <p>Keep track of your commitments.</p>
            </div>

            <FontAwesomeIcon
              icon={faCalendarDays}
              className="muted-icon"
            />
          </div>

          <div className="empty-state compact">
            <div className="empty-icon">
              <FontAwesomeIcon icon={faClock} />
            </div>

            <h3>No upcoming tasks</h3>

            <p>
              Your assigned group tasks will appear here.
            </p>
          </div>
        </section>
      </div>

      <section className="content-card recommendations-card">
        <div className="card-heading">
          <div>
            <h2>Discover Your Next Collaboration</h2>

            <p>
              Find students whose skills and interests
              complement yours.
            </p>
          </div>

          <div className="recommendation-icon">
            <FontAwesomeIcon icon={faWandMagicSparkles} />
          </div>
        </div>

        <div className="recommendation-content">
          <div>
            <span className="recommendation-tag">
              FIND YOUR TEAM
            </span>

            <h3>
              Great things happen when students work together.
            </h3>

            <p>
              Explore potential teammates, discover academic
              groups and bring your ideas to life.
            </p>
          </div>

          <button className="primary-button">
            Find collaborators
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </button>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>© 2026 EduMatch</span>
        <span>Built for student collaboration</span>
      </footer>
    </div>
  );
}

function StudentWorkspace() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="app-layout">
      <Topbar
        activePage={activePage}
        openSidebar={() => setSidebarOpen(true)}
        user={user}
        onLogout={handleLogout}
        onNavigate={setActivePage}
      />
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        open={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />
      <main className="main-area">
        {activePage === 'Dashboard' ? (
          <Dashboard />
        ) : activePage === 'My Profile' ? (
          <ProfilePage />
        ) : activePage === 'Discover Groups' ? (
          <DiscoverGroupsPage />
        ) : (
          <div className="page-placeholder">
            <h1>{activePage}</h1>
            <p>
              This section will be connected to the EduMatch backend as its feature is implemented.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function AdminLanding() {
  const { user, logout } = useAuth();
  return (
    <main className="admin-coming-soon">
      <div className="auth-brand-icon"><FontAwesomeIcon icon={faGraduationCap} /></div>
      <span className="auth-kicker">EDUMATCH ADMINISTRATION</span>
      <h1>Welcome, {user?.fullName || 'Administrator'}</h1>
      <p>Your administrator account is authenticated. The administration workspace will be implemented against dedicated admin APIs.</p>
      <button className="auth-submit admin-logout" onClick={logout}>Sign out</button>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RequestCodePage />} />
      <Route path="/register/verify" element={<VerifyCodePage />} />
      <Route path="/register/complete" element={<CompleteRegistrationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/app" element={<StudentWorkspace />} />
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLanding />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;