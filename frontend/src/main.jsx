import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarDays,
  QrCode,
  ClipboardList,
  BarChart3,
  Settings,
  ShieldCheck,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  LogOut,
  Check,
  CheckCircle2,
  X,
  Download,
  Clock,
  Activity,
  Menu,
  Building2,
  UserRound,
  ScanLine,
  Camera,
  RefreshCw,
  AlertCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MoreHorizontal,
  CheckSquare,
  FileSpreadsheet,
  Wifi,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import QRCode from "qrcode";
import { Html5Qrcode } from "html5-qrcode";
import { io } from "socket.io-client";
import { api, refresh, setToken, getToken, download } from "./api";
import "./styles.css";
const icons = {
  Overview: LayoutDashboard,
  Students: Users,
  Faculty: GraduationCap,
  Academics: BookOpen,
  Timetable: CalendarDays,
  Attendance: QrCode,
  Reports: BarChart3,
  Notifications: Bell,
  "Audit trail": ShieldCheck,
  Settings,
  Profile: UserRound,
  "Scan QR": ScanLine,
};
const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const id = (x) => (typeof x === "object" ? x?._id : x);
const date = (x) =>
  new Date(x).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const clock = (x) =>
  new Date(x).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
const initials = (name) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
function Button({ children, icon: Icon, className = "", ...props }) {
  return (
    <button className={`button ${className}`} {...props}>
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>
      {["active", "present"].includes(status) && <span className="dot" />}
      {status}
    </span>
  );
}
function Empty({
  title = "Nothing here yet",
  text = "Your records will appear here as you begin.",
  action,
}) {
  return (
    <div className="empty">
      <ClipboardList size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Modal({ title, description, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose}>
      <div className="modal-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Stat({ label, value, sub, icon: Icon, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">
          <Icon size={19} />
        </div>
      </div>
      <strong>{value ?? "—"}</strong>
      <p>{sub}</p>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState("Overview"),
    [catalog, setCatalog] = useState(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [version, setVersion] = useState(0);
  const notify = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 4500);
  };
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => {
    refresh()
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setBoot(false));
    const expired = () => {
      setUser(null);
      setCatalog(null);
      setToken(null);
    };
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, []);
  useEffect(() => {
    if (user && !user.mustChangePassword)
      api("/catalog")
        .then(setCatalog)
        .catch((e) => setError(e.message));
  }, [user, version]);
  useEffect(() => {
    setError("");
    setMenu(false);
  }, [page]);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setToken(null);
      setUser(null);
      setCatalog(null);
      setPage("Overview");
    } catch (e) {
      setError(e.message);
    }
  }
  const nav =
    user?.role === "admin"
      ? [
          "Overview",
          "Students",
          "Faculty",
          "Academics",
          "Timetable",
          "Attendance",
          "Reports",
        ]
      : user?.role === "faculty"
        ? ["Overview", "Timetable", "Attendance", "Reports"]
        : ["Overview", "Scan QR", "Attendance", "Reports"];
  const ctx = {
    user,
    catalog,
    page,
    setPage,
    notify,
    reload,
    version,
    setError,
  };
  if (boot)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Check size={28} />
        </div>
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(d) => {
          setToken(d.token);
          setUser(d.user);
          setPage("Overview");
        }}
      />
    );
  if (user.mustChangePassword)
    return (
      <div className="password-screen">
        <div className="panel">
          <Brand />
          <h2>Make this account yours.</h2>
          <p>Change your temporary password to continue.</p>
          <PasswordForm
            onDone={() => {
              setToken(null);
              setUser(null);
            }}
          />
        </div>
      </div>
    );
  return (
    <div className="app">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          <span className="workspace-icon">
            <Building2 size={17} />
          </span>
          <div>
            <strong>Campus workspace</strong>
            <small>
              {user.role === "admin"
                ? "Administration"
                : user.role === "faculty"
                  ? "Faculty workspace"
                  : "Student workspace"}
            </small>
          </div>
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav>
          {nav.map((n) => {
            const Icon = icons[n];
            return (
              <button
                key={n}
                className={page === n ? "selected" : ""}
                onClick={() => setPage(n)}
              >
                <Icon size={19} />
                <span>
                  {n === "Attendance" && user.role === "student"
                    ? "My attendance"
                    : n}
                </span>
                {page === n && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="nav-caption">MANAGE</span>
          <nav>
            {[
              "Notifications",
              ...(user.role === "admin" ? ["Audit trail", "Settings"] : []),
              "Profile",
            ].map((n) => {
              const Icon = icons[n];
              return (
                <button
                  key={n}
                  className={page === n ? "selected" : ""}
                  onClick={() => setPage(n)}
                >
                  <Icon size={18} />
                  {n}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Attendance, with confidence.</strong>
              <p>Verified scans. Clear records.</p>
            </div>
          </div>
          <button className="user-card" onClick={() => setPage("Profile")}>
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        </div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="crumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="top-actions">
            <span className="today">
              <CalendarDays size={15} />
              {date(Date.now())}
            </span>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() => setPage("Notifications")}
            >
              <Bell size={19} />
            </button>
            <span className="divider" />
            <span className="avatar small">{initials(user.name)}</span>
          </div>
        </header>
        <main>
          <div className="institution">
            <span className="dot" />
            {catalog?.settings.collegeName || "Campus attendance"}
          </div>
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={18} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!catalog ? (
            <div className="panel">
              <p>Loading your workspace…</p>
              <Button onClick={reload} icon={RefreshCw}>
                Retry
              </Button>
            </div>
          ) : page === "Overview" ? (
            <Overview {...ctx} />
          ) : page === "Students" || page === "Faculty" ? (
            <People
              {...ctx}
              role={page === "Students" ? "student" : "faculty"}
            />
          ) : page === "Academics" ? (
            <Academics {...ctx} />
          ) : page === "Timetable" ? (
            <Timetable {...ctx} />
          ) : page === "Attendance" ? (
            <AttendancePage {...ctx} />
          ) : page === "Scan QR" ? (
            <Scanner {...ctx} />
          ) : page === "Reports" ? (
            <Reports {...ctx} />
          ) : page === "Settings" ? (
            <SettingsPage {...ctx} />
          ) : page === "Audit trail" ? (
            <AuditPage {...ctx} />
          ) : page === "Notifications" ? (
            <Notifications {...ctx} />
          ) : (
            <Profile user={user} logout={logout} notify={notify} />
          )}
          <footer>
            <span>
              Attendly <b>•</b> A clear view of every classroom.
            </span>
            <span>
              <ShieldCheck size={13} /> Secure campus workspace
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Check size={24} strokeWidth={3} />
      </span>
      attendly<span className="brand-period">.</span>
    </div>
  );
}
function Login({ onLogin }) {
  const reset = new URLSearchParams(location.search).get("reset");
  const [mode, setMode] = useState(reset ? "reset" : "login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login")
        onLogin(
          await api("/auth/login", {
            method: "POST",
            body: { email, password },
          }),
        );
      else if (mode === "forgot") {
        const d = await api("/auth/forgot", {
          method: "POST",
          body: { email },
        });
        setMessage(d.message);
      } else {
        await api("/auth/reset", {
          method: "POST",
          body: { token: reset, newPassword: password },
        });
        history.replaceState(null, "", "/");
        setMode("login");
        setMessage("Password updated. Sign in to continue.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow light">MADE FOR THE EVERYDAY CAMPUS</span>
          <h1>
            Less taking attendance.
            <br />
            <em>More being present.</em>
          </h1>
          <p>
            A connected workspace for your people, classrooms, and every moment
            of learning.
          </p>
          <div className="login-illustration">
            <div className="mini-window">
              <span className="mini-label">
                <span className="dot" /> CLASSROOM CONNECTED
              </span>
              <div className="mini-row">
                <span className="avatar">AK</span>
                <div>
                  <b>One scan. You're here.</b>
                  <small>Verified attendance, in real time.</small>
                </div>
                <span className="check-disc">
                  <Check size={20} />
                </span>
              </div>
              <div className="mini-bars">
                {[45, 70, 54, 86, 66, 92, 78, 100, 84, 96, 88, 100].map(
                  (h, i) => (
                    <i key={i} style={{ height: h + "%" }} />
                  ),
                )}
              </div>
              <div className="mini-foot">
                <span>Clarity for every class.</span>
                <ArrowUpRight size={18} />
              </div>
            </div>
            <span className="floating-label">
              <ShieldCheck size={17} /> Signed & verified
            </span>
          </div>
        </div>
        <div className="story-footer">
          <span>Thoughtfully built for education.</span>
          <span>01 / 03</span>
        </div>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <span className="eyebrow">YOUR CAMPUS, CONNECTED</span>
          <h2>
            {mode === "login"
              ? "Welcome back."
              : mode === "forgot"
                ? "Let’s get you back in."
                : "A fresh start."}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to your Attendly workspace."
              : mode === "forgot"
                ? "We’ll email you a secure password reset link."
                : "Choose a strong password for your account."}
          </p>
          {error && <div className="alert error">{error}</div>}
          {message && <div className="alert success">{message}</div>}
          <form onSubmit={submit}>
            {mode !== "reset" && (
              <Field label="Email address">
                <div className="input-icon">
                  <Mail size={17} />
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </Field>
            )}
            {mode !== "forgot" && (
              <Field label={mode === "reset" ? "New password" : "Password"}>
                <div className="input-icon">
                  <Lock size={17} />
                  <input
                    type={show ? "text" : "password"}
                    autoComplete={
                      mode === "reset" ? "new-password" : "current-password"
                    }
                    required
                    minLength={mode === "reset" ? 12 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    aria-label="Show or hide password"
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Field>
            )}
            {mode === "reset" && (
              <p className="hint">
                At least 12 characters with uppercase, lowercase and a number.
              </p>
            )}
            {mode === "login" && (
              <button
                className="text-button forgot"
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                }}
              >
                Forgot password?
              </button>
            )}
            <Button className="primary full" disabled={busy} icon={ArrowRight}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in to workspace"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Update password"}
            </Button>
          </form>
          {mode !== "login" ? (
            <button
              className="text-button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Back to sign in
            </button>
          ) : (
            <p className="login-help">
              New to your campus workspace?
              <br />
              Contact your administrator for an account.
            </p>
          )}
          <div className="login-security">
            <ShieldCheck size={16} />
            Secure access for students, faculty & administrators
          </div>
        </div>
        <span className="login-copyright">
          © {new Date().getFullYear()} Attendly. Every class counts.
        </span>
      </section>
    </div>
  );
}
function Heading({ eyebrow, title, text, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Overview(ctx) {
  const { user, catalog, setPage, setError, version } = ctx;
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [version]);
  if (!data) return <p>Loading attendance insights…</p>;
  const low = data.summary.filter(
    (x) => x.percentage !== null && x.percentage < catalog.settings.threshold,
  );
  return (
    <>
      <Heading
        title={`Hello, ${user.name.split(" ")[0]}.`}
        text="Here’s what’s happening across your classroom today."
      >
        <Button icon={Download} onClick={() => setPage("Reports")}>
          View reports
        </Button>
        <Button
          className="primary"
          icon={user.role === "student" ? ScanLine : Plus}
          onClick={() =>
            setPage(user.role === "student" ? "Scan QR" : "Attendance")
          }
        >
          {user.role === "student" ? "Scan attendance" : "Start a session"}
        </Button>
      </Heading>
      <div className="welcome-banner">
        <div>
          <span className="eyebrow light">EVERY CLASS COUNTS</span>
          <h2>
            A little less admin.
            <br />A lot more learning.
          </h2>
          <p>Your attendance workflow, all in one place.</p>
          <button
            onClick={() =>
              setPage(user.role === "student" ? "Reports" : "Attendance")
            }
          >
            {user.role === "student"
              ? "Explore your progress"
              : "Open attendance workspace"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="art-card">
            <QrCode size={55} />
            <span>SCAN. VERIFY. PRESENT.</span>
          </div>
          <div className="art-check">
            <Check size={25} />
          </div>
          <div className="art-dots">✦</div>
        </div>
        <div className="banner-side">
          <span className="pill">A CONNECTED CAMPUS</span>
          <strong>
            Clear records.
            <br />
            Confident decisions.
          </strong>
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label={user.role === "admin" ? "Active students" : "Subjects tracked"}
          value={
            user.role === "admin"
              ? data.stats.students
              : new Set(data.summary.map((s) => id(s.subjectId))).size
          }
          sub={
            user.role === "admin"
              ? "Enrolled in your workspace"
              : "Across completed sessions"
          }
          icon={Users}
        />
        <Stat
          label="Attendance rate"
          value={data.stats.rate === null ? "—" : data.stats.rate + "%"}
          sub="From completed attendance records"
          icon={Activity}
          tone="green"
        />
        <Stat
          label="Live sessions"
          value={data.stats.active}
          sub="Currently accepting attendance"
          icon={QrCode}
        />
        <Stat
          label="Needs attention"
          value={low.length}
          sub={`Student–subject pairs below ${catalog.settings.threshold}%`}
          icon={AlertCircle}
          tone="amber"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <div>
              <h2>Attendance overview</h2>
              <p>A clearer picture of participation.</p>
            </div>
            <span className="subtle-label">Last 14 teaching dates</span>
          </div>
          {data.trend.length ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.trend}
                  margin={{ left: -20, right: 12, top: 15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="attendanceGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#318573"
                        stopOpacity={0.23}
                      />
                      <stop offset="100%" stopColor="#318573" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="#edf0ed"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en", {
                        day: "numeric",
                        month: "short",
                      })
                    }
                    tick={{ fontSize: 10, fill: "#89928d" }}
                    minTickGap={30}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#89928d" }}
                    tickFormatter={(v) => v + "%"}
                  />
                  <Tooltip formatter={(v) => [v + "%", "Attendance"]} />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#287964"
                    strokeWidth={2.5}
                    fill="url(#attendanceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty
              title="Your story starts with a class"
              text="Complete a session to see attendance trends."
            />
          )}
          <div className="chart-note">
            <span className="dot" /> Attendance rate{" "}
            <span>Cancelled sessions are excluded.</span>
          </div>
        </section>
        <section className="panel quick-panel">
          <div className="panel-title">
            <div>
              <h2>Quick actions</h2>
              <p>A shortcut to your everyday.</p>
            </div>
            <span className="icon-muted">
              <ArrowUpRight size={18} />
            </span>
          </div>
          {(user.role === "admin"
            ? [
                [
                  "Students",
                  "Add & manage students",
                  "Keep your class lists up to date",
                  Users,
                ],
                [
                  "Timetable",
                  "Plan your timetable",
                  "Give every class its place",
                  CalendarDays,
                ],
                [
                  "Reports",
                  "Download reports",
                  "The numbers that matter",
                  FileSpreadsheet,
                ],
              ]
            : user.role === "faculty"
              ? [
                  [
                    "Attendance",
                    "Take attendance",
                    "Start a verified QR session",
                    QrCode,
                  ],
                  [
                    "Timetable",
                    "View your schedule",
                    "Know what’s coming next",
                    CalendarDays,
                  ],
                  [
                    "Reports",
                    "Class reports",
                    "Understand participation",
                    BarChart3,
                  ],
                ]
              : [
                  [
                    "Scan QR",
                    "Mark your attendance",
                    "Scan the code in your classroom",
                    ScanLine,
                  ],
                  [
                    "Reports",
                    "Check your progress",
                    "Your attendance at a glance",
                    BarChart3,
                  ],
                  [
                    "Timetable",
                    "Your timetable",
                    "Plan your learning day",
                    CalendarDays,
                  ],
                ]
          ).map(([page, title, text, Icon]) => (
            <button
              key={page}
              className="quick-action"
              onClick={() => setPage(page)}
            >
              <span>
                <Icon size={20} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{text}</small>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
          <div className="tip">
            <span>GOOD TO KNOW</span>
            <p>
              Every attendance correction includes a reason and an audit record.
            </p>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Recent sessions</h2>
            <p>Your classroom activity, at a glance.</p>
          </div>
          <button className="text-button" onClick={() => setPage("Attendance")}>
            View all sessions <ArrowRight size={15} />
          </button>
        </div>
        <SessionTable
          sessions={data.sessions}
          onSelect={() => setPage("Attendance")}
        />
      </section>
    </>
  );
}
function SessionTable({ sessions, onSelect }) {
  return sessions.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SUBJECT & CLASS</th>
            <th>DATE</th>
            <th>FACULTY</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s._id}>
              <td>
                <div className="subject-cell">
                  <span className="table-icon">
                    <BookOpen size={18} />
                  </span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>{s.classId?.name || "Class session"}</small>
                  </div>
                </div>
              </td>
              <td>
                {date(s.startsAt)}
                <small>
                  {clock(s.startsAt)} – {clock(s.endsAt)}
                </small>
              </td>
              <td>{s.facultyId?.name || "Assigned faculty"}</td>
              <td>
                <Badge status={s.status} />
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open ${s.title}`}
                  onClick={() => onSelect(s._id)}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="No attendance sessions yet"
      text="Start your first class session to begin collecting attendance."
    />
  );
}
function RecordForm({ title, fields, initial = {}, onSave, onClose }) {
  const [values, setValues] = useState(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.key,
          initial[f.key] ?? f.default ?? (f.type === "checkbox" ? true : ""),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = {};
      for (const f of fields) {
        const v = values[f.key];
        if (v === "" && f.optional) continue;
        data[f.key] = f.type === "number" ? Number(v) : v;
      }
      await onSave(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <div className="form-grid">
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.options ? (
                <select
                  required={!f.optional}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                >
                  <option value="">Choose {f.label.toLowerCase()}</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={values[f.key]}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.checked })
                  }
                />
              ) : (
                <input
                  type={f.type || "text"}
                  required={!f.optional}
                  min={f.min}
                  max={f.max}
                  minLength={f.minLength}
                  maxLength={f.maxLength || 150}
                  autoComplete={f.type === "password" ? "new-password" : "off"}
                  value={values[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              )}{" "}
              {f.hint && <small>{f.hint}</small>}
            </Field>
          ))}
        </div>
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="primary" disabled={busy} icon={Check}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function People(ctx) {
  const { catalog, role, reload, notify, setError } = ctx;
  const [q, setQ] = useState(""),
    [modal, setModal] = useState(null),
    [importing, setImporting] = useState(false),
    [resetUser, setResetUser] = useState(null),
    [p, setP] = useState(1);
  const rows = catalog.users.filter(
    (u) =>
      u.role === role &&
      `${u.name} ${u.code} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  const options = (list) => list.map((x) => ({ value: x._id, label: x.name }));
  const fields = [
    { key: "name", label: "Full name" },
    { key: "email", label: "Email address", type: "email" },
    {
      key: "code",
      label: role === "student" ? "Register number" : "Employee ID",
    },
    ...(role === "student"
      ? [{ key: "classId", label: "Class", options: options(catalog.classes) }]
      : []),
    {
      key: "departmentId",
      label: "Department",
      options: options(catalog.departments),
      optional: true,
    },
    ...(modal === "new"
      ? [
          {
            key: "password",
            label: "Temporary password",
            type: "password",
            minLength: 12,
            hint: "12+ characters, uppercase, lowercase and a number. Change required at first login.",
          },
        ]
      : [{ key: "isActive", label: "Active account", type: "checkbox" }]),
  ];
  return (
    <>
      <Heading
        title={role === "student" ? "Students" : "Faculty"}
        text={
          role === "student"
            ? "Your student community, thoughtfully organized."
            : "The people behind every great classroom."
        }
      >
        <>
          {role === "student" && (
            <Button icon={FileSpreadsheet} onClick={() => setImporting(true)}>
              Bulk import
            </Button>
          )}
          <Button
            className="primary"
            icon={Plus}
            onClick={() => setModal("new")}
          >
            Add {role}
          </Button>
        </>
      </Heading>
      <div className="stats-grid three">
        <Stat
          label={`Total ${role === "student" ? "students" : "faculty"}`}
          value={rows.length}
          sub="Matching your current search"
          icon={Users}
        />
        <Stat
          label="Active accounts"
          value={rows.filter((x) => x.isActive).length}
          sub="Allowed to access the workspace"
          icon={CheckCircle2}
        />
        <Stat
          label="Departments"
          value={catalog.departments.length}
          sub="Connected academic departments"
          icon={Building2}
        />
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>
            {role === "student" ? "Student directory" : "Faculty directory"}
          </h2>
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="Search people"
              placeholder="Search name, ID or email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setP(1);
              }}
            />
          </div>
        </div>
        {rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>
                      {role === "student" ? "REGISTER NO." : "EMPLOYEE ID"}
                    </th>
                    <th>{role === "student" ? "CLASS" : "DEPARTMENT"}</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((p - 1) * 15, p * 15).map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div className="person-cell">
                          <span className="avatar">{initials(u.name)}</span>
                          <div>
                            <strong>{u.name}</strong>
                            <small>{u.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="mono">{u.code}</span>
                      </td>
                      <td>
                        {(role === "student"
                          ? catalog.classes.find((c) => c._id === u.classId)
                          : catalog.departments.find(
                              (d) => d._id === u.departmentId,
                            )
                        )?.name || "—"}
                      </td>
                      <td>
                        <Badge status={u.isActive ? "active" : "inactive"} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="text-button"
                            onClick={() => setModal(u)}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Reset password for ${u.name}`}
                            onClick={() => setResetUser(u)}
                          >
                            <Lock size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {rows.length} records · Page {p}
              </span>
              <div>
                <Button
                  disabled={p === 1}
                  onClick={() => setP(p - 1)}
                  icon={ChevronLeft}
                >
                  Previous
                </Button>
                <Button
                  disabled={p * 15 >= rows.length}
                  onClick={() => setP(p + 1)}
                  icon={ChevronRight}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={`Add your first ${role}`}
            text="Create an account and connect it to your academic structure."
          />
        )}
      </section>
      {modal && (
        <RecordForm
          title={modal === "new" ? `Add ${role}` : `Edit ${modal.name}`}
          fields={fields}
          initial={modal === "new" ? {} : modal}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            await api("/users" + (modal === "new" ? "" : `/${modal._id}`), {
              method: modal === "new" ? "POST" : "PATCH",
              body: modal === "new" ? { ...data, role } : data,
            });
            reload();
            notify(`${role === "student" ? "Student" : "Faculty"} saved`);
          }}
        />
      )}
      {resetUser && (
        <RecordForm
          title={`Reset ${resetUser.name}'s password`}
          fields={[
            {
              key: "password",
              label: "Temporary password",
              type: "password",
              minLength: 12,
            },
            { key: "reason", label: "Reason for reset", minLength: 5 },
          ]}
          onClose={() => setResetUser(null)}
          onSave={async (data) => {
            await api(`/users/${resetUser._id}/password`, {
              method: "POST",
              body: data,
            });
            notify(
              "Temporary password assigned. Share it securely with the user.",
            );
          }}
        />
      )}
      {importing && (
        <ImportStudents
          catalog={catalog}
          onClose={() => setImporting(false)}
          onDone={() => {
            reload();
            notify("Students imported successfully");
          }}
        />
      )}
    </>
  );
}
function ImportStudents({ catalog, onClose, onDone }) {
  const [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [classId, setClassId] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const rows = JSON.parse(text);
      if (!Array.isArray(rows)) throw new Error("Provide a JSON array");
      await api("/users/import", {
        method: "POST",
        body: { rows: rows.map((r) => ({ ...r, role: "student", classId })) },
      });
      onDone();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Import students"
      description="Up to 500 students per import. The entire import succeeds or no records are added."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {error && <div className="alert error">{error}</div>}
        <Field label="Destination class">
          <select
            required
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Choose class</option>
            {catalog.classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Student records (JSON)">
          <textarea
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            placeholder={
              '[\n  {"name":"Arun Kumar", "email":"arun@college.edu",\n   "code":"MCA001", "password":"UniqueTempPass123!"}\n]'
            }
          />
        </Field>
        <p className="hint">
          Use a different temporary password for every student. First-login
          password change is mandatory. Enroll the class in subjects after
          import.
        </p>
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button className="primary" disabled={busy}>
            {busy ? "Importing…" : "Import students"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function academicConfig(catalog) {
  const opts = (list, fn = (x) => x.name) =>
    list.map((x) => ({ value: x._id, label: fn(x) }));
  return {
    departments: {
      title: "Departments",
      fields: [
        { key: "name", label: "Department name" },
        { key: "code", label: "Department code" },
      ],
      columns: [
        ["name", "Department"],
        ["code", "Code"],
      ],
    },
    classes: {
      title: "Classes",
      fields: [
        { key: "name", label: "Class name" },
        {
          key: "departmentId",
          label: "Department",
          options: opts(catalog.departments),
        },
        {
          key: "academicYear",
          label: "Academic year",
          placeholder: "2026-2027",
        },
        { key: "semester", label: "Semester", type: "number", min: 1, max: 12 },
      ],
      columns: [
        ["name", "Class"],
        ["academicYear", "Academic year"],
        ["semester", "Semester"],
      ],
    },
    subjects: {
      title: "Subjects",
      fields: [
        { key: "name", label: "Subject name" },
        { key: "code", label: "Subject code" },
        {
          key: "departmentId",
          label: "Department",
          options: opts(catalog.departments),
        },
      ],
      columns: [
        ["name", "Subject"],
        ["code", "Code"],
      ],
    },
    assignments: {
      title: "Teaching assignments",
      fields: [
        {
          key: "facultyId",
          label: "Faculty",
          options: opts(
            catalog.users.filter((x) => x.role === "faculty" && x.isActive),
          ),
        },
        { key: "subjectId", label: "Subject", options: opts(catalog.subjects) },
        { key: "classId", label: "Class", options: opts(catalog.classes) },
      ],
      columns: [
        ["subjectId", "Subject", (r) => r.subjectId?.name],
        ["classId", "Class", (r) => r.classId?.name],
        ["facultyId", "Faculty", (r) => r.facultyId?.name],
        ["isActive", "Active", (r) => (r.isActive ? "Yes" : "No")],
      ],
    },
    enrollments: {
      title: "Student enrollments",
      fields: [
        {
          key: "studentId",
          label: "Student",
          options: opts(
            catalog.users.filter((x) => x.role === "student"),
            (x) => `${x.name} · ${x.code}`,
          ),
        },
        {
          key: "assignmentId",
          label: "Subject & class",
          options: opts(
            catalog.assignments,
            (x) => `${x.subjectId?.name} · ${x.classId?.name}`,
          ),
        },
      ],
      columns: [
        [
          "studentId",
          "Student",
          (r) => catalog.users.find((u) => u._id === r.studentId)?.name,
        ],
        [
          "assignmentId",
          "Subject",
          (r) =>
            catalog.assignments.find((a) => a._id === r.assignmentId)?.subjectId
              ?.name,
        ],
        ["isActive", "Status", (r) => (r.isActive ? "Enrolled" : "Inactive")],
      ],
    },
  };
}
function Academics({ catalog, reload, notify, setError }) {
  const [tab, setTab] = useState("departments"),
    [edit, setEdit] = useState(null),
    [q, setQ] = useState(""),
    [enroll, setEnroll] = useState(false);
  const configs = academicConfig(catalog),
    cfg = configs[tab];
  const rows = catalog[tab].filter((r) =>
    JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
  );
  let fields = cfg.fields;
  if (edit && edit !== "new" && tab === "assignments")
    fields = fields
      .filter((f) => f.key === "facultyId")
      .concat({
        key: "isActive",
        label: "Active assignment",
        type: "checkbox",
      });
  if (edit && edit !== "new" && tab === "enrollments")
    fields = [
      { key: "isActive", label: "Active enrollment", type: "checkbox" },
    ];
  return (
    <>
      <Heading
        title="Academic foundation"
        text="Connect your departments, classes, subjects and people."
      >
        <Button className="primary" icon={Plus} onClick={() => setEdit("new")}>
          Add record
        </Button>
      </Heading>
      <div className="tabs">
        {Object.entries(configs).map(([key, c]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              setQ("");
            }}
          >
            {c.title}
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{cfg.title}</h2>
            <p>{rows.length} records</p>
          </div>
          <div className="heading-actions">
            {tab === "enrollments" && (
              <Button onClick={() => setEnroll(true)} icon={Users}>
                Enroll entire class
              </Button>
            )}
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search records"
                placeholder="Search records…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {cfg.columns.map(([key, label]) => (
                    <th key={key}>{label.toUpperCase()}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 500).map((r) => (
                  <tr key={r._id}>
                    {cfg.columns.map(([key, label, fn]) => (
                      <td key={key}>{fn ? fn(r) : r[key]}</td>
                    ))}
                    <td>
                      <button
                        className="text-button"
                        onClick={() =>
                          setEdit(
                            Object.fromEntries(
                              Object.entries(r).map(([k, v]) => [
                                k,
                                v && typeof v === "object" ? id(v) : v,
                              ]),
                            ),
                          )
                        }
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={`No ${cfg.title.toLowerCase()} yet`}
            text="Use Add record to build your academic structure."
          />
        )}
      </section>
      <div className="info-strip">
        <ShieldCheck size={18} />
        Academic records are retained for history. Deactivate assignments and
        enrollments when they are no longer needed.
      </div>
      {edit && (
        <RecordForm
          title={`${edit === "new" ? "Add" : "Edit"} ${cfg.title.toLowerCase()}`}
          fields={fields}
          initial={edit === "new" ? {} : edit}
          onClose={() => setEdit(null)}
          onSave={async (data) => {
            await api(`/${tab}${edit === "new" ? "" : "/" + edit._id}`, {
              method: edit === "new" ? "POST" : "PATCH",
              body: data,
            });
            reload();
            notify("Academic record saved");
          }}
        />
      )}
      {enroll && (
        <RecordForm
          title="Enroll a class in a subject"
          fields={[
            {
              key: "assignmentId",
              label: "Teaching assignment",
              options: catalog.assignments
                .filter((a) => a.isActive)
                .map((a) => ({
                  value: a._id,
                  label: `${a.subjectId?.name} · ${a.classId?.name}`,
                })),
            },
          ]}
          onClose={() => setEnroll(false)}
          onSave={async (data) => {
            const r = await api("/enroll-class", {
              method: "POST",
              body: data,
            });
            reload();
            notify(`${r.count} students enrolled`);
          }}
        />
      )}
    </>
  );
}
function Timetable({ user, catalog, reload, notify, setError }) {
  const [day, setDay] = useState(new Date().getDay()),
    [edit, setEdit] = useState(null);
  const rows = catalog.timetable
    .filter((t) => t.day === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const fields = [
    {
      key: "assignmentId",
      label: "Subject & class",
      options: catalog.assignments
        .filter((a) => a.isActive)
        .map((a) => ({
          value: a._id,
          label: `${a.subjectId?.name} · ${a.classId?.name}`,
        })),
    },
    {
      key: "day",
      label: "Day (0 Sunday – 6 Saturday)",
      type: "number",
      min: 0,
      max: 6,
      default: day,
    },
    { key: "startTime", label: "Starts at", type: "time" },
    { key: "endTime", label: "Ends at", type: "time" },
    { key: "room", label: "Room" },
  ];
  return (
    <>
      <Heading
        title="Your week, in focus."
        text={`Weekly teaching schedule · ${catalog.settings.timezone}`}
      >
        {user.role === "admin" && (
          <Button
            className="primary"
            icon={Plus}
            onClick={() => setEdit("new")}
          >
            Add class period
          </Button>
        )}
      </Heading>
      <div className="weekday-tabs">
        {dayNames.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(i)}
            className={day === i ? "active" : ""}
          >
            {d.slice(0, 3)}
            <small>
              {catalog.timetable.filter((t) => t.day === i).length} classes
            </small>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{dayNames[day]}</h2>
            <p>{rows.length} scheduled classes</p>
          </div>
          <CalendarDays size={21} />
        </div>
        {rows.length ? (
          <div className="schedule-list">
            {rows.map((t) => {
              const a = catalog.assignments.find(
                (a) => a._id === t.assignmentId,
              );
              return (
                <div className="schedule-card" key={t._id}>
                  <div className="schedule-time">
                    <strong>{t.startTime}</strong>
                    <small>{t.endTime}</small>
                  </div>
                  <div className="schedule-line" />
                  <div className="schedule-detail">
                    <span className="eyebrow">{a?.classId?.name}</span>
                    <h3>{a?.subjectId?.name}</h3>
                    <p>
                      {a?.facultyId?.name} <span>·</span> {t.room}
                    </p>
                  </div>
                  {user.role === "admin" && (
                    <div className="row-actions">
                      <Button onClick={() => setEdit(t)}>Edit</Button>
                      <Button
                        className="danger-light"
                        onClick={async () => {
                          if (!confirm("Remove this timetable period?")) return;
                          try {
                            await api("/timetable/" + t._id, {
                              method: "DELETE",
                            });
                            reload();
                            notify("Period removed");
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty
            title="A little room in your schedule."
            text="No classes are scheduled for this day."
          />
        )}
      </section>
      {edit && (
        <RecordForm
          title={edit === "new" ? "Schedule a class" : "Edit class period"}
          fields={fields}
          initial={edit === "new" ? {} : edit}
          onClose={() => setEdit(null)}
          onSave={async (data) => {
            await api("/timetable" + (edit === "new" ? "" : "/" + edit._id), {
              method: edit === "new" ? "POST" : "PATCH",
              body: data,
            });
            reload();
            notify("Timetable updated");
          }}
        />
      )}
    </>
  );
}
function AttendancePage(ctx) {
  const { user, catalog, version, reload, notify, setError } = ctx;
  const [sessions, setSessions] = useState([]),
    [selected, setSelected] = useState(null),
    [creating, setCreating] = useState(false),
    [status, setStatus] = useState("all");
  useEffect(() => {
    api("/sessions")
      .then(setSessions)
      .catch((e) => setError(e.message));
  }, [version]);
  if (selected)
    return (
      <SessionDetail
        {...ctx}
        sessionId={selected}
        onBack={() => {
          setSelected(null);
          reload();
        }}
      />
    );
  return (
    <>
      <Heading
        title={
          user.role === "student"
            ? "Your attendance journey"
            : "Attendance workspace"
        }
        text={
          user.role === "student"
            ? "A transparent record of the classes you attend."
            : "Start a session. Share the QR. Watch your classroom connect."
        }
      >
        {user.role !== "student" && (
          <Button
            className="primary"
            icon={Plus}
            onClick={() => setCreating(true)}
          >
            Start session
          </Button>
        )}
      </Heading>
      <div className="tabs">
        {["all", "active", "closed", "cancelled"].map((s) => (
          <button
            key={s}
            className={status === s ? "active" : ""}
            onClick={() => setStatus(s)}
          >
            {s === "all" ? "All sessions" : s[0].toUpperCase() + s.slice(1)}{" "}
            <span>
              {sessions.filter((x) => s === "all" || x.status === s).length}
            </span>
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Class sessions</h2>
            <p>Most recent 200 sessions</p>
          </div>
          <Button icon={RefreshCw} onClick={reload}>
            Refresh
          </Button>
        </div>
        <SessionTable
          sessions={sessions.filter(
            (s) => status === "all" || s.status === status,
          )}
          onSelect={setSelected}
        />
      </section>
      {creating && (
        <RecordForm
          title="Start an attendance session"
          fields={[
            {
              key: "assignmentId",
              label: "Teaching assignment",
              options: catalog.assignments
                .filter((a) => a.isActive)
                .map((a) => ({
                  value: a._id,
                  label: `${a.subjectId?.name} · ${a.classId?.name}`,
                })),
            },
            {
              key: "durationMinutes",
              label: "Session duration (minutes)",
              type: "number",
              min: 5,
              max: 240,
              default: catalog.settings.sessionMinutes,
            },
          ]}
          onClose={() => setCreating(false)}
          onSave={async (data) => {
            const s = await api("/sessions", { method: "POST", body: data });
            reload();
            notify("Session started");
            setSelected(s._id);
          }}
        />
      )}
    </>
  );
}
function SessionDetail({ user, sessionId, onBack, notify, setError, catalog }) {
  const [data, setData] = useState(null),
    [qr, setQr] = useState(null),
    [image, setImage] = useState(""),
    [now, setNow] = useState(Date.now()),
    [connected, setConnected] = useState(false),
    [correction, setCorrection] = useState(null),
    [q, setQ] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/sessions/" + sessionId)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const polling = setInterval(load, 10000);
    let socket;
    if (user.role !== "student") {
      socket = io({ auth: { token: getToken() } });
      socket.on("connect", () => {
        socket.emit("watch-session", sessionId, (response) =>
          setConnected(!!response.ok),
        );
        load();
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("attendance-updated", load);
    }
    return () => {
      clearInterval(polling);
      socket?.disconnect();
    };
  }, [sessionId]);
  const status = data?.session.status;
  useEffect(() => {
    if (user.role === "student" || status !== "active") {
      setImage("");
      return;
    }
    let cancelled = false;
    async function fetchQR() {
      try {
        const value = await api(`/sessions/${sessionId}/qr`);
        const img = await QRCode.toDataURL(value.token, {
          width: 360,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#133e35", light: "#ffffff" },
        });
        if (!cancelled) {
          setQr({
            ...value,
            offset: new Date(value.serverTime).getTime() - Date.now(),
          });
          setImage(img);
        }
      } catch (e) {
        if (!cancelled) {
          setImage("");
          load();
        }
      }
    }
    fetchQR();
    const t = setInterval(fetchQR, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [sessionId, status]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  async function close(cancel = false) {
    const reason = cancel
      ? prompt("Reason for cancelling (at least 5 characters):")
      : null;
    if (cancel && !reason) return;
    if (
      !cancel &&
      !confirm(
        "End this session? Unmarked students will be recorded as absent.",
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/sessions/${sessionId}/${cancel ? "cancel" : "close"}`, {
        method: "POST",
        body: cancel ? { reason } : undefined,
      });
      await load();
      notify(
        cancel
          ? "Session cancelled and excluded from reports"
          : "Session finalized",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <p>Loading session…</p>;
  const s = data.session,
    marked = data.records.filter((r) =>
      ["present", "late"].includes(r.status),
    ).length;
  const pending = Math.max(0, s.roster.length - data.records.length);
  const seconds = qr
    ? Math.max(
        0,
        Math.ceil((new Date(qr.expiresAt) - (now + qr.offset)) / 1000),
      )
    : 0;
  const roster =
    user.role === "student"
      ? data.records.map((r) => r.studentId)
      : data.roster;
  return (
    <>
      <button className="text-button back" onClick={onBack}>
        <ChevronLeft size={16} />
        All sessions
      </button>
      <Heading
        title={s.title}
        text={`${date(s.startsAt)} · ${clock(s.startsAt)} – ${clock(s.endsAt)}`}
      >
        <Badge status={s.status} />
        {user.role !== "student" && status === "active" && (
          <>
            <Button
              className="danger-light"
              disabled={busy}
              onClick={() => close(true)}
            >
              Cancel class
            </Button>
            <Button
              className="primary"
              disabled={busy}
              onClick={() => close(false)}
            >
              End session
            </Button>
          </>
        )}
      </Heading>
      <div className="session-grid">
        {user.role !== "student" && (
          <section className="panel qr-panel">
            <div className="panel-title">
              <div>
                <h2>Classroom QR</h2>
                <p>Students scan using their signed-in account.</p>
              </div>
              <QrCode size={20} />
            </div>
            {status === "active" && image && seconds > 0 ? (
              <>
                <div className="qr-image">
                  <img src={image} alt="Live classroom attendance QR code" />
                </div>
                <div className="qr-timer">
                  <span className="dot" />
                  Refreshes in {seconds}s
                </div>
                <p className="hint">
                  This code is signed, short-lived, and valid only for this
                  session.
                </p>
              </>
            ) : (
              <Empty
                title={
                  status === "active"
                    ? "Refreshing your QR…"
                    : "Session complete"
                }
                text={
                  status === "active"
                    ? "Attendance is verified using server time."
                    : "This QR is no longer accepting attendance."
                }
              />
            )}
            <div className="qr-notice">
              <ShieldCheck size={19} />
              <p>
                Only enrolled students can mark attendance. A shared QR alone
                does not prove physical presence.
              </p>
            </div>
          </section>
        )}
        <section className="panel live-panel">
          <div className="panel-title">
            <div>
              <h2>
                {user.role === "student" ? "Your record" : "Live attendance"}
              </h2>
              <p>
                {user.role === "student"
                  ? "Your verified status for this session."
                  : `${s.roster.length} students on the session roster`}
              </p>
            </div>
            {user.role !== "student" && (
              <span className={`connection ${connected ? "online" : ""}`}>
                <Wifi size={13} />
                {connected ? "Live" : "10s sync"}
              </span>
            )}
          </div>
          {user.role !== "student" && (
            <div className="live-stats">
              <div>
                <strong>{marked}</strong>
                <span>Present / late</span>
              </div>
              <div>
                <strong>
                  {data.records.filter((r) => r.status === "absent").length}
                </strong>
                <span>Absent</span>
              </div>
              <div>
                <strong>{pending}</strong>
                <span>Unmarked</span>
              </div>
            </div>
          )}
          <div className="search-box session-search">
            <Search size={16} />
            <input
              placeholder="Find a student…"
              aria-label="Find a student"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="attendance-roster">
            {roster
              .filter((u) =>
                `${u.name} ${u.code}`.toLowerCase().includes(q.toLowerCase()),
              )
              .map((u) => {
                const record = data.records.find(
                  (r) => id(r.studentId) === u._id,
                );
                return (
                  <div className="roster-row" key={u._id}>
                    <span className="avatar">{initials(u.name)}</span>
                    <div>
                      <strong>{u.name}</strong>
                      <small>
                        {u.code}
                        {record?.markedAt ? " · " + clock(record.markedAt) : ""}
                      </small>
                    </div>
                    <Badge status={record?.status || "pending"} />
                    {user.role !== "student" && status !== "cancelled" && (
                      <button
                        className="text-button"
                        onClick={() => setCorrection(u)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                );
              })}
            {!roster.length && (
              <Empty
                title="No record yet"
                text="Scan the current classroom QR to mark attendance."
              />
            )}
          </div>
        </section>
      </div>
      {correction && (
        <RecordForm
          title={`Update ${correction.name}'s attendance`}
          fields={[
            {
              key: "status",
              label: "Attendance status",
              options: ["present", "late", "absent", "excused"].map((s) => ({
                value: s,
                label: s,
              })),
            },
            { key: "reason", label: "Reason for correction", minLength: 5 },
          ]}
          onClose={() => setCorrection(null)}
          onSave={async (values) => {
            await api(`/sessions/${sessionId}/attendance`, {
              method: "PATCH",
              body: { ...values, studentId: correction._id },
            });
            await load();
            notify("Attendance updated with audit record");
          }}
        />
      )}
    </>
  );
}
function Scanner({ notify, setError }) {
  const [scanning, setScanning] = useState(false),
    [result, setResult] = useState(null),
    [error, setLocalError] = useState(""),
    [manual, setManual] = useState(""),
    [busy, setBusy] = useState(false);
  const instance = useRef(null),
    lock = useRef(false);
  useEffect(
    () => () => {
      const s = instance.current;
      if (s?.isScanning) s.stop().catch(() => {});
    },
    [],
  );
  async function submit(token) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocalError("");
    try {
      const record = await api("/attendance/scan", {
        method: "POST",
        body: { token },
      });
      setResult(record);
      notify(
        record.alreadyMarked
          ? "Attendance already recorded"
          : "Attendance verified",
      );
      if (instance.current?.isScanning) await instance.current.stop();
      setScanning(false);
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setBusy(false);
      setTimeout(() => {
        lock.current = false;
      }, 1500);
    }
  }
  async function start() {
    setLocalError("");
    setResult(null);
    try {
      const qr = instance.current || new Html5Qrcode("qr-reader");
      instance.current = qr;
      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        submit,
        () => {},
      );
      setScanning(true);
    } catch (e) {
      setLocalError(
        "Camera could not start. Use HTTPS, allow camera access, and close other apps using your camera.",
      );
    }
  }
  return (
    <>
      <Heading
        title="One scan. You’re present."
        text="Open the camera and scan the QR displayed by your faculty."
      />
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <div className="panel-title">
            <div>
              <h2>Scan attendance QR</h2>
              <p>Keep the entire code inside the frame.</p>
            </div>
            <Camera size={23} />
          </div>
          <div id="qr-reader" className={scanning ? "" : "scanner-idle"} />
          {!scanning && !result && (
            <div className="scanner-placeholder">
              <div>
                <ScanLine size={65} strokeWidth={1} />
              </div>
              <h3>Ready when you are.</h3>
              <p>Camera access is used only while scanning.</p>
            </div>
          )}
          {result && (
            <div className="scan-success">
              <CheckCircle2 size={58} />
              <h2>
                {result.alreadyMarked
                  ? "Your attendance is already recorded."
                  : "You’re present!"}
              </h2>
              <Badge status={result.record.status} />
              <p>Your attendance is saved in the database.</p>
              <small>
                {result.record.markedAt
                  ? date(result.record.markedAt) +
                    " · " +
                    clock(result.record.markedAt)
                  : ""}
              </small>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div className="scanner-controls">
            <Button
              className="primary"
              disabled={busy}
              icon={scanning ? X : Camera}
              onClick={
                scanning
                  ? async () => {
                      await instance.current.stop();
                      setScanning(false);
                    }
                  : start
              }
            >
              {scanning
                ? "Stop camera"
                : result
                  ? "Scan another session"
                  : "Enable camera"}
            </Button>
          </div>
        </section>
        <div>
          <section className="panel scanner-guide">
            <span className="eyebrow">A SIMPLE CHECK-IN</span>
            <h2>Made for the classroom.</h2>
            {[
              [
                "01",
                "Find your class QR",
                "Your faculty displays a fresh, rotating code.",
              ],
              [
                "02",
                "Point your camera",
                "Sign in using your own student account.",
              ],
              [
                "03",
                "Look for confirmation",
                "A green confirmation means your record is saved.",
              ],
            ].map(([n, h, p]) => (
              <div className="guide-step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
            <div className="tip">
              <span>HAVING TROUBLE?</span>
              <p>
                Ask your faculty for an audited manual attendance entry if you
                cannot use the camera.
              </p>
            </div>
          </section>
          <details className="panel token-entry">
            <summary>Use a QR token instead</summary>
            <p className="hint">
              Paste the signed content decoded from the current classroom QR.
              The same verification rules apply.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(manual.trim());
              }}
            >
              <textarea
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                required
                rows={3}
                aria-label="Signed QR token"
              />
              <Button disabled={busy || !manual} className="primary">
                Verify token
              </Button>
            </form>
          </details>
        </div>
      </div>
    </>
  );
}
function Reports({ catalog, user, setError }) {
  const [data, setData] = useState(null),
    [filters, setFilters] = useState({}),
    [tab, setTab] = useState("summary"),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState("");
  useEffect(() => {
    setBusy(true);
    api("/reports?" + new URLSearchParams(filters))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  }, [filters]);
  const change = (key, value) =>
    setFilters((f) => {
      const copy = { ...f };
      if (value) copy[key] = value;
      else delete copy[key];
      return copy;
    });
  const summary = (data?.summary || []).filter((r) =>
    `${r.name} ${r.code} ${r.subject}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title={
          user.role === "student"
            ? "Your progress, clearly."
            : "Reports & insights"
        }
        text="Understand participation. Act on the numbers that matter."
      >
        <Button
          icon={Download}
          onClick={() =>
            download(filters, "pdf").catch((e) => setError(e.message))
          }
        >
          PDF
        </Button>
        <Button
          className="primary"
          icon={FileSpreadsheet}
          onClick={() =>
            download(filters, "xlsx").catch((e) => setError(e.message))
          }
        >
          Export Excel
        </Button>
      </Heading>
      <div className="panel filters">
        <Field label="From (UTC)">
          <input type="date" onChange={(e) => change("from", e.target.value)} />
        </Field>
        <Field label="To (UTC)">
          <input type="date" onChange={(e) => change("to", e.target.value)} />
        </Field>
        <Field label="Class">
          <select onChange={(e) => change("classId", e.target.value)}>
            <option value="">All classes</option>
            {catalog.classes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select onChange={(e) => change("subjectId", e.target.value)}>
            <option value="">All subjects</option>
            {catalog.subjects.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="tabs">
        <button
          className={tab === "summary" ? "active" : ""}
          onClick={() => setTab("summary")}
        >
          Subject summary
        </button>
        <button
          className={tab === "records" ? "active" : ""}
          onClick={() => setTab("records")}
        >
          Detailed records
        </button>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>
              {tab === "summary"
                ? "Attendance by student & subject"
                : "Verified attendance records"}
            </h2>
            <p>
              {busy
                ? "Updating…"
                : `${tab === "summary" ? summary.length : data?.rows.length || 0} records`}
            </p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="Search reports"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search records…"
            />
          </div>
        </div>
        {tab === "summary" ? (
          summary.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>SUBJECT</th>
                    <th>ATTENDED</th>
                    <th>EXCUSED</th>
                    <th>ATTENDANCE</th>
                    <th>STANDING</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.slice(0, 500).map((r) => (
                    <tr key={r.studentId + ":" + r.subjectId}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.code}</small>
                      </td>
                      <td>{r.subject}</td>
                      <td>
                        {r.attended} / {r.total}
                      </td>
                      <td>{r.excused}</td>
                      <td>
                        <div className="percentage">
                          <div className="progress-track">
                            <i style={{ width: (r.percentage || 0) + "%" }} />
                          </div>
                          <strong>
                            {r.percentage === null ? "—" : r.percentage + "%"}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <Badge
                          status={
                            r.percentage === null
                              ? "pending"
                              : r.percentage < catalog.settings.threshold
                                ? "at risk"
                                : "on track"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No completed attendance yet"
              text="Complete a session or adjust the report filters."
            />
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>STUDENT</th>
                  <th>SUBJECT</th>
                  <th>STATUS</th>
                  <th>METHOD</th>
                  <th>REASON</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || [])
                  .filter((r) =>
                    `${r.studentId.name} ${r.studentId.code} ${r.session.subjectId.name}`
                      .toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .slice(0, 500)
                  .map((r) => (
                    <tr key={r._id}>
                      <td>{date(r.session.startsAt)}</td>
                      <td>
                        <strong>{r.studentId.name}</strong>
                        <small>{r.studentId.code}</small>
                      </td>
                      <td>{r.session.subjectId.name}</td>
                      <td>
                        <Badge status={r.status} />
                      </td>
                      <td>{r.method}</td>
                      <td>{r.reason || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="info-strip">
        <AlertCircle size={18} />
        <span>
          Excused entries are excluded from the denominator. Late attendance
          follows the policy saved with each session. Tables show up to 500
          rows; export includes all matching records within the latest 2,000
          completed sessions.
        </span>
      </div>
    </>
  );
}
function SettingsPage({ catalog, reload, notify }) {
  const [data, setData] = useState(catalog.settings),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fields = [
    ["collegeName", "Institution name", "text"],
    ["timezone", "Institution timezone", "text"],
    ["threshold", "Shortage threshold (%)", "number"],
    ["qrSeconds", "QR rotation (seconds)", "number"],
    ["lateMinutes", "Late after (minutes)", "number"],
    ["sessionMinutes", "Default session (minutes)", "number"],
  ];
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(
        fields.map(([k, l, t]) => [
          k,
          t === "number" ? Number(data[k]) : data[k],
        ]),
      );
      body.lateCounts = data.lateCounts;
      await api("/settings", { method: "PATCH", body });
      reload();
      notify("Attendance policy updated");
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="A workspace that fits."
        text="Configure your institution and attendance policy."
      />
      <section className="panel settings-panel">
        <div className="panel-title">
          <div>
            <h2>Institution & attendance rules</h2>
            <p>Changes apply to sessions created from this point forward.</p>
          </div>
          <SlidersHorizontal size={22} />
        </div>
        <form onSubmit={save}>
          {error && <div className="alert error">{error}</div>}
          <div className="form-grid">
            {fields.map(([k, l, t]) => (
              <Field label={l} key={k}>
                <input
                  required
                  type={t}
                  value={data[k]}
                  onChange={(e) => setData({ ...data, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <label className="toggle-row">
            <div>
              <strong>Count late arrivals as attended</strong>
              <p>Late records remain separately visible in reports.</p>
            </div>
            <input
              type="checkbox"
              checked={data.lateCounts}
              onChange={(e) =>
                setData({ ...data, lateCounts: e.target.checked })
              }
            />
          </label>
          <div className="modal-actions">
            <Button className="primary" disabled={busy} icon={Check}>
              {busy ? "Saving…" : "Save policy"}
            </Button>
          </div>
        </form>
      </section>
      <section className="panel settings-note">
        <ShieldCheck size={24} />
        <div>
          <h3>A traceable system, by design.</h3>
          <p>
            Policy changes and manual attendance corrections are recorded in the
            audit trail. Database backups and email delivery are configured on
            your server.
          </p>
        </div>
      </section>
    </>
  );
}
function AuditPage({ setError, version }) {
  const [rows, setRows] = useState([]),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    api("/audit")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [version]);
  return (
    <>
      <Heading
        title="Every change has a story."
        text="A traceable history of administrative actions and attendance corrections."
      />
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Audit trail</h2>
            <p>Latest 500 events · Read-only</p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input
              placeholder="Search events…"
              aria-label="Search audit events"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>WHEN</th>
                <th>ACTOR</th>
                <th>ACTION</th>
                <th>REASON</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) =>
                  JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
                )
                .map((r) => (
                  <tr key={r._id}>
                    <td>
                      {date(r.createdAt)}
                      <small>{clock(r.createdAt)}</small>
                    </td>
                    <td>{r.actorId?.name || "System automation"}</td>
                    <td>
                      <span className="code-label">{r.action}</span>
                    </td>
                    <td>{r.reason || "—"}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(r)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty
            title="A clean slate"
            text="Actions will be recorded here as your workspace grows."
          />
        )}
      </section>
      {selected && (
        <Modal title="Audit event details" onClose={() => setSelected(null)}>
          <pre className="json-details">
            {JSON.stringify(selected, null, 2)}
          </pre>
        </Modal>
      )}
    </>
  );
}
function Notifications({ setError, notify }) {
  const [rows, setRows] = useState([]);
  const load = () =>
    api("/notifications")
      .then(setRows)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <Heading
        title="Stay in the know."
        text="Attendance alerts that help you take the next step."
      />
      <section className="panel">
        <div className="panel-title">
          <h2>Your notifications</h2>
          <Button icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        </div>
        {rows.length ? (
          rows.map((r) => (
            <div className={`notice-row ${r.readAt ? "read" : ""}`} key={r._id}>
              <span className="notice-icon">
                <Bell size={19} />
              </span>
              <div>
                <strong>{r.message}</strong>
                <small>
                  {date(r.createdAt)} · {clock(r.createdAt)}
                </small>
              </div>
              {!r.readAt && (
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("/notifications/" + r._id + "/read", {
                        method: "POST",
                      });
                      load();
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        ) : (
          <Empty
            title="You’re all caught up."
            text="Shortage notifications appear here when your attendance needs attention."
          />
        )}
      </section>
    </>
  );
}
function PasswordForm({ onDone }) {
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api("/auth/password", {
            method: "POST",
            body: { currentPassword, newPassword },
          });
          onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {error && <div className="alert error">{error}</div>}
      <Field label="Current password">
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="New password">
        <input
          type="password"
          required
          autoComplete="new-password"
          minLength={12}
          maxLength={72}
          value={newPassword}
          onChange={(e) => setNew(e.target.value)}
        />
      </Field>
      <p className="hint">
        12–72 characters, with uppercase, lowercase and a number. You will need
        to sign in again.
      </p>
      <Button className="primary" disabled={busy}>
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
function Profile({ user, logout, notify }) {
  return (
    <>
      <Heading
        title="Your account"
        text="Keep your campus identity secure and up to date."
      >
        <Button icon={LogOut} onClick={logout}>
          Sign out
        </Button>
      </Heading>
      <div className="profile-grid">
        <section className="panel profile-card">
          <span className="avatar big">{initials(user.name)}</span>
          <h2>{user.name}</h2>
          <Badge status={user.role} />
          <dl>
            <dt>Email address</dt>
            <dd>{user.email}</dd>
            <dt>Account ID</dt>
            <dd>{user.code}</dd>
            <dt>Account status</dt>
            <dd>Active</dd>
          </dl>
          <p className="hint">
            Contact your administrator to update profile details.
          </p>
        </section>
        <section className="panel password-panel">
          <div className="panel-title">
            <div>
              <h2>Change password</h2>
              <p>A strong password protects your attendance identity.</p>
            </div>
            <Lock size={21} />
          </div>
          <PasswordForm
            onDone={() => {
              notify("Password changed. Please sign in again.");
              setToken(null);
              window.dispatchEvent(new Event("auth-expired"));
            }}
          />
        </section>
      </div>
    </>
  );
}
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: false };
  }
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <div className="loading-screen">
          <h2>We couldn’t display this page.</h2>
          <p>Your attendance records are safe on the server.</p>
          <Button onClick={() => location.reload()}>Reload workspace</Button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
