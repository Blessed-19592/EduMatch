import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faUsers, faLightbulb, faBookOpen } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

export default function AuthLayout({ children, eyebrow = 'STUDENT COLLABORATION', title, subtitle }) {
  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="EduMatch introduction">
        <Link to="/login" className="auth-brand">
          <span className="auth-brand-icon"><FontAwesomeIcon icon={faGraduationCap} /></span>
          <span><strong>EduMatch</strong><small>LEARN. CONNECT. GROW.</small></span>
        </Link>
        <div className="auth-visual-content">
          <span className="auth-kicker">BUILT FOR KISII UNIVERSITY</span>
          <h1>Better learning<br />happens <em>together.</em></h1>
          <p>Find the right people, share knowledge and turn your academic goals into meaningful collaborations.</p>
          <div className="auth-feature-list">
            <div><FontAwesomeIcon icon={faUsers} /><span>Connect with fellow students</span></div>
            <div><FontAwesomeIcon icon={faLightbulb} /><span>Discover complementary skills</span></div>
            <div><FontAwesomeIcon icon={faBookOpen} /><span>Make progress together</span></div>
          </div>
        </div>
        <span className="auth-visual-footer">© 2026 EduMatch · Kisii University</span>
      </section>
      <section className="auth-panel">
        <div className="auth-card-wrap">
          <div className="auth-mobile-brand">
            <span className="auth-brand-icon"><FontAwesomeIcon icon={faGraduationCap} /></span>
            <strong>EduMatch</strong>
          </div>
          <div className="auth-heading">
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          {children}
          <p className="auth-legal">By continuing, you agree to use EduMatch responsibly and respectfully.</p>
        </div>
      </section>
    </main>
  );
}
