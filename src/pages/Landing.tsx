import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  FileText,
  Flame,
  FolderOpen,
  Heart,
  Keyboard,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "./Landing.css";

interface LandingProps {
  onGetStarted: () => void;
}

const STEPS = [
  {
    icon: Keyboard,
    num: "1",
    title: "Create a folder",
    body: "Give a subject a name and pick a shortcut like Option + 1. Each folder is its own workspace.",
  },
  {
    icon: FileText,
    num: "2",
    title: "Press the shortcut on any page",
    body: "Open a webpage, hit your shortcut, and select the text you want to save. No tab switching.",
  },
  {
    icon: FolderOpen,
    num: "3",
    title: "Everything lives in one place",
    body: "Search, favorite, edit, or export from the dashboard. Notes stay on your device.",
  },
] as const;

const FEATURES = [
  {
    icon: Keyboard,
    title: "Keyboard-first capture",
    body: "A modifier + key on any page. No popups, no distractions.",
  },
  {
    icon: FolderOpen,
    title: "Organized folders",
    body: "Each subject, project, or study area gets its own shortcut.",
  },
  {
    icon: Search,
    title: "Instant search",
    body: "Find any note by text, title, source, or folder in milliseconds.",
  },
  {
    icon: Heart,
    title: "Favorites",
    body: "Pin the notes worth returning to. One shortcut away, always.",
  },
  {
    icon: FileText,
    title: "PDF export",
    body: "Turn any folder into a clean document with one click.",
  },
  {
    icon: ShieldCheck,
    title: "Local by design",
    body: "No account. No cloud. No tracking. Your notes stay with you.",
  },
] as const;

export default function Landing({ onGetStarted }: LandingProps) {
  return (
    <div className="landing-page">
      <header className="landing-topbar">
        <div className="landing-brand">
          <span className="landing-logo" aria-hidden="true">
            <Sparkles size={16} />
          </span>
          <span className="landing-brand-text">
            <strong>QuickNotes</strong>
            <small>Capture · Organize · Revise</small>
          </span>
        </div>
        <button
          className="landing-top-cta"
          type="button"
          onClick={onGetStarted}
        >
          Get started
          <ArrowRight size={14} />
        </button>
      </header>

      <main className="landing-main">
        {/* ================================
            HERO
        ================================= */}
        <section className="landing-hero">
          <span className="landing-eyebrow">
            <Sparkles size={12} />
            A private notebook for the web
          </span>
          <h1>
            Capture what matters.
            <br />
            <span className="landing-hero-accent">
              Remember it forever.
            </span>
          </h1>
          <p>
            QuickNotes is a keyboard-first note tool that saves highlighted
            text from any webpage into folders you design. Then it
            resurfaces those notes on a smart schedule — so what you saved
            actually stays with you.
          </p>
          <div className="landing-actions">
            <button
              className="landing-cta"
              type="button"
              onClick={onGetStarted}
            >
              Start capturing
              <ArrowRight size={16} />
            </button>
            <span className="landing-hint">
              Takes 30 seconds · Everything stays local
            </span>
          </div>
        </section>

        {/* ================================
            HOW IT WORKS
        ================================= */}
        <section className="landing-steps">
          <div className="landing-section-head">
            <span className="landing-section-eyebrow">How it works</span>
            <h2>Three steps. That's the whole flow.</h2>
          </div>
          <ol className="landing-steps-list">
            {STEPS.map(({ icon: Icon, num, title, body }) => (
              <li key={num}>
                <span className="landing-step-num">{num}</span>
                <div>
                  <div className="landing-step-icon">
                    <Icon size={15} />
                  </div>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ================================
            REVIEW SYSTEM
        ================================= */}
        <section className="landing-review">
          <div className="landing-section-head">
            <span className="landing-section-eyebrow">
              <Flame size={11} />
              The review system
            </span>
            <h2>What you save comes back to you.</h2>
            <p className="landing-section-lede">
              Most note apps are write-only. You save hundreds of highlights
              and never see them again. QuickNotes fixes that with a
              built-in spaced review that resurfaces notes at the right
              time.
            </p>
          </div>

          <div className="landing-review-grid">
            <div className="landing-review-card">
              <div className="landing-review-card-head">
                <Clock size={15} />
                <strong>When notes appear</strong>
              </div>
              <p>
                Every day, QuickNotes picks a short queue from your
                collection. Notes you saved today stay out of the way —
                only notes older than 24 hours can be scheduled.
              </p>
            </div>

            <div className="landing-review-card">
              <div className="landing-review-card-head">
                <RefreshCw size={15} />
                <strong>How they're chosen</strong>
              </div>
              <p>
                Older notes score higher. Favorites get a boost.
                Frequently-reviewed notes quiet down. The result is a
                natural schedule — you keep seeing what you need, when
                you need it.
              </p>
            </div>

            <div className="landing-review-card">
              <div className="landing-review-card-head">
                <Flame size={15} />
                <strong>Build a streak</strong>
              </div>
              <p>
                Review once a day to grow your streak. Miss a day and it
                resets. A small flame in the navbar tells you where you
                stand — and turns into a habit before you notice.
              </p>
            </div>
          </div>

          <div className="landing-review-actions">
            <div className="landing-review-action">
              <span className="landing-review-action-icon is-keep">
                <Check size={14} />
              </span>
              <div>
                <strong>Keep in rotation</strong>
                <span>Advances the note. It'll return later.</span>
              </div>
            </div>

            <div className="landing-review-action">
              <span className="landing-review-action-icon is-skip">
                <RefreshCw size={14} />
              </span>
              <div>
                <strong>Skip</strong>
                <span>Move on without a decision. No score change.</span>
              </div>
            </div>

            <div className="landing-review-action">
              <span className="landing-review-action-icon is-archive">
                <Archive size={14} />
              </span>
              <div>
                <strong>Archive</strong>
                <span>Never surfaces again. Clean up safely.</span>
              </div>
            </div>
          </div>

          <div className="landing-review-note">
            <BookOpen size={13} />
            <span>
              Every decision is reversible. Archived notes stay in your
              folders — they just stop appearing in reviews.
            </span>
          </div>
        </section>

        {/* ================================
            FEATURES
        ================================= */}
        <section className="landing-features">
          <div className="landing-section-head">
            <span className="landing-section-eyebrow">Features</span>
            <h2>Everything you need. Nothing you don't.</h2>
          </div>
          <div className="landing-features-grid">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article className="landing-feature" key={title}>
                <span className="landing-feature-icon">
                  <Icon size={16} />
                </span>
                <strong>{title}</strong>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ================================
            FINAL CTA
        ================================= */}
        <section className="landing-final">
          <h2>Ready when you are.</h2>
          <p>
            Create your first folder, press your shortcut on any page, and
            start building a second brain that actually remembers.
          </p>
          <div className="landing-final-actions">
            <button
              className="landing-cta"
              type="button"
              onClick={onGetStarted}
            >
              Open the dashboard
              <ArrowRight size={16} />
            </button>
            <button
              className="landing-secondary"
              type="button"
              onClick={onGetStarted}
            >
              <ArrowLeft size={14} />
              Skip the tour
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>
          <ShieldCheck size={12} />
          Your notes never leave this device.
        </span>
        <span>QuickNotes · Local-first capture</span>
      </footer>
    </div>
  );
}