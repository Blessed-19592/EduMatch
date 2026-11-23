import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  Compass,
  MessageCircle,
  Settings,
  UserRound,
  UsersRound
} from 'lucide-react';
import './PlatformGuideDialog.css';

const GUIDE_STEPS = [
  {
    icon: UserRound,
    title: 'Build your collaboration profile',
    description: 'Help other students understand what you bring to a team and what you want to work on.',
    details: [
      'Add a short introduction, skills, and interests.',
      'Set your collaboration goals and availability.',
      'Choose a profile picture or keep your initials.'
    ],
    destinations: [{ page: 'My Profile', label: 'Open My Profile' }]
  },
  {
    icon: Compass,
    title: 'Find students who fit your goals',
    description: 'Browse student recommendations and open a profile to learn more before reaching out.',
    details: [
      'Filter recommendations by academic year.',
      'Review students’ skills, interests, and portfolios.',
      'Send a collaboration request with a short introduction.'
    ],
    destinations: [{ page: 'Find Students', label: 'Find Students' }]
  },
  {
    icon: UsersRound,
    title: 'Discover or create a group',
    description: 'Join an existing group or create one around a shared academic or project goal.',
    details: [
      'Explore groups and review their expectations.',
      'Create a group with its objectives and requirements.',
      'Owners can invite eligible collaborators.'
    ],
    destinations: [
      { page: 'Discover Groups', label: 'Discover Groups' },
      { page: 'Create Group', label: 'Create a Group' }
    ]
  },
  {
    icon: ClipboardCheck,
    title: 'Keep requests organized',
    description: 'One place to review the different kinds of collaboration activity on your account.',
    details: [
      'Respond to student collaboration requests.',
      'Accept or decline group invitations.',
      'Review requests to join groups you own.'
    ],
    destinations: [{ page: 'Collaboration Requests', label: 'Open Requests' }]
  },
  {
    icon: MessageCircle,
    title: 'Work together in Messages',
    description: 'Continue the conversation inside your groups and share useful files with members.',
    details: [
      'Open conversations for your active groups.',
      'Share messages, images, and supported files.',
      'Keep group discussions connected to the work.'
    ],
    destinations: [{ page: 'Messages', label: 'Open Messages' }]
  },
  {
    icon: BriefcaseBusiness,
    title: 'Track work and showcase skills',
    description: 'Keep group tasks moving and give collaborators a clear view of your work.',
    details: [
      'Create and follow up on tasks.',
      'Add skills and proficiency levels.',
      'Showcase portfolio projects and public links.'
    ],
    destinations: [
      { page: 'My Tasks', label: 'Open My Tasks' },
      { page: 'Portfolio & Skills', label: 'Open Portfolio & Skills' }
    ]
  },
  {
    icon: Settings,
    title: 'Make EduMatch yours',
    description: 'Review your account preferences and decide whether other students can discover your profile.',
    details: [
      'Manage profile discoverability.',
      'Choose the notifications you want to receive.',
      'Update account preferences when your needs change.'
    ],
    destinations: [{ page: 'Settings', label: 'Open Settings' }]
  }
];

export default function PlatformGuideDialog({ onClose, onNavigate }) {
  const dialogRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);
  const step = GUIDE_STEPS[activeStep];
  const StepIcon = step.icon;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const closeDialog = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };

  const handleCancel = (event) => {
    event.preventDefault();
    closeDialog();
  };

  const handleDialogClick = (event) => {
    if (event.target === event.currentTarget) closeDialog();
  };

  return (
    <dialog
      ref={dialogRef}
      className="platform-guide-dialog"
      aria-labelledby="platform-guide-title"
      onCancel={handleCancel}
      onClick={handleDialogClick}
    >
      <div className="platform-guide-content">
        <header className="platform-guide-header">
          <div className="platform-guide-brand">
            <span className="platform-guide-brand-icon" aria-hidden="true">
              <BookOpen size={19} />
            </span>
            <span>EDUMATCH QUICK GUIDE</span>
          </div>
          <button
            type="button"
            className="platform-guide-close"
            onClick={closeDialog}
            aria-label="Close platform guide"
          >
            ×
          </button>
        </header>

        <div className="platform-guide-intro">
          <p>Welcome to your collaboration workspace</p>
          <h2 id="platform-guide-title">Explore the platform</h2>
          <span>
            Your dashboard gives you a quick overview. Use this guide to learn
            where to find the tools for each step of your collaboration journey.
          </span>
        </div>

        <div className="platform-guide-progress">
          <div className="platform-guide-progress-label">
            <span>Step {activeStep + 1} of {GUIDE_STEPS.length}</span>
            <span>{Math.round(((activeStep + 1) / GUIDE_STEPS.length) * 100)}%</span>
          </div>
          <div
            className="platform-guide-progress-track"
            role="progressbar"
            aria-label="Guide progress"
            aria-valuemin={1}
            aria-valuemax={GUIDE_STEPS.length}
            aria-valuenow={activeStep + 1}
          >
            <span
              style={{ width: `${((activeStep + 1) / GUIDE_STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <section className="platform-guide-step" aria-live="polite">
          <div className="platform-guide-step-icon" aria-hidden="true">
            <StepIcon size={24} />
          </div>
          <div className="platform-guide-step-copy">
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <ul>
              {step.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          </div>
        </section>

        <div className="platform-guide-destinations">
          {step.destinations.map((destination) => (
            <button
              type="button"
              className="platform-guide-open-button"
              key={destination.page}
              onClick={() => onNavigate(destination.page)}
            >
              {destination.label} <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>

        <footer className="platform-guide-footer">
          <button
            type="button"
            className="platform-guide-back-button"
            onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
            disabled={activeStep === 0}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <span>You can reopen this guide from the sidebar anytime.</span>
          {activeStep < GUIDE_STEPS.length - 1 ? (
            <button
              type="button"
              className="platform-guide-next-button"
              onClick={() => setActiveStep((current) => current + 1)}
            >
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="platform-guide-next-button"
              onClick={closeDialog}
            >
              Finish
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
