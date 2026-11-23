import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RequestCodePage from './pages/auth/RequestCodePage';
import VerifyCodePage from './pages/auth/VerifyCodePage';
import CompleteRegistrationPage from './pages/auth/CompleteRegistrationPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/student/ProfilePage';
import PublicStudentProfilePage from './pages/student/PublicStudentProfilePage';
import DiscoverGroupsPage from './pages/student/DiscoverGroupsPage';
import CreateGroupPage from './pages/student/CreateGroupPage';
import MyGroupsPage from './pages/student/MyGroupsPage';
import FindStudentsPage from './pages/student/FindStudentsPage';
import CollaborationRequestsPage from './pages/student/CollaborationRequestsPage';
import MessagesPage from './pages/student/MessagesPage';
import TasksPage from './pages/student/TasksPage';
import PortfolioPage from './pages/student/PortfolioPage';
import SettingsPage from './pages/student/SettingsPage';
import './components/auth/Auth.css';
import GroupInvitationsPage from './pages/student/GroupInvitationsPage';
import MembershipRequestsInboxPage from './pages/student/MembershipRequestsInboxPage';
import NotificationCenter from './components/NotificationCenter';
import ImageAvatar from './components/ImageAvatar';
import PlatformGuideDialog from './components/PlatformGuideDialog';
import api, { getApiErrorMessage } from './api/api';

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

