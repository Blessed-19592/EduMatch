import { useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useSearchParams } from 'react-router-dom';
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
import CreateGroupPage from './pages/student/CreateGroupPage';
import MyGroupsPage from './pages/student/MyGroupsPage';
import FindStudentsPage from './pages/student/FindStudentsPage';
import CollaborationRequestsPage from './pages/student/CollaborationRequestsPage';
import MessagesPage from './pages/student/MessagesPage';
import TasksPage from './pages/student/TasksPage';
import PortfolioPage from './pages/student/PortfolioPage';
import './components/auth/Auth.css';
import GroupInvitationsPage from './pages/student/GroupInvitationsPage';
import MembershipRequestsInboxPage from './pages/student/MembershipRequestsInboxPage';
import api from './api/api';

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
      {
        label: 'Requests',
        icon: faBell,
        children: [
          { label: 'Collaboration Requests' },
          { label: 'Group Invitations' },
          { label: 'Membership Requests' },
        ],
      },
      { label: 'Discover Groups', icon: faUsers },
      { label: 'My Groups', icon: faFolderOpen },
      { label: 'Messages', icon: faComments },
      { label: 'Create Group', icon: faPlus },
    ],
  },
  {
    title: 'PRODUCTIVITY',
    items: [
      { label: 'My Tasks', icon: faClipboardCheck },
      { label: 'Portfolio & Skills', icon: faFolderOpen },
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
  const requestPages = [
    'Collaboration Requests',
    'Group Invitations',
    'Membership Requests',
  ];

  const [requestsExpanded, setRequestsExpanded] = useState(
    requestPages.includes(activePage)
  );

  const isRequestActive = requestPages.includes(activePage);

  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-content">
          {navigation.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-heading">{section.title}</p>

              {section.items.map((item) => {
                if (item.children) {
                  return (
                    <div className="nav-group" key={item.label}>
                      <button
                        type="button"
                        className={`nav-item ${
                          isRequestActive ? 'active' : ''
                        }`}
                        onClick={() =>
                          setRequestsExpanded((previous) => !previous)
                        }
                        aria-expanded={requestsExpanded}
                      >
                        <FontAwesomeIcon
                          icon={item.icon}
                          className="nav-icon"
                        />

                        <span>{item.label}</span>

                        <span className={`nav-chevron ${
                          requestsExpanded ? 'expanded' : ''
                        }`}>
                          ⌄
                        </span>
                      </button>

                      {requestsExpanded && (
                        <div className="nav-submenu">
                          {item.children.map((child) => (
                            <button
                              type="button"
                              key={child.label}
                              className={`nav-subitem ${
                                activePage === child.label ? 'active' : ''
                              }`}
                              onClick={() => {
                                setActivePage(child.label);
                                closeSidebar();
                              }}
                            >
                              <span className="nav-subitem-indicator" />
                              <span>{child.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <button
                    type="button"
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
                );
              })}
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

function Dashboard({ onNavigate }) {
  const [groups, setGroups] = useState([]);
const [groupsLoading, setGroupsLoading] = useState(true);
const [groupsError, setGroupsError] = useState('');

useEffect(() => {
  const fetchGroups = async () => {
    try {
      const response = await api.get('/groups/my-groups');

      const groupData = response.data.groups ?? response.data;

      setGroups(Array.isArray(groupData) ? groupData : []);
    } catch (error) {
      console.error('Failed to load dashboard groups:', error);
      setGroupsError('Unable to load your groups. Please try again.');
    } finally {
      setGroupsLoading(false);
    }
  };

  fetchGroups();
}, []);

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

        <button
  className="primary-button"
  onClick={() => onNavigate('Create Group')}
>
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

            <button
  className="text-button"
  onClick={() => onNavigate('My Groups')}
>
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

            <button
  className="secondary-button"
  onClick={() => onNavigate('Discover Groups')}
>
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

          <button
  className="primary-button"
  onClick={() => onNavigate('Find Students')}
>
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
        <Dashboard onNavigate={setActivePage} />
    ) : activePage === 'My Profile' ? (
        <ProfilePage />
    ) : activePage === 'Find Students' ? (
        <FindStudentsPage />
    ) : activePage === 'Collaboration Requests' ? (
        <CollaborationRequestsPage />
    ) : activePage === 'Group Invitations' ? (
        <GroupInvitationsPage />
    ) : activePage === 'Membership Requests' ? (
        <MembershipRequestsInboxPage />
    ) : activePage === 'Discover Groups' ? (
        <DiscoverGroupsPage />
    ) : activePage === 'Create Group' ? (
        <CreateGroupPage onNavigate={setActivePage} />
    ) : activePage === 'My Groups' ? (
        <MyGroupsPage onNavigate={setActivePage} />
    ) : activePage === 'Messages' ? (
        <MessagesPage />
    ) : activePage === 'My Tasks' ? (
        <TasksPage />
    ) : activePage === 'Portfolio & Skills' ? (
        <PortfolioPage />
    ) : (
        <div className="page-placeholder">
            <h1>{activePage}</h1>
            <p>
                This section will be connected to the EduMatch backend
                as its feature is implemented.
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

function RegistrationRoute() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') {
    return <div className="auth-loading">Loading EduMatch…</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}



function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />

      {/* Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Registration - accessible only when NOT authenticated */}
      <Route element={<RegistrationRoute />}>
        <Route path="/register" element={<RequestCodePage />} />
        <Route path="/register/verify" element={<VerifyCodePage />} />
        <Route path="/register/complete" element={<CompleteRegistrationPage />} />
      </Route>

      {/* Password recovery */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Student workspace */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="/app" element={<StudentWorkspace />} />
      </Route>

      {/* Administrator workspace */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLanding />} />
      </Route>

      {/* Unknown routes */}
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