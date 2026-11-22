import authBackground from '../../assets/edumatch-auth-bg.jpg';

export default function AuthLayout({ eyebrow, title, subtitle, children }) {
  return (
    <main
      className="auth-page"
      style={{ '--auth-background': `url(${authBackground})` }}
    >
      <div className="auth-background-overlay" />

      <header className="auth-header">
  <a href="/login" className="auth-logo">
    <span>Edu</span><strong>Match</strong>
  </a>

  <nav className="auth-nav">
    <span>LEARN. CONNECT. GROW.</span>
  </nav>
</header>

      <div className="auth-content">
        <section className="auth-introduction">
  <h1>
    Find your people.
    <span className="auth-tagline">
  Build something <span className="auth-meaningful">meaningful.</span>
</span>
  </h1>

  <p>
    Connect with students, share ideas and turn your
    academic ambitions into achievements.
  </p>
</section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          {children}
        </section>
      </div>

      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} EduMatch</span>
        <span>Built for collaboration. Designed for growth.</span>
      </footer>
    </main>
  );
}