function Topbar({
  activePage,
  sidebarOpen,
  onToggleSidebar,
  user,
  profilePictureUrl,
  onLogout,
  onNavigate
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href="/" aria-label="EduMatch home">
          <div className="brand-text">
            <h2>
              <span className="brand-edu">Edu</span>
              <span className="brand-match">Match</span>
            </h2>
          </div>
        </a>

        <button
          className="menu-button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={sidebarOpen}
          aria-controls="student-navigation"
        >
          <FontAwesomeIcon icon={sidebarOpen ? faXmark : faBars} />
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

        <NotificationCenter onNavigate={onNavigate} />

        <div className="header-divider" />

        <div className="profile-container">
          <button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
          >
            <ImageAvatar
              src={profilePictureUrl}
              name={user?.fullName || 'Student'}
              colorKey={user?.userId}
              className="avatar"
            />

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

              <button onClick={() => { setProfileOpen(false); onNavigate('Settings'); }}>
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

function Sidebar({
  activePage,
  setActivePage,
  open,
  closeSidebar,
  onOpenGuide
}) {
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
      <aside
        id="student-navigation"
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        aria-label="Student navigation"
      >
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
          <button
            type="button"
            className="sidebar-help"
            onClick={() => {
              closeSidebar();
              onOpenGuide();
            }}
            aria-label="Need some help? Explore the platform"
          >
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
          </button>

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

function StatCard({ icon, label, value, description, onClick }) {
  return (
    <button className="stat-card" type="button" onClick={onClick}>
      <span className="stat-icon" aria-hidden="true">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="stat-content">
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <span className="stat-description">{description}</span>
      </span>
      <FontAwesomeIcon className="stat-arrow" icon={faArrowUpRightFromSquare} aria-hidden="true" />
    </button>
  );
}

function Dashboard({ onNavigate, user }) {
  const [myPendingTasks, setMyPendingTasks] = useState(0);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);
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

    if (groupsError) {
      setTasksError(true);
      setTasksLoading(false);
      return;
    }

    if (!user?.userId || groups.length === 0) {
      setMyPendingTasks(0);
      setTasksError(false);
      setTasksLoading(false);
      return;
    }

    let active = true;

    const fetchMyTasks = async () => {
      setTasksLoading(true);
      setTasksError(false);

      try {
        const responses = await Promise.all(
          groups.map((group) => api.get(`/groups/${group.group_id}/tasks`))
        );
        const allTasks = responses.flatMap((response) =>
          Array.isArray(response.data?.tasks) ? response.data.tasks : []
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
        if (active) {
          setTasksError(true);
        }
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
  }, [groups, groupsError, groupsLoading, user?.userId]);

  const totalGroups = groups.length;
  const pendingRequests = groups.reduce(
    (total, group) =>
      total +
      (group.membership_role === 'owner'
        ? Number(group.pending_requests || 0)
        : 0),
    0
  );
  const firstName = user?.fullName?.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-welcome">
          <span className="welcome-label">YOUR STUDENT WORKSPACE</span>
          <h1>Welcome back, {firstName}</h1>
          <p>Find your people, move projects forward, and make progress together.</p>
        </div>
        <button
          className="primary-button dashboard-create-button"
          type="button"
          onClick={() => onNavigate('Create Group')}
        >
          <FontAwesomeIcon icon={faPlus} />
          Create a group
        </button>
      </header>

      <section className="dashboard-stats" aria-label="Your collaboration overview">
        <StatCard
          icon={faUsers}
          label="My groups"
          value={groupsLoading || groupsError ? '—' : totalGroups}
          description={groupsError ? 'Group data is unavailable' : "Groups you're part of"}
          onClick={() => onNavigate('My Groups')}
        />
        <StatCard
          icon={faBell}
          label="Pending requests"
          value={groupsLoading || groupsError ? '—' : pendingRequests}
          description={groupsError ? 'Group data is unavailable' : 'For groups you own'}
          onClick={() => onNavigate('Membership Requests')}
        />
        <StatCard
          icon={faClipboardCheck}
          label="My open tasks"
          value={tasksLoading || tasksError ? '—' : myPendingTasks}
          description={tasksError ? "Couldn't load your tasks" : 'Assigned to you'}
          onClick={() => onNavigate('My Tasks')}
        />
        <button
          className="dashboard-messages-card"
          type="button"
          onClick={() => onNavigate('Messages')}
        >
          <span className="messages-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faComments} />
          </span>
          <span className="messages-copy">
            <strong>Group messages</strong>
            <span>Continue the conversation with your groups.</span>
          </span>
          <span className="messages-link">Open messages</span>
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
            type="button"
            onClick={() => onNavigate('My Groups')}
          >
            View all
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
          </button>
        </div>

        {groupsLoading ? (
          <p className="dashboard-message" role="status">Loading your groups...</p>
        ) : groupsError ? (
          <p className="dashboard-message error" role="alert">{groupsError}</p>
        ) : groups.length > 0 ? (
          <div className="dashboard-group-list">
            {groups.slice(0, 4).map((group) => (
              <article className="dashboard-group-row" key={group.group_id}>
                <span className="group-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faUsers} />
                </span>
                <div className="dashboard-group-info">
                  <h3>{group.group_name}</h3>
                  <p>{group.intention_name || 'Collaboration group'}</p>
                </div>
                <div className="dashboard-group-meta">
                  <span className="group-member-count">
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
            <span className="empty-groups-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faUsers} />
            </span>
            <h3>No collaborations yet</h3>
            <p>Create a group or discover one that matches your interests.</p>
            <div className="dashboard-empty-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => onNavigate('Discover Groups')}
              >
                Discover groups
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => onNavigate('Create Group')}
              >
                Create a group
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-discovery">
        <span className="discovery-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faGlobe} />
        </span>
        <div className="discovery-copy">
          <span className="discovery-eyebrow">DISCOVER</span>
          <h2>Find people who share your goals.</h2>
          <p>Connect with students, explore their skills and find your next collaboration.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => onNavigate('Find Students')}
        >
          Find collaborators
          <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
        </button>
      </section>

      <footer className="dashboard-footer">
        <span>EduMatch</span>
        <span>Built for student collaboration</span>
      </footer>
    </div>
  );
}

function StudentWorkspace() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const publicProfileMatch = useMatch('/app/students/:studentId');
  const publicStudentId = publicProfileMatch?.params.studentId;
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const profilePictureRevision = useRef(0);

  const handleProfilePictureChange = useCallback((pictureUrl) => {
    profilePictureRevision.current += 1;
    setProfilePictureUrl(pictureUrl ?? null);
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await api.get('/settings');
      const loadedSettings = response.data?.data?.settings;

      if (
        !loadedSettings ||
        typeof loadedSettings !== 'object' ||
        Array.isArray(loadedSettings)
      ) {
        throw new Error('The server returned invalid account settings.');
      }

      setSettings(loadedSettings);
    } catch (requestError) {
      setSettings(null);
      setSettingsError(
        getApiErrorMessage(requestError, 'Could not load your account settings.')
      );
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let active = true;
    const revisionAtRequest = profilePictureRevision.current;

    api.get('/students/me/profile')
      .then(({ data }) => {
        if (active && profilePictureRevision.current === revisionAtRequest) {
          setProfilePictureUrl(data?.data?.profile_picture_url ?? null);
        }
      })
      .catch((error) => {
        console.error('Unable to load the account profile picture:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const retrySettings = useCallback(() => {
    setSettingsLoading(true);
    setSettingsError('');
    loadSettings();
  }, [loadSettings]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const displayedPage = publicStudentId ? 'Student Profile' : activePage;
  const openStudentProfile = (studentId) => {
    navigate(`/app/students/${encodeURIComponent(studentId)}`, {
      state: { returnTo: location.pathname }
    });
  };
  const closeStudentProfile = () => {
    const returnTo = location.state?.returnTo;
    const safeReturnTo = typeof returnTo === 'string' && returnTo.startsWith('/app')
      ? returnTo
      : '/app';
    navigate(safeReturnTo, { replace: safeReturnTo === '/app' && !returnTo });
  };

  return (
    <div className="app-layout">
      <Topbar
        activePage={displayedPage}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        user={user}
        profilePictureUrl={profilePictureUrl}
        onLogout={handleLogout}
        onNavigate={setActivePage}
      />

      <Sidebar
        activePage={displayedPage}
        setActivePage={setActivePage}
        open={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
        onOpenGuide={() => setGuideOpen(true)}
      />

      <main className="main-area">
    {publicStudentId ? (
        <PublicStudentProfilePage
          key={publicStudentId}
          studentId={publicStudentId}
          onBack={closeStudentProfile}
          currentUserId={user?.userId}
        />
    ) : activePage === 'Dashboard' ? (
        <Dashboard onNavigate={setActivePage} user={user} />
    ) : activePage === 'My Profile' ? (
        <ProfilePage onPictureChange={handleProfilePictureChange} />
    ) : activePage === 'Find Students' ? (
        <FindStudentsPage onViewProfile={openStudentProfile} />
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
    ) : activePage === 'Settings' ? (
        <SettingsPage
          user={user}
          settings={settings}
          loading={settingsLoading}
          error={settingsError}
          onNavigate={setActivePage}
          onSettingsChange={setSettings}
          onRetry={retrySettings}
        />
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
      {guideOpen && (
        <PlatformGuideDialog
          onClose={() => setGuideOpen(false)}
          onNavigate={(page) => {
            setActivePage(page);
            setGuideOpen(false);
          }}
        />
      )}
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
        <Route path="/app/*" element={<StudentWorkspace />} />
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