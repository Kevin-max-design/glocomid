import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as api from './api';

// ===== AUTH CONTEXT =====
const AuthContext = createContext(null);

function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('glucomind_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            api.getMe()
                .then(res => setUser(res.data))
                .catch(() => { localStorage.removeItem('glucomind_token'); setToken(null); })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [token]);

    const loginUser = async (email, password) => {
        const res = await api.login({ email, password });
        localStorage.setItem('glucomind_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
    };

    const registerUser = async (data) => {
        const res = await api.register(data);
        localStorage.setItem('glucomind_token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
    };

    const logout = () => {
        localStorage.removeItem('glucomind_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loginUser, registerUser, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

const useAuth = () => useContext(AuthContext);

// ===== AUTH PAGE =====
function AuthPage() {
    const { loginUser, registerUser } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ email: '', password: '', name: '', age: 25, weight: 70, insulinToCarbRatio: 10, insulinSensitivityFactor: 50, basalDose: 20 });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await loginUser(form.email, form.password);
            } else {
                await registerUser(form);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed');
        }
        setLoading(false);
    };

    const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div className="auth-page">
            <div className="auth-card fade-in">
                <div className="auth-logo">
                    <h1>🧠 GlucoMind</h1>
                    <p>Intelligent Type 1 Diabetes Management</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label>Full Name</label>
                            <input className="form-input" type="text" placeholder="Your name" value={form.name} onChange={e => updateForm('name', e.target.value)} required />
                        </div>
                    )}
                    <div className="form-group">
                        <label>Email</label>
                        <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e => updateForm('email', e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => updateForm('password', e.target.value)} required minLength={6} />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Age</label>
                                    <input className="form-input" type="number" value={form.age} onChange={e => updateForm('age', +e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Weight (kg)</label>
                                    <input className="form-input" type="number" value={form.weight} onChange={e => updateForm('weight', +e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>ICR (1u per X g)</label>
                                    <input className="form-input" type="number" step="0.1" value={form.insulinToCarbRatio} onChange={e => updateForm('insulinToCarbRatio', +e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>ISF (1u drops X mg/dL)</label>
                                    <input className="form-input" type="number" step="0.1" value={form.insulinSensitivityFactor} onChange={e => updateForm('insulinSensitivityFactor', +e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Daily Basal Dose (units)</label>
                                <input className="form-input" type="number" step="0.5" value={form.basalDose} onChange={e => updateForm('basalDose', +e.target.value)} />
                            </div>
                        </>
                    )}

                    <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                        {loading ? <span className="loading-spinner" /> : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===== DASHBOARD ==== 
function Dashboard() {
    const { user } = useAuth();
    const [summary, setSummary] = useState(null);
    const [trend, setTrend] = useState([]);
    const [prediction, setPrediction] = useState(null);
    const [predLoading, setPredLoading] = useState(false);

    useEffect(() => {
        api.getSummary().then(r => setSummary(r.data)).catch(() => { });
        api.getGlucoseTrend(7).then(r => {
            const data = r.data.map(d => ({ ...d, timestamp: new Date(d.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), value: Math.round(d.value) }));
            setTrend(data);
        }).catch(() => { });
    }, []);

    const runPrediction = async () => {
        setPredLoading(true);
        try {
            const res = await api.getPrediction();
            setPrediction(res.data);
        } catch (err) {
            setPrediction({ error: 'Prediction service unavailable' });
        }
        setPredLoading(false);
    };

    const tirData = summary?.tir ? [
        { name: 'Below', value: summary.tir.below, color: '#ef476f' },
        { name: 'In Range', value: summary.tir.inRange, color: '#06d6a0' },
        { name: 'Above', value: summary.tir.above, color: '#f4a261' },
    ] : [];

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Welcome back, {user?.name || 'there'}. Here's your diabetes snapshot.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card stat-teal">
                    <div className="stat-icon">🩸</div>
                    <div className="stat-value">{summary?.glucoseStats?.average || '—'}</div>
                    <div className="stat-label">Avg Glucose (7d) mg/dL</div>
                </div>
                <div className="stat-card stat-amber">
                    <div className="stat-icon">💉</div>
                    <div className="stat-value">{summary?.insulinStats?.totalInsulin24h || '—'}</div>
                    <div className="stat-label">Total Insulin (24h) units</div>
                </div>
                <div className="stat-card stat-blue">
                    <div className="stat-icon">🍽️</div>
                    <div className="stat-value">{summary?.carbStats?.totalCarbs24h || '—'}</div>
                    <div className="stat-label">Total Carbs (24h) g</div>
                </div>
                <div className="stat-card stat-rose">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{summary?.tir?.inRange || '—'}%</div>
                    <div className="stat-label">Time in Range (7d)</div>
                </div>
            </div>

            {/* TIR Bar */}
            {summary?.tir && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-header">
                        <span className="card-title">Time in Range</span>
                        <span className="card-subtitle">Last 7 days</span>
                    </div>
                    <div className="tir-container">
                        <div className="tir-bar">
                            {summary.tir.below > 0 && <div className="tir-segment tir-below" style={{ width: `${summary.tir.below}%` }}>{summary.tir.below}%</div>}
                            {summary.tir.inRange > 0 && <div className="tir-segment tir-in-range" style={{ width: `${summary.tir.inRange}%` }}>{summary.tir.inRange}%</div>}
                            {summary.tir.above > 0 && <div className="tir-segment tir-above" style={{ width: `${summary.tir.above}%` }}>{summary.tir.above}%</div>}
                        </div>
                        <div className="tir-legend">
                            <div className="tir-legend-item"><div className="tir-legend-dot" style={{ background: '#ef476f' }} /> Below ({summary.tir.below}%)</div>
                            <div className="tir-legend-item"><div className="tir-legend-dot" style={{ background: '#06d6a0' }} /> In Range ({summary.tir.inRange}%)</div>
                            <div className="tir-legend-item"><div className="tir-legend-dot" style={{ background: '#f4a261' }} /> Above ({summary.tir.above}%)</div>
                        </div>
                    </div>
                </div>
            )}

            <div className="charts-grid">
                {/* Glucose Trend Chart */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Glucose Trend</span>
                        <span className="card-subtitle">Last 7 days</span>
                    </div>
                    <div className="chart-container">
                        {trend.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <AreaChart data={trend}>
                                    <defs>
                                        <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06d6a0" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#06d6a0" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                    <XAxis dataKey="timestamp" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                                    <YAxis domain={[40, 350]} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                                    <Tooltip contentStyle={{ background: '#1a2035', border: '1px solid rgba(148,163,184,0.2)', borderRadius: '8px', color: '#f1f5f9' }} />
                                    <Area type="monotone" dataKey="value" stroke="#06d6a0" fill="url(#glucoseGrad)" strokeWidth={2} dot={{ r: 3, fill: '#06d6a0' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state"><p>No glucose data yet. Start logging!</p></div>
                        )}
                    </div>
                </div>

                {/* Prediction Panel */}
                <div className="prediction-card">
                    <div className="card-header">
                        <span className="card-title">🧠 ML Prediction</span>
                        <span className="card-subtitle">Next Fasting Glucose</span>
                    </div>
                    {prediction && !prediction.error ? (
                        <div className="fade-in">
                            <div className={`prediction-value prediction-${prediction.risk_level}`}>
                                {Math.round(prediction.predicted_glucose)} <span style={{ fontSize: '1.2rem', fontWeight: 400 }}>mg/dL</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span className={`badge badge-${prediction.risk_level}`}>{prediction.risk_level} risk</span>
                                <span className={`badge ${prediction.confidence === 'high' ? 'badge-low' : prediction.confidence === 'medium' ? 'badge-moderate' : 'badge-high'}`}>{prediction.confidence} confidence</span>
                                {prediction.dawn_phenomenon_flag && <span className="badge badge-high">Dawn ⚠️</span>}
                            </div>
                            <div className="prediction-insight">{prediction.pattern_insight}</div>
                        </div>
                    ) : prediction?.error ? (
                        <div className="prediction-insight" style={{ borderLeftColor: '#ef476f' }}>{prediction.error}</div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Get AI-powered glucose prediction based on your last 24 hours of data</p>
                        </div>
                    )}
                    <button className="btn btn-primary btn-full" onClick={runPrediction} disabled={predLoading} style={{ marginTop: '1rem' }}>
                        {predLoading ? <span className="loading-spinner" /> : '🧠 Run Prediction'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ===== GLUCOSE LOGGER =====
function GlucosePage() {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState({ value: '', type: 'random', notes: '' });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getGlucoseLogs({ limit: 50 }).then(r => setLogs(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.value) return;
        setLoading(true);
        await api.addGlucose({ value: +form.value, type: form.type, notes: form.notes });
        setForm({ value: '', type: 'random', notes: '' });
        load();
        setLoading(false);
    };

    const del = async (id) => {
        await api.deleteGlucose(id);
        load();
    };

    const getReadingColor = (val) => {
        if (val < 70) return '#ef476f';
        if (val <= 180) return '#06d6a0';
        if (val <= 250) return '#f4a261';
        return '#ef476f';
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>🩸 Glucose Log</h2>
                <p>Track your blood glucose readings</p>
            </div>
            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>New Reading</div>
                    <form onSubmit={submit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Glucose (mg/dL)</label>
                                <input className="form-input" type="number" placeholder="120" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} required min="20" max="600" />
                            </div>
                            <div className="form-group">
                                <label>Reading Type</label>
                                <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                                    <option value="fasting">Fasting</option>
                                    <option value="premeal">Pre-Meal</option>
                                    <option value="postmeal">Post-Meal</option>
                                    <option value="bedtime">Bedtime</option>
                                    <option value="random">Random</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes (optional)</label>
                            <input className="form-input" type="text" placeholder="Any notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="loading-spinner" /> : 'Log Reading'}</button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Recent Readings</div>
                    <div className="log-list">
                        {logs.length === 0 ? (
                            <div className="empty-state"><p>No readings yet</p></div>
                        ) : logs.map(log => (
                            <div className="log-item" key={log._id}>
                                <div className="log-item-left">
                                    <div className="log-item-value" style={{ color: getReadingColor(log.value) }}>{log.value}</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.type}</div>
                                        <div className="log-item-meta">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button className="log-item-delete" onClick={() => del(log._id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== INSULIN TRACKER =====
function InsulinPage() {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState({ type: 'bolus', units: '', notes: '' });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getInsulinLogs({ limit: 50 }).then(r => setLogs(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.units) return;
        setLoading(true);
        await api.addInsulin({ type: form.type, units: +form.units, notes: form.notes });
        setForm({ type: 'bolus', units: '', notes: '' });
        load();
        setLoading(false);
    };

    const del = async (id) => { await api.deleteInsulin(id); load(); };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>💉 Insulin Tracker</h2>
                <p>Log basal and bolus insulin doses</p>
            </div>
            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>New Dose</div>
                    <form onSubmit={submit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Type</label>
                                <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                                    <option value="bolus">Bolus (Rapid)</option>
                                    <option value="basal">Basal (Long-acting)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Units</label>
                                <input className="form-input" type="number" step="0.5" placeholder="5" value={form.units} onChange={e => setForm(p => ({ ...p, units: e.target.value }))} required min="0.5" max="100" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes (optional)</label>
                            <input className="form-input" type="text" placeholder="Before lunch..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="loading-spinner" /> : 'Log Dose'}</button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Recent Doses</div>
                    <div className="log-list">
                        {logs.length === 0 ? (
                            <div className="empty-state"><p>No doses logged yet</p></div>
                        ) : logs.map(log => (
                            <div className="log-item" key={log._id}>
                                <div className="log-item-left">
                                    <div className="log-item-value" style={{ color: log.type === 'basal' ? '#4361ee' : '#00b4d8' }}>{log.units}u</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{log.type === 'basal' ? '🔵 Basal' : '🟢 Bolus'}</div>
                                        <div className="log-item-meta">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button className="log-item-delete" onClick={() => del(log._id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== MEAL LOGGER =====
function MealsPage() {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState({ carbs: '', mealType: 'lunch', description: '' });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getMealLogs({ limit: 50 }).then(r => setLogs(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.carbs) return;
        setLoading(true);
        await api.addMeal({ carbs: +form.carbs, mealType: form.mealType, description: form.description });
        setForm({ carbs: '', mealType: 'lunch', description: '' });
        load();
        setLoading(false);
    };

    const del = async (id) => { await api.deleteMeal(id); load(); };
    const mealEmoji = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>🍽️ Meal Logger</h2>
                <p>Track your carbohydrate intake</p>
            </div>
            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>New Meal</div>
                    <form onSubmit={submit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Carbs (grams)</label>
                                <input className="form-input" type="number" placeholder="60" value={form.carbs} onChange={e => setForm(p => ({ ...p, carbs: e.target.value }))} required min="1" max="500" />
                            </div>
                            <div className="form-group">
                                <label>Meal Type</label>
                                <select className="form-input" value={form.mealType} onChange={e => setForm(p => ({ ...p, mealType: e.target.value }))}>
                                    <option value="breakfast">🌅 Breakfast</option>
                                    <option value="lunch">☀️ Lunch</option>
                                    <option value="dinner">🌙 Dinner</option>
                                    <option value="snack">🍎 Snack</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Description (optional)</label>
                            <input className="form-input" type="text" placeholder="Rice and curry..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="loading-spinner" /> : 'Log Meal'}</button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Recent Meals</div>
                    <div className="log-list">
                        {logs.length === 0 ? (
                            <div className="empty-state"><p>No meals logged yet</p></div>
                        ) : logs.map(log => (
                            <div className="log-item" key={log._id}>
                                <div className="log-item-left">
                                    <div className="log-item-value" style={{ color: '#f4a261' }}>{log.carbs}g</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{mealEmoji[log.mealType] || '🍽️'} {log.mealType}{log.description ? ` — ${log.description}` : ''}</div>
                                        <div className="log-item-meta">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button className="log-item-delete" onClick={() => del(log._id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== INJECTION SITE TRACKER =====
function InjectionsPage() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getInjectionSummary().then(r => setSummary(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const logSite = async (site) => {
        setLoading(true);
        await api.addInjection({ site });
        load();
        setLoading(false);
    };

    const siteLabels = {
        abdomen_left: 'Left Abdomen',
        abdomen_right: 'Right Abdomen',
        thigh_left: 'Left Thigh',
        thigh_right: 'Right Thigh',
        arm_left: 'Left Arm',
        arm_right: 'Right Arm',
    };

    const getSiteClass = (site) => {
        if (!summary?.sites?.[site]) return '';
        const s = summary.sites[site];
        let cls = s.status;
        if (summary.recommended === site) cls += ' recommended';
        return cls;
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>📍 Injection Site Rotation</h2>
                <p>Track and rotate your injection sites to prevent lipohypertrophy</p>
            </div>

            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '0.5rem' }}>Body Map</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Tap a site to log an injection. {summary?.recommended && <span style={{ color: 'var(--accent-teal)' }}>✨ Recommended: {siteLabels[summary.recommended]}</span>}
                    </p>
                    <div className="body-map">
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Arms</div>
                        <div className="body-map-row">
                            <button className={`injection-site-btn ${getSiteClass('arm_left')}`} onClick={() => logSite('arm_left')} disabled={loading}>
                                💪 Left Arm
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.arm_left?.daysSinceLastUse != null ? `${summary.sites.arm_left.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                            <button className={`injection-site-btn ${getSiteClass('arm_right')}`} onClick={() => logSite('arm_right')} disabled={loading}>
                                💪 Right Arm
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.arm_right?.daysSinceLastUse != null ? `${summary.sites.arm_right.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.5rem' }}>Abdomen</div>
                        <div className="body-map-row">
                            <button className={`injection-site-btn ${getSiteClass('abdomen_left')}`} onClick={() => logSite('abdomen_left')} disabled={loading}>
                                ⬅️ Left
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.abdomen_left?.daysSinceLastUse != null ? `${summary.sites.abdomen_left.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                            <button className={`injection-site-btn ${getSiteClass('abdomen_right')}`} onClick={() => logSite('abdomen_right')} disabled={loading}>
                                ➡️ Right
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.abdomen_right?.daysSinceLastUse != null ? `${summary.sites.abdomen_right.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.5rem' }}>Thighs</div>
                        <div className="body-map-row">
                            <button className={`injection-site-btn ${getSiteClass('thigh_left')}`} onClick={() => logSite('thigh_left')} disabled={loading}>
                                🦵 Left Thigh
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.thigh_left?.daysSinceLastUse != null ? `${summary.sites.thigh_left.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                            <button className={`injection-site-btn ${getSiteClass('thigh_right')}`} onClick={() => logSite('thigh_right')} disabled={loading}>
                                🦵 Right Thigh
                                <span style={{ fontSize: '0.6rem' }}>{summary?.sites?.thigh_right?.daysSinceLastUse != null ? `${summary.sites.thigh_right.daysSinceLastUse}d ago` : 'Never'}</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Site Usage Summary</div>
                    {summary?.sites ? (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Site</th>
                                    <th>Last Used</th>
                                    <th>Count</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(summary.sites).map(([site, info]) => (
                                    <tr key={site}>
                                        <td>{siteLabels[site]}</td>
                                        <td style={{ fontSize: '0.85rem' }}>{info.daysSinceLastUse !== null ? `${info.daysSinceLastUse} days ago` : 'Never'}</td>
                                        <td>{info.usageCount}</td>
                                        <td><span className={`badge badge-${info.status === 'ready' ? 'low' : info.status === 'recent' ? 'moderate' : 'high'}`}>{info.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-state"><p>No injection data yet</p></div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ===== ACTIVITY LOGGER =====
function ActivityPage() {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState({ steps: '', duration: '', activityType: 'walking', notes: '' });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getActivityLogs({ limit: 50 }).then(r => setLogs(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const submit = async (e) => {
        e.preventDefault();
        if (!form.steps) return;
        setLoading(true);
        await api.addActivity({ ...form, steps: +form.steps, duration: +form.duration });
        setForm({ steps: '', duration: '', activityType: 'walking', notes: '' });
        load();
        setLoading(false);
    };

    const del = async (id) => { await api.deleteActivity(id); load(); };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>🚶 Activity Tracker</h2>
                <p>Log your daily movements and exercise</p>
            </div>
            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Log Activity</div>
                    <form onSubmit={submit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Steps</label>
                                <input className="form-input" type="number" placeholder="5000" value={form.steps} onChange={e => setForm(p => ({ ...p, steps: e.target.value }))} required min="0" />
                            </div>
                            <div className="form-group">
                                <label>Duration (mins)</label>
                                <input className="form-input" type="number" placeholder="30" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Activity Type</label>
                            <select className="form-input" value={form.activityType} onChange={e => setForm(p => ({ ...p, activityType: e.target.value }))}>
                                <option value="walking">🚶 Walking</option>
                                <option value="running">🏃 Running</option>
                                <option value="cycling">🚴 Cycling</option>
                                <option value="exercise">🏋️ Exercise</option>
                                <option value="other">⚡ Other</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <input className="form-input" type="text" placeholder="Morning walk..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="loading-spinner" /> : 'Log Activity'}</button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Recent Activity</div>
                    <div className="log-list">
                        {logs.length === 0 ? <div className="empty-state"><p>No activity logged</p></div> : logs.map(log => (
                            <div className="log-item" key={log._id}>
                                <div className="log-item-left">
                                    <div className="log-item-value" style={{ color: '#06d6a0' }}>{log.steps}</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {log.activityType} • {log.duration} mins
                                        </div>
                                        <div className="log-item-meta">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button className="log-item-delete" onClick={() => del(log._id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== WELLNESS LOGGER =====
function WellnessPage() {
    const [logs, setLogs] = useState([]);
    const [form, setForm] = useState({ mood: 3, stressLevel: 3, sleepHours: 7, notes: '' });
    const [loading, setLoading] = useState(false);

    const load = useCallback(() => {
        api.getWellnessLogs({ limit: 50 }).then(r => setLogs(r.data)).catch(() => { });
    }, []);
    useEffect(() => { load(); }, [load]);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        await api.addWellness(form);
        setForm({ mood: 3, stressLevel: 3, sleepHours: 7, notes: '' });
        load();
        setLoading(false);
    };

    const del = async (id) => { await api.deleteWellness(id); load(); };

    const moodEmojis = ['😫', 'bad', '😐', '🙂', '🤩'];
    const stressLabels = ['Zen', 'Calm', 'Normal', 'Stress', 'Panic'];

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>🧠 Wellness Tracker</h2>
                <p>Track mood, stress, and sleep patterns</p>
            </div>
            <div className="section-grid">
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Daily Check-in</div>
                    <form onSubmit={submit}>
                        <div className="form-group">
                            <label>Mood (1-5)</label>
                            <div className="range-slider-container">
                                <input type="range" min="1" max="5" value={form.mood} onChange={e => setForm(p => ({ ...p, mood: +e.target.value }))} style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem' }}>
                                    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ opacity: form.mood === i ? 1 : 0.3, cursor: 'pointer' }} onClick={() => setForm(p => ({ ...p, mood: i }))}>{moodEmojis[i - 1] || '😐'}</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Stress Level (1-5)</label>
                            <div className="range-slider-container">
                                <input type="range" min="1" max="5" value={form.stressLevel} onChange={e => setForm(p => ({ ...p, stressLevel: +e.target.value }))} style={{ width: '100%' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ color: form.stressLevel === i ? 'var(--accent-rose)' : 'inherit', fontWeight: form.stressLevel === i ? 'bold' : 'normal', cursor: 'pointer' }} onClick={() => setForm(p => ({ ...p, stressLevel: i }))}>{stressLabels[i - 1]}</span>)}
                                </div>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Sleep (Hours)</label>
                            <input className="form-input" type="number" step="0.5" value={form.sleepHours} onChange={e => setForm(p => ({ ...p, sleepHours: +e.target.value }))} />
                        </div>
                        <button className="btn btn-primary btn-full" disabled={loading}>{loading ? <span className="loading-spinner" /> : 'Log Check-in'}</button>
                    </form>
                </div>
                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>History</div>
                    <div className="log-list">
                        {logs.length === 0 ? <div className="empty-state"><p>No logs yet</p></div> : logs.map(log => (
                            <div className="log-item" key={log._id}>
                                <div className="log-item-left">
                                    <div className="log-item-value">{moodEmojis[log.mood - 1] || '😐'}</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            Stress: {log.stressLevel}/5 • Sleep: {log.sleepHours}h
                                        </div>
                                        <div className="log-item-meta">{new Date(log.timestamp).toLocaleString()}</div>
                                    </div>
                                </div>
                                <button className="log-item-delete" onClick={() => del(log._id)}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ===== ADVANCED ANALYTICS PAGE =====
function AnalyticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getAdvancedAnalytics().then(r => setData(r.data)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="loading-page"><span className="loading-spinner" /> Analyzing...</div>;
    if (!data) return <div className="empty-state">Failed to load analytics</div>;

    const { glucoScore, metrics, alerts, recommendations } = data;
    const { glycemic, insulin, lifestyle, injection, carb, wellness } = metrics;

    const MetricCard = ({ title, value, unit, status, subtitle }) => (
        <div className="stat-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="stat-label">{title}</div>
            <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>{value} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>{unit}</span></div>
            {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{subtitle}</div>}
            {status && <div className={`badge badge-${status === 'Good' || status === 'Stable' ? 'low' : status === 'Moderate' ? 'moderate' : 'high'}`} style={{ marginTop: '0.5rem' }}>{status}</div>}
        </div>
    );

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>📈 Clinical Analytics</h2>
                    <p>Deep dive into your diabetes data (Last 7 Days)</p>
                </div>
                <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ Doctor Report</button>
            </div>

            {/* GlucoScore & Alerts */}
            <div className="charts-grid" style={{ gridTemplateColumns: 'minmax(250px, 1fr) 2fr' }}>
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="card-title">GlucoScore</div>
                    <div style={{ position: 'relative', width: '150px', height: '150px', margin: '1.5rem 0' }}>
                        <svg width="150" height="150" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg-input)" strokeWidth="8" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke={glucoScore >= 80 ? '#06d6a0' : glucoScore >= 60 ? '#f4a261' : '#ef476f'} strokeWidth="8" strokeDasharray={`${glucoScore * 2.83} 283`} strokeDashoffset="0" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {glucoScore}
                        </div>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Weekly Health Score</p>
                </div>

                <div className="card">
                    <div className="card-title" style={{ marginBottom: '1rem' }}>Smart Alerts & Insights</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {alerts.length === 0 ? (
                            <div className="alert-item" style={{ background: 'var(--accent-teal-dim)', color: 'var(--accent-teal)', padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem' }}>
                                <span>✅</span> All metrics look good! No urgent alerts.
                            </div>
                        ) : alerts.map((alert, i) => (
                            <div key={i} className={`alert-item`} style={{
                                background: alert.type === 'danger' ? 'rgba(239, 71, 111, 0.15)' : alert.type === 'warning' ? 'rgba(244, 162, 97, 0.15)' : 'rgba(6, 214, 160, 0.15)',
                                color: alert.type === 'danger' ? '#ef476f' : alert.type === 'warning' ? '#f4a261' : '#06d6a0',
                                padding: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', gap: '0.5rem', fontSize: '0.9rem'
                            }}>
                                <span>{alert.type === 'danger' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                                {alert.message}
                            </div>
                        ))}
                        <div style={{ marginTop: '1rem' }}>
                            <div className="card-subtitle" style={{ marginBottom: '0.5rem' }}>AI Recommendations</div>
                            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                                {recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                                {recommendations.length === 0 && <li>Keep up the great work! Maintain current routine.</li>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Detailed Metrics Sections */}
            <h3 style={{ margin: '1.5rem 0 1rem', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Glycemic Control</h3>
            <div className="stats-grid">
                <MetricCard title="GMI (Est. A1c)" value={glycemic.gmi} unit="%" subtitle="Glucose Management Indicator" />
                <MetricCard title="Variability (CV)" value={glycemic.cv} unit="%" status={glycemic.status} subtitle={`Target: <36%`} />
                <MetricCard title="Time in Range" value={glycemic.tir.inRange} unit="%" status={glycemic.tir.inRange > 70 ? 'Good' : 'Moderate'} subtitle="70-180 mg/dL" />
                <MetricCard title="Hyper Load" value={glycemic.hyperLoad} unit="mg/dL" subtitle="Area over 180 (7d)" />
            </div>

            <h3 style={{ margin: '1.5rem 0 1rem', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Insulin Intelligence</h3>
            <div className="stats-grid">
                <MetricCard title="Efficiency Score" value={insulin.efficiencyScore} unit="/100" subtitle="Glucose drop per unit" />
                <MetricCard title="Basal/Bolus" value={insulin.basalBolusRatio} unit="ratio" subtitle={`daily avg: ${insulin.totalDailyAvg}u`} />
                <MetricCard title="Injection Rotation" value={injection.rotationScore} unit="%" status={injection.rotationScore > 80 ? 'Good' : injection.rotationScore > 50 ? 'Moderate' : 'Poor'} subtitle={`${injection.siteCount} sites used`} />
                <MetricCard title="Sites Used" value={injection.siteCount} unit="/ 6" subtitle="Unique sites (7d)" />
            </div>

            <h3 style={{ margin: '1.5rem 0 1rem', fontSize: '1.1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Lifestyle & Wellness</h3>
            <div className="stats-grid">
                <MetricCard title="Activity Impact" value={lifestyle.activityImpactScore} unit="" subtitle={`Avg steps: ${lifestyle.avgSteps}`} />
                <MetricCard title="Spike Index" value={carb.spikeIndex} unit="" subtitle={`Avg carbs: ${carb.avgDailyCarbs}g`} />
                <MetricCard title="Sleep Quality" value={wellness.avgSleep} unit="hrs" subtitle={`Mood avg: ${wellness.avgMood}/5`} />
                <MetricCard title="Stress Load" value={wellness.avgStress} unit="/ 5" subtitle="7-day average" />
            </div>
        </div>
    );
}

// ===== SETTINGS PAGE =====
function SettingsPage() {
    const { user, setUser, logout } = useAuth();
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (user) {
            setForm({
                name: user.name || '',
                age: user.age || 25,
                weight: user.weight || 70,
                insulinToCarbRatio: user.insulinToCarbRatio || 10,
                insulinSensitivityFactor: user.insulinSensitivityFactor || 50,
                basalDose: user.basalDose || 0,
                targetGlucoseLow: user.targetGlucoseLow || 70,
                targetGlucoseHigh: user.targetGlucoseHigh || 180,
            });
        }
    }, [user]);

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.updateProfile(form);
            setUser(res.data);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) { }
        setSaving(false);
    };

    const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>⚙️ Settings</h2>
                <p>Manage your profile and diabetes parameters</p>
            </div>
            <div className="card" style={{ maxWidth: 600 }}>
                <form onSubmit={save}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input className="form-input" value={form.name || ''} onChange={e => updateForm('name', e.target.value)} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Age</label>
                            <input className="form-input" type="number" value={form.age || ''} onChange={e => updateForm('age', +e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Weight (kg)</label>
                            <input className="form-input" type="number" value={form.weight || ''} onChange={e => updateForm('weight', +e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>ICR (1u per X g carbs)</label>
                            <input className="form-input" type="number" step="0.1" value={form.insulinToCarbRatio || ''} onChange={e => updateForm('insulinToCarbRatio', +e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>ISF (1u drops X mg/dL)</label>
                            <input className="form-input" type="number" step="0.1" value={form.insulinSensitivityFactor || ''} onChange={e => updateForm('insulinSensitivityFactor', +e.target.value)} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Daily Basal Dose (units)</label>
                        <input className="form-input" type="number" step="0.5" value={form.basalDose || ''} onChange={e => updateForm('basalDose', +e.target.value)} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Target Low (mg/dL)</label>
                            <input className="form-input" type="number" value={form.targetGlucoseLow || ''} onChange={e => updateForm('targetGlucoseLow', +e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Target High (mg/dL)</label>
                            <input className="form-input" type="number" value={form.targetGlucoseHigh || ''} onChange={e => updateForm('targetGlucoseHigh', +e.target.value)} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? <span className="loading-spinner" /> : saved ? '✅ Saved!' : 'Save Changes'}
                        </button>
                        <button className="btn btn-danger" type="button" onClick={logout}>Sign Out</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ===== MAIN APP =====
function AppContent() {
    const { user, loading, logout } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return <div className="loading-page"><span className="loading-spinner" /> Loading...</div>;
    }

    if (!user) return <AuthPage />;

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { id: 'analytics', label: 'Analytics', icon: '📈' },
        { id: 'glucose', label: 'Glucose', icon: '🩸' },
        { id: 'insulin', label: 'Insulin', icon: '💉' },
        { id: 'meals', label: 'Meals', icon: '🍽️' },
        { id: 'activity', label: 'Activity', icon: '🚶' },
        { id: 'wellness', label: 'Wellness', icon: '🧠' },
        { id: 'injections', label: 'Injections', icon: '📍' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    const pages = {
        dashboard: Dashboard,
        analytics: AnalyticsPage,
        glucose: GlucosePage,
        insulin: InsulinPage,
        meals: MealsPage,
        activity: ActivityPage,
        wellness: WellnessPage,
        injections: InjectionsPage,
        settings: SettingsPage
    };
    const CurrentPageComponent = pages[currentPage] || Dashboard;

    return (
        <div className="app-layout">
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-icon">🧠</div>
                    <h1>GlucoMind</h1>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <button key={item.id} className={`nav-item ${currentPage === item.id ? 'active' : ''}`} onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}>
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{user.email}</div>
                    <button className="nav-item" onClick={logout}>
                        <span>🚪</span>
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <CurrentPageComponent />
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}
