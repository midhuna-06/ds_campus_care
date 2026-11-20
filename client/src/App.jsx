import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  Eye,
  FilePlus2,
  Filter,
  GraduationCap,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

const categories = ["Hostel", "Food", "Transport", "Infrastructure", "Other"];
const statuses = ["Pending", "In Progress", "Resolved"];
const filters = ["All", ...statuses];

async function request(path, options) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "include",
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new Error("CampusCare server is unavailable. Check server/.env and MongoDB, restart npm run dev, and try again.");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const requestError = new Error(error.message || "Unable to complete your request.");
    requestError.status = response.status;
    requestError.errors = error.errors ?? {};
    throw requestError;
  }
  return response.status === 204 ? null : response.json();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }) {
  const icon = status === "Resolved" ? <Check size={13} /> : <span className="status-dot" />;
  return <span className={`status-badge ${status.toLowerCase().replace(" ", "-")}`}>{icon}{status}</span>;
}

function ComplaintForm({ complaint, onClose, onSave }) {
  const [values, setValues] = useState({
    title: complaint?.title ?? "",
    category: complaint?.category ?? "",
    description: complaint?.description ?? "",
    status: complaint?.status ?? "Pending",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.title.trim()) nextErrors.title = "A title is required.";
    if (!values.category) nextErrors.category = "Choose a category.";
    if (!values.description.trim()) nextErrors.description = "Add a few details.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...values, title: values.title.trim(), description: values.description.trim() });
    } catch (error) {
      setErrors({ form: error.message });
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog form-dialog" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="dialog-heading">
          <div className="dialog-icon"><FilePlus2 size={20} /></div>
          <button className="icon-button close-button" aria-label="Close form" onClick={onClose}><X size={19} /></button>
          <p className="eyebrow">{complaint ? "UPDATE REQUEST" : "CAMPUS SUPPORT"}</p>
          <h2 id="form-title">{complaint ? "Edit complaint" : "Raise a complaint"}</h2>
          <p className="dialog-subtitle">{complaint ? "Make changes to your request below." : "Tell us what needs attention on campus."}</p>
        </div>
        <form className="complaint-form" onSubmit={submit} noValidate>
          <label>
            <span>Title <em>*</em></span>
            <input autoFocus maxLength={100} placeholder="e.g. Water cooler not working" value={values.title} onChange={(event) => update("title", event.target.value)} />
            {errors.title && <small className="field-error">{errors.title}</small>}
          </label>
          <label>
            <span>Category <em>*</em></span>
            <span className="select-wrap">
              <select value={values.category} onChange={(event) => update("category", event.target.value)}>
                <option value="" disabled>Select a category</option>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <ChevronDown size={16} />
            </span>
            {errors.category && <small className="field-error">{errors.category}</small>}
          </label>
          {complaint && (
            <label>
              <span>Status</span>
              <span className="select-wrap">
                <select value={values.status} onChange={(event) => update("status", event.target.value)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
                <ChevronDown size={16} />
              </span>
            </label>
          )}
          <label>
            <span>Description <em>*</em></span>
            <textarea maxLength={2000} rows={5} placeholder="Share the details that will help us understand the issue..." value={values.description} onChange={(event) => update("description", event.target.value)} />
            <div className="field-foot">
              {errors.description ? <small className="field-error">{errors.description}</small> : <small>Be as specific as you can.</small>}
              <small>{values.description.length}/2,000</small>
            </div>
          </label>
          {errors.form && <p className="form-error">{errors.form}</p>}
          <div className="form-actions">
            <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
            <button className="button button-primary" disabled={saving}>{saving ? "Saving..." : complaint ? "Save changes" : "Submit complaint"}<ArrowUpRight size={16} /></button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ComplaintDetails({ complaint, onClose, onEdit }) {
  const currentStep = statuses.indexOf(complaint.status);

  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog details-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <button className="icon-button close-button" aria-label="Close details" onClick={onClose}><X size={19} /></button>
        <p className="eyebrow">REQUEST OVERVIEW</p>
        <div className="detail-title-row"><h2 id="detail-title">{complaint.title}</h2><StatusBadge status={complaint.status} /></div>
        <div className="detail-meta"><span className="category-tag">{complaint.category}</span><span>Submitted {formatDate(complaint.createdAt)}</span></div>
        <div className="tracking-panel">
          <div className="tracking-heading"><span>Request progress</span><span>{currentStep + 1} of {statuses.length}</span></div>
          <ol className="status-tracker" aria-label={`Complaint status: ${complaint.status}`}>
            {statuses.map((status, index) => (
              <li key={status} className={index < currentStep ? "complete" : index === currentStep ? "current" : ""}>
                <span className="tracker-marker">{index < currentStep ? <Check size={12} /> : index + 1}</span>
                <span>{status}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="description-label">DESCRIPTION</p>
        <div className="detail-description">{complaint.description}</div>
        <div className="detail-footer"><span><Clock3 size={15} /> Last updated {formatDate(complaint.updatedAt)}</span><button className="button button-primary" onClick={() => onEdit(complaint)}><Pencil size={15} /> Edit complaint</button></div>
      </section>
    </div>
  );
}

function AuthPage({ onAuthenticated, startupError }) {
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const registering = mode === "register";

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (registering && values.name.trim().length < 2) nextErrors.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (values.password.length < 8) nextErrors.password = "Use at least 8 characters.";
    else if (new TextEncoder().encode(values.password).length > 72) {
      nextErrors.password = "Use a password no longer than 72 UTF-8 bytes.";
    }
    if (registering && values.password !== values.confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await request(`/api/auth/${registering ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });
      onAuthenticated(user);
    } catch (error) {
      setErrors({ ...error.errors, form: error.message });
      setSubmitting(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setValues({ name: "", email: "", password: "", confirmPassword: "" });
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand auth-brand" href="#" aria-label="CampusCare home">
          <span className="brand-mark"><span /></span><span>campus<span className="brand-light">care</span></span>
        </a>
        <div className="auth-story-content">
          <span className="auth-overline"><span /> STUDENT SUPPORT, MADE SIMPLE</span>
          <h1>A better campus<br />starts with being heard.</h1>
          <p>One place to share what needs attention, follow every update, and help make campus life better.</p>
          <div className="auth-benefits">
            <div><span className="benefit-icon"><ShieldCheck size={17} /></span><span><strong>Your concerns, in one place</strong><small>Keep a clear record of every request.</small></span></div>
            <div><span className="benefit-icon"><ClipboardList size={17} /></span><span><strong>Know where things stand</strong><small>Track progress from submission to resolution.</small></span></div>
          </div>
        </div>
        <div className="auth-story-footer"><span>CampusCare</span><span>Student campus services <i>·</i> 2026</span></div>
        <div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" />
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-heading">
            <div className="auth-card-icon">{registering ? <UserRound size={20} /> : <GraduationCap size={21} />}</div>
            <p className="eyebrow">{registering ? "JOIN YOUR CAMPUS COMMUNITY" : "WELCOME TO CAMPUSCARE"}</p>
            <h2>{registering ? "Create your account" : "Welcome back"}</h2>
            <p>{registering ? "Set up your student account to get started." : "Sign in to manage your campus complaints."}</p>
          </div>
          {startupError && <p className="auth-alert" role="alert">{startupError}</p>}
          <form className="auth-form" onSubmit={submit} noValidate>
            {registering && <label><span>Full name</span><span className="auth-input-wrap"><UserRound size={16} /><input autoComplete="name" maxLength={60} placeholder="Your name" value={values.name} onChange={(event) => update("name", event.target.value)} /></span>{errors.name && <small className="field-error">{errors.name}</small>}</label>}
            <label><span>Email address</span><span className="auth-input-wrap"><Mail size={16} /><input autoComplete="email" type="email" placeholder="you@university.edu" value={values.email} onChange={(event) => update("email", event.target.value)} /></span>{errors.email && <small className="field-error">{errors.email}</small>}</label>
            <label><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={16} /><input autoComplete={registering ? "new-password" : "current-password"} type="password" placeholder={registering ? "At least 8 characters" : "Enter your password"} value={values.password} onChange={(event) => update("password", event.target.value)} /></span>{errors.password && <small className="field-error">{errors.password}</small>}</label>
            {registering && <label><span>Confirm password</span><span className="auth-input-wrap"><LockKeyhole size={16} /><input autoComplete="new-password" type="password" placeholder="Enter your password again" value={values.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} /></span>{errors.confirmPassword && <small className="field-error">{errors.confirmPassword}</small>}</label>}
            {errors.form && <p className="auth-form-error" role="alert">{errors.form}</p>}
            <button className="button button-primary auth-submit" disabled={submitting}>{submitting ? "Please wait..." : registering ? "Create account" : "Sign in"}<ArrowUpRight size={16} /></button>
          </form>
          <div className="auth-switch">{registering ? "Already have an account?" : "New to CampusCare?"}<button onClick={() => switchMode(registering ? "login" : "register")}>{registering ? "Sign in" : "Create an account"}</button></div>
          <div className="auth-assurance"><ShieldCheck size={14} /><span>Your account and complaint details are kept secure.</span></div>
        </div>
        <p className="auth-mobile-footer">CampusCare <i>·</i> Student campus services</p>
      </section>
    </main>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [formComplaint, setFormComplaint] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [toast, setToast] = useState("");

  async function loadComplaints() {
    setLoadError("");
    try {
      setComplaints(await request("/api/complaints"));
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setComplaints([]);
      } else {
        setLoadError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    request("/api/auth/me")
      .then(({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        return loadComplaints();
      })
      .catch((error) => {
        if (!active) return;
        if (error.status !== 401) setAuthError(error.message);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleComplaints = useMemo(() => complaints.filter((complaint) => {
    const matchesStatus = activeFilter === "All" || complaint.status === activeFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${complaint.title} ${complaint.description} ${complaint.category}`.toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  }), [complaints, activeFilter, search]);
  const statusCounts = useMemo(() => complaints.reduce((counts, complaint) => {
    counts[complaint.status] += 1;
    return counts;
  }, { Pending: 0, "In Progress": 0, Resolved: 0 }), [complaints]);

  async function saveComplaint(values) {
    const editing = Boolean(formComplaint);
    const saved = await request(
      editing ? `/api/complaints/${formComplaint.id}` : "/api/complaints",
      { method: editing ? "PUT" : "POST", body: JSON.stringify(values) },
    );
    setComplaints((current) => editing
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]);
    setFormOpen(false);
    setFormComplaint(null);
    setViewing(null);
    setToast(editing ? "Complaint updated successfully." : "Complaint submitted successfully.");
  }

  async function deleteComplaint(complaint) {
    if (!window.confirm(`Delete “${complaint.title}”? This cannot be undone.`)) return;
    try {
      await request(`/api/complaints/${complaint.id}`, { method: "DELETE" });
      setComplaints((current) => current.filter((item) => item.id !== complaint.id));
      setViewing(null);
      setToast("Complaint deleted.");
    } catch (error) {
      setToast(error.message);
    }
  }

  function openForm(complaint = null) {
    setViewing(null);
    setFormComplaint(complaint);
    setFormOpen(true);
  }

  async function signOut() {
    try {
      await request("/api/auth/logout", { method: "POST" });
      setUser(null);
      setComplaints([]);
      setSearch("");
      setActiveFilter("All");
      setToast("");
    } catch (error) {
      setToast(error.message);
    }
  }

  if (authLoading) {
    return <main className="auth-loading"><span className="spinner" />Loading your secure workspace...</main>;
  }

  if (!user) {
    return <AuthPage startupError={authError} onAuthenticated={(authenticatedUser) => {
      setUser(authenticatedUser);
      setAuthError("");
      setLoading(true);
      loadComplaints();
    }} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="CampusCare home">
          <span className="brand-mark"><span /></span><span>campus<span className="brand-light">care</span></span>
        </a>
        <div className="campus-card">
          <div className="campus-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div><strong>{user.name}</strong><span>Student account</span></div>
          <GraduationCap size={16} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav><a className="nav-link active" href="#complaints"><ClipboardList size={18} /><span>My complaints</span><span className="nav-count">{complaints.length}</span></a></nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><MessageSquareText size={17} /></div><strong>Need a hand?</strong><p>Our campus team is here to help with your concerns.</p></div>
          <div className="sidebar-note"><span className="online-dot" /> Campus support is available</div>
        </div>
      </aside>

      <main className="main-content" id="complaints">
        <header className="topbar"><div className="breadcrumb">Student portal <span>/</span> <strong>My complaints</strong></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span><div className="account-summary"><div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div><span>{user.name}</span></div><button className="sign-out-button" onClick={signOut}><LogOut size={15} /><span>Sign out</span></button></div></header>
        <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">YOUR CAMPUS, YOUR VOICE</p><h1>My complaints<span className="heading-period">.</span></h1><p className="welcome-copy">Keep track of the things that make campus life better.</p></div>
            <button className="button button-primary new-button" onClick={() => openForm()}><Plus size={18} /> New complaint</button>
          </section>
          <section className="intro-banner">
            <div className="banner-copy"><span className="banner-kicker"><span /> HERE FOR YOUR CAMPUS</span><h2>Make campus<br />better, together.</h2><p>Raise a concern and keep track of every update, all in one place.</p></div>
            <div className="banner-illustration" aria-hidden="true">
              <div className="illustration-orbit orbit-one" /><div className="illustration-orbit orbit-two" />
              <div className="illustration-building"><div className="building-roof" /><div className="building-windows"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className="building-door" /></div>
              <div className="illustration-plant plant-left"><i /><i /><i /><b /></div><div className="illustration-plant plant-right"><i /><i /><i /><b /></div>
            </div>
            <div className="banner-note"><span className="banner-note-icon"><ShieldCheck size={15} /></span><span><strong>Every voice matters</strong><small>We’re listening to your feedback</small></span></div>
          </section>
          <section className="complaint-section">
            <div className="section-heading"><div><h2>All complaints <span className="total-count">{complaints.length}</span></h2><p>Review and manage the concerns you’ve submitted.</p></div><div className="list-tools">
              <label className="search-box"><Search size={16} /><input aria-label="Search complaints" placeholder="Search complaints" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={14} /></button>}</label>
              <span className="filter-label"><Filter size={14} /> Filter</span>
            </div></div>
            <div className="filter-tabs" role="tablist" aria-label="Filter complaints by status">{filters.map((filter) => {
              const count = filter === "All" ? complaints.length : statusCounts[filter];
              return <button key={filter} role="tab" aria-selected={activeFilter === filter} className={activeFilter === filter ? "selected" : ""} onClick={() => setActiveFilter(filter)}>{filter}<span>{count}</span></button>;
            })}</div>
            {loadError && <div className="error-banner" role="alert">{loadError}<button onClick={loadComplaints}>Try again</button></div>}
            {loading ? <div className="loading-state"><span className="spinner" />Loading complaints...</div> : visibleComplaints.length > 0 ? (
              <div className="complaint-list">
                {visibleComplaints.map((complaint) => <article className="complaint-card" key={complaint.id}>
                  <div className={`complaint-category-icon ${complaint.category.toLowerCase()}`} aria-hidden="true"><ClipboardList size={18} /></div>
                  <div className="complaint-main"><div className="complaint-title-line"><h3>{complaint.title}</h3><StatusBadge status={complaint.status} /></div><p>{complaint.description}</p><div className="complaint-meta"><span className="category-tag">{complaint.category}</span><span className="meta-divider" /><span>Submitted {formatDate(complaint.createdAt)}</span></div></div>
                  <div className="card-actions"><button title="View complaint" aria-label={`View ${complaint.title}`} onClick={() => setViewing(complaint)}><Eye size={16} /><span>View details</span></button><button title="Edit complaint" aria-label={`Edit ${complaint.title}`} onClick={() => openForm(complaint)}><Pencil size={15} /></button><button className="delete-action" title="Delete complaint" aria-label={`Delete ${complaint.title}`} onClick={() => deleteComplaint(complaint)}><Trash2 size={15} /></button></div>
                </article>)}
              </div>
            ) : <div className="empty-state"><div className="empty-icon"><ClipboardList size={22} /></div><h3>{search || activeFilter !== "All" ? "No matching complaints" : "Nothing on your list yet"}</h3><p>{search || activeFilter !== "All" ? "Try changing your search or status filter." : "When something needs attention, let us know and track it here."}</p>{!search && activeFilter === "All" && <button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Submit your first complaint</button>}</div>}
            <footer className="list-footer"><span><span className="footer-dot" /> Your complaints are visible only to you and campus support.</span><span>{visibleComplaints.length} {visibleComplaints.length === 1 ? "item" : "items"}</span></footer>
          </section>
          <footer className="page-footer"><span>Made for a better campus, together.</span><span>CampusCare <i>·</i> Student portal</span></footer>
        </div>
      </main>
      {formOpen && <ComplaintForm key={formComplaint?.id ?? "new"} complaint={formComplaint} onClose={() => { setFormOpen(false); setFormComplaint(null); }} onSave={saveComplaint} />}
      {viewing && <ComplaintDetails complaint={viewing} onClose={() => setViewing(null)} onEdit={openForm} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default App;
