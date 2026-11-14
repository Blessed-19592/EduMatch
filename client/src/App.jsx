import { useState } from 'react';

import {
  LayoutDashboard,
  Users,
  UserRound,
  Sparkles,
  FolderKanban,
  MessageSquare,
  ClipboardList,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  GraduationCap,
  Plus,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Clock3,
  ShieldCheck,
} from 'lucide-react';

import './App.css';

const navigation = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard },
      { label: 'My Profile', icon: UserRound },
    ],
  },
  {
    title: 'COLLABORATION',
    items: [
      { label: 'Find Students', icon: Sparkles },
      { label: 'Discover Groups', icon: Users },
      { label: 'My Groups', icon: FolderKanban },
      { label: 'Messages', icon: MessageSquare },
    ],
  },
  {
    title: 'PRODUCTIVITY',
    items: [
      { label: 'My Tasks', icon: ClipboardList },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { label: 'Settings', icon: Settings },
    ],
  },
];

function Sidebar({ activePage, setActivePage, open, closeSidebar }) {
  return (
    <>
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={25} />
          </div>

          <div className="brand-text">
            <h2>EduMatch</h2>
            <span>LEARN. CONNECT. GROW.</span>
          </div>

          <button
            className="mobile-close"
            onClick={closeSidebar}
            aria-label="Close navigation"
          >
            <X size={21} />
          </button>
        </div>

        <div className="sidebar-content">
          {navigation.map((section) => (
            <div className="nav-section" key={section.title}>
              <p className="nav-heading">{section.title}</p>

              {section.items.map((item) => {
                const Icon = item.icon;

                return (
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
                    <Icon size={19} strokeWidth={1.8} />
                    <span>{item.label}</span>

                    {item.label === 'Messages' && (
                      <span className="nav-indicator" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <div className="help-icon">
              <BookOpen size={19} />
            </div>

            <div>
              <strong>Need some help?</strong>
              <span>Explore the platform</span>
            </div>

            <ArrowUpRight size={17} />
          </div>

          <div className="sidebar-footer">
            <ShieldCheck size={15} />
            <span>Kisii University</span>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}
    </>
  );
}

function Header({ activePage, openSidebar }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="header-left">
        <button
          className="menu-button"
          onClick={openSidebar}
          aria-label="Open navigation"
        >
          <Menu size={23} />
        </button>

        <div className="breadcrumb">
          <span>EduMatch</span>
          <span className="breadcrumb-divider">/</span>
          <strong>{activePage}</strong>
        </div>
      </div>

      <div className="header-right">
        <div className="search-box">
          <Search size={18} />

          <input
            type="search"
            placeholder="Search students, groups..."
            aria-label="Search students and groups"
          />

          <kbd>⌘ K</kbd>
        </div>

        <button
          className="notification-button"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="notification-dot" />
        </button>

        <div className="header-divider" />

        <button
          className="profile-button"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <div className="avatar">LB</div>

          <div className="profile-info">
            <strong>Student</strong>
            <span>My account</span>
          </div>

          <ChevronDown size={16} />
        </button>

        {profileOpen && (
          <div className="profile-dropdown">
            <button>My Profile</button>
            <button>Account Settings</button>
            <button>Sign Out</button>
          </div>
        )}
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className="stat-icon">
          <Icon size={21} />
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
          <span className="welcome-label">STUDENT WORKSPACE</span>

          <h1>Welcome to EduMatch</h1>

          <p>
            Your space to connect, collaborate and achieve more
            together.
          </p>
        </div>

        <button className="primary-button">
          <Plus size={18} />
          Create a group
        </button>
      </div>

      <div className="dashboard-stats">
        <StatCard
          icon={Users}
          value="—"
          label="My Groups"
          description="Your active collaborations"
        />

        <StatCard
          icon={Sparkles}
          value="—"
          label="Matches"
          description="Potential collaborators"
        />

        <StatCard
          icon={ClipboardList}
          value="—"
          label="Pending Tasks"
          description="Tasks awaiting completion"
        />

        <StatCard
          icon={MessageSquare}
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
              <p>Stay connected with your academic teams.</p>
            </div>

            <button className="text-button">
              View all <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="empty-state">
            <div className="empty-icon">
              <Users size={27} />
            </div>

            <h3>Your collaborations start here</h3>

            <p>
              Discover students with similar interests and
              join groups working towards shared goals.
            </p>

            <button className="secondary-button">
              Explore groups
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>

        <section className="content-card activity-card">
          <div className="card-heading">
            <div>
              <h2>Upcoming Tasks</h2>
              <p>Keep track of your commitments.</p>
            </div>

            <CalendarDays size={19} className="muted-icon" />
          </div>

          <div className="empty-state compact">
            <div className="empty-icon">
              <Clock3 size={25} />
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
              Find students whose skills and interests complement yours.
            </p>
          </div>

          <div className="recommendation-icon">
            <Sparkles size={22} />
          </div>
        </div>

        <div className="recommendation-content">
          <div>
            <span className="recommendation-tag">
              FIND YOUR TEAM
            </span>

            <h3>Great things happen when students work together.</h3>

            <p>
              Explore potential teammates, discover academic
              groups and bring your ideas to life.
            </p>
          </div>

          <button className="primary-button">
            Find collaborators
            <ArrowUpRight size={17} />
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

function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        open={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />

      <main className="main-area">
        <Header
          activePage={activePage}
          openSidebar={() => setSidebarOpen(true)}
        />

        {activePage === 'Dashboard' ? (
          <Dashboard />
        ) : (
          <div className="page-placeholder">
            <h1>{activePage}</h1>
            <p>
              This section will be connected to the EduMatch
              backend as we implement its functionality.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;