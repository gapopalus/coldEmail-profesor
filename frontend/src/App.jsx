import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const API = 'http://localhost:3001/api'

const FOCUSES = [
  'Machine Learning / AI', 'Data Science', 'Computer Systems',
  'Robotics', 'Computer Vision', 'NLP', 'Cybersecurity', 'HCI', 'Bioinformatics', 'Software Engineering'
]
const GOALS = [
  'summer research opportunity', 'internship or project collaboration', 'informal networking conversation'
]

function initials(name) {
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function App() {
  const [tab, setTab] = useState('search')
  const [profile, setProfile] = useState({ name: '', school: '', major: '', background: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [university, setUniversity] = useState('')
  const [focuses, setFocuses] = useState(['Machine Learning / AI', 'Data Science', 'Computer Systems'])
  const [goals, setGoals] = useState(['summer research opportunity', 'internship or project collaboration', 'informal networking conversation'])
  const [professors, setProfessors] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    axios.get(`${API}/profile`).then(r => { if (r.data.name) setProfile(r.data) }).catch(() => {})
    axios.get(`${API}/history`).then(r => setHistory(r.data)).catch(() => {})
  }, [])

  function toggleFocus(f) {
    setFocuses(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  function toggleGoal(g) {
    setGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  async function saveProfile() {
    await axios.post(`${API}/profile`, profile)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  async function search() {
    if (!university.trim()) return setError('Enter a university name')
    setError(''); setLoading(true); setProfessors([])
    try {
      const res = await axios.post(`${API}/search`, { university, focuses, goals, profile })
      setProfessors(res.data.professors || [])
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong, try again')
    }
    setLoading(false)
  }

  async function logSent(prof) {
    await axios.post(`${API}/history`, { professor: prof.name, email: prof.email, university, emailDraft: prof.emailDraft })
    setHistory(prev => [...prev, { professor: prof.name, email: prof.email, university, date: new Date().toISOString() }])
  }

  function openEmail(prof) {
    const subject = encodeURIComponent(`Research Inquiry — ${profile.name || 'Student'}`)
    const body = encodeURIComponent(prof.emailDraft)
    window.location.href = `mailto:${prof.email || ''}?subject=${subject}&body=${body}`
    logSent(prof)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>Professor Outreach</h1>
        <p style={{ fontSize: 14, color: '#666' }}>Find professors, draft emails, track outreach</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {['search', 'profile', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid',
            borderColor: tab === t ? '#7F77DD' : '#ddd',
            background: tab === t ? '#EEEDFE' : 'white',
            color: tab === t ? '#3C3489' : '#444',
            fontSize: 14, cursor: 'pointer', fontWeight: tab === t ? 500 : 400
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Your profile</h2>
          {[['name', 'Full name'], ['school', 'Your current school'], ['major', 'Major (e.g. Computer Science)']].map(([k, ph]) => (
            <input key={k} placeholder={ph} value={profile[k]} onChange={e => setProfile(p => ({ ...p, [k]: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 10, boxSizing: 'border-box' }} />
          ))}
          <textarea placeholder="A sentence about your background, skills, interests..." value={profile.background}
            onChange={e => setProfile(p => ({ ...p, background: e.target.value }))}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, minHeight: 80, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }} />
          <button onClick={saveProfile} style={{
            padding: '9px 20px', background: '#EEEDFE', border: '1px solid #AFA9EC',
            borderRadius: 8, color: '#3C3489', fontSize: 14, cursor: 'pointer', fontWeight: 500
          }}>
            {profileSaved ? 'Saved!' : 'Save profile'}
          </button>
        </div>
      )}

      {tab === 'search' && (
        <div>
          <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem', marginBottom: 12 }}>
            <input placeholder="University name (e.g. MIT, Stanford, Georgia Tech)" value={university}
              onChange={e => setUniversity(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', marginBottom: 14 }} />

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 500 }}>FOCUS AREAS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FOCUSES.map(f => (
                  <span key={f} onClick={() => toggleFocus(f)} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: focuses.includes(f) ? '#EEEDFE' : '#f5f5f5',
                    color: focuses.includes(f) ? '#3C3489' : '#666',
                    border: `1px solid ${focuses.includes(f) ? '#AFA9EC' : '#e0e0e0'}`
                  }}>{f}</span>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 500 }}>GOALS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {GOALS.map(g => (
                  <span key={g} onClick={() => toggleGoal(g)} style={{
                    fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: goals.includes(g) ? '#E1F5EE' : '#f5f5f5',
                    color: goals.includes(g) ? '#085041' : '#666',
                    border: `1px solid ${goals.includes(g) ? '#5DCAA5' : '#e0e0e0'}`
                  }}>{g}</span>
                ))}
              </div>
            </div>

            <button onClick={search} disabled={loading} style={{
              width: '100%', padding: 11, fontSize: 15, fontWeight: 500,
              background: loading ? '#f0f0f0' : '#EEEDFE', border: '1px solid #AFA9EC',
              borderRadius: 8, color: '#3C3489', cursor: loading ? 'not-allowed' : 'pointer'
            }}>
              {loading ? 'Searching...' : 'Find professors + draft emails'}
            </button>
            {error && <div style={{ marginTop: 10, fontSize: 13, color: '#A32D2D', background: '#FCEBEB', padding: '8px 12px', borderRadius: 8 }}>{error}</div>}
          </div>

          {professors.map((prof, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: '#EEEDFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 500, color: '#3C3489', flexShrink: 0
                }}>{initials(prof.name || 'PR')}</div>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 15 }}>{prof.name}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>{prof.department} · {prof.email || 'email not found'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {(prof.researchInterests || []).map((r, j) => (
                  <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#E1F5EE', color: '#085041' }}>{r}</span>
                ))}
              </div>
              <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 10, color: '#333' }}>
                {prof.emailDraft}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEmail(prof)} style={{
                  padding: '7px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  background: '#EEEDFE', border: '1px solid #AFA9EC', color: '#3C3489', fontWeight: 500
                }}>Open in mail app</button>
                <button onClick={() => { navigator.clipboard.writeText(prof.emailDraft) }} style={{
                  padding: '7px 14px', fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  background: 'white', border: '1px solid #ddd', color: '#444'
                }}>Copy email</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem' }}>
          <h2 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Outreach history</h2>
          {history.length === 0 && <p style={{ fontSize: 14, color: '#888' }}>No emails sent yet. Start reaching out!</p>}
          {[...history].reverse().map((h, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{h.professor}</div>
              <div style={{ fontSize: 13, color: '#666' }}>{h.university} · {h.email}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{new Date(h.date).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}