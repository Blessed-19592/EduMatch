import { useState, useEffect } from 'react';
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

function Dashboard({ onNavigate, user }) {
  const [myPendingTasks, setMyPendingTasks] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsError, setGroupsError] = useState('');

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await api.get('/groups/my-groups');

        const rows = Array.isArray(response.data?.groups)
          ? response.data.groups
          : [];

        setGroups(rows);
      } catch (error) {
        console.error('Failed to load dashboard groups:', error);
        setGroupsError('Unable to load your groups.');
      } finally {
        setGroupsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
  if (groupsLoading) return;

  if (!user?.userId || groups.length === 0) {
    setMyPendingTasks(0);
    setTasksLoading(false);
    return;
  }

  let active = true;

  const fetchMyTasks = async () => {
    setTasksLoading(true);

    try {
      const responses = await Promise.all(
        groups.map((group) =>
          api.get(`/groups/${group.group_id}/tasks`)
        )
      );

      const allTasks = responses.flatMap((response) =>
        Array.isArray(response.data?.tasks)
          ? response.data.tasks
          : []
      );

      const unfinishedTasks = allTasks.filter(
        (task) =>
          String(task.assigned_to) === String(user.userId) &&
          task.task_status !== 'completed'
      );

      if (active) {
        setMyPendingTasks(unfinishedTasks.length);
      }
    } catch (error) {
      console.error('Failed to load dashboard tasks:', error);
    } finally {
      if (active) {
        setTasksLoading(false);
      }
    }
  };

  fetchMyTasks();

  return () => {
    active = false;
  };
}, [groups, groupsLoading, user?.userId]);

  const totalGroups = groups.length;

  const pendingRequests = groups.reduce(
    (total, group) =>
      total + (group.membership_role === 'owner'
        ? Number(group.pending_requests || 0)
        : 0),
    0
  );

  return (
    <div className="dashboard">

      <header className="dashboard-header">
        <div>
          <span className="welcome-label">STUDENT WORKSPACE</span>
          <h1>Welcome to EduMatch</h1>
          <p>Your space to connect, collaborate and achieve more together.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate('Create Group')}
        >
          <FontAwesomeIcon icon={faPlus} />
              Create a group
          
        </button>
      </header>

      <section className="dashboard-stats">

        <button
          className="stat-card"
          onClick={() => onNavigate('My Groups')}
        >
          <span className="stat-label">My groups</span>
          <strong>{groupsLoading ? '—' : totalGroups}</strong>
          <span className="stat-description">Groups you're part of</span>
        </button>

        <button
          className="stat-card"
          onClick={() => onNavigate('Membership Requests')}
        >
          <span className="stat-label">Pending requests</span>
          <strong>{groupsLoading ? '—' : pendingRequests}</strong>
          <span className="stat-description">Requests for groups you own</span>
        </button>

        <button
          className="stat-card"
          onClick={() => onNavigate('My Tasks')}
        >
          <span className="stat-label">My tasks</span>
          <strong>—</strong>
          <span className="stat-description">View your assigned tasks</span>
        </button>

        <button
          className="stat-card"
          onClick={() => onNavigate('Messages')}
        >
          <span className="stat-label">Messages</span>
          <strong>—</strong>
          <span className="stat-description">Open group conversations</span>
        </button>

      </section>

      <section className="content-card dashboard-groups">

        <div className="card-heading">
          <div>
            <h2>My collaborations</h2>
            <p>Your active student collaborations.</p>
          </div>

          <button
            className="text-button"
            onClick={() => onNavigate('My Groups')}
          >
            View all
          </button>
        </div>

        {groupsLoading ? (
          <p className="dashboard-message">Loading your groups...</p>
        ) : groupsError ? (
          <p className="dashboard-message error">{groupsError}</p>
        ) : groups.length > 0 ? (
          <div className="dashboard-group-list">
            {groups.slice(0, 4).map((group) => (
              <article className="dashboard-group-row" key={group.group_id}>
                <div className="dashboard-group-info">
                  <h3>{group.group_name}</h3>
                  <p>{group.intention_name || 'Collaboration group'}</p>
                </div>

                <div className="dashboard-group-meta">
                  <span>
                    {group.current_members} / {group.max_members} members
                  </span>
                  <span className={`dashboard-status ${String(group.group_status).toLowerCase()}`}>
                    {group.group_status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty">
            <h3>No collaborations yet</h3>
            <p>Create a group or discover one that matches your interests.</p>

            <div className="dashboard-empty-actions">
              <button
                className="secondary-button"
                onClick={() => onNavigate('Discover Groups')}
              >
                Discover groups
              </button>

              <button
                className="text-button"
                onClick={() => onNavigate('Create Group')}
              >
                Create a group
              </button>
            </div>
          </div>
        )}

      </section>

      <section className="dashboard-discovery">
        <div>
          <span>DISCOVER</span>
          <h2>Find people who share your goals.</h2>
          <p>Connect with students, explore their skills and find your next collaboration.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => onNavigate('Find Students')}
        >
          Find collaborators
        </button>
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
        <Dashboard onNavigate={setActivePage} user={user} />
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