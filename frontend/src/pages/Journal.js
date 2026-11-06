import React, { useState, useEffect } from 'react';
import { journalAPI, circleAPI } from '../services/api';

// ---------- ML presentation helpers ----------
const SENTIMENT_STYLE = {
  positive: { emoji: '😊', label: 'Positive', cls: 'bg-emerald-900/60 text-emerald-300 border-emerald-700' },
  neutral: { emoji: '😐', label: 'Neutral', cls: 'bg-slate-700/60 text-slate-300 border-slate-600' },
  negative: { emoji: '😔', label: 'Negative', cls: 'bg-rose-900/60 text-rose-300 border-rose-700' },
};

function SentimentBadge({ journal }) {
  if (journal.analysisStatus === 'pending') {
    return (
      <span className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400" title="The analysis service is catching up; this will update automatically">
        ⏳ Analyzing…
      </span>
    );
  }
  const st = SENTIMENT_STYLE[journal.sentimentLabel];
  if (!st) return null;
  const topEmotion = journal.sentimentDetails && journal.sentimentDetails.emotions
    ? Object.entries(journal.sentimentDetails.emotions).sort((a, b) => b[1] - a[1])[0]
    : null;
  const confidence = journal.sentimentConfidence != null ? ` · ${Math.round(journal.sentimentConfidence * 100)}%` : '';
  return (
    <span
      className={`text-xs px-2 py-1 rounded border ${st.cls}`}
      title={`Automatic estimate, not a diagnosis. Score ${journal.sentimentScore?.toFixed(2)}`}
    >
      {st.emoji} {st.label}{confidence}{topEmotion ? ` · ${topEmotion[0]}` : ''}
    </span>
  );
}

// Dependency-free bar chart of daily average sentiment (-1..+1)
function SentimentTrend({ trend }) {
  if (!trend || trend.length === 0) return null;
  const W = 600, H = 90, mid = H / 2, bw = Math.max(6, Math.min(28, W / trend.length - 6));
  const step = trend.length > 1 ? (W - bw) / (trend.length - 1) : 0;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
      <div className="flex justify-between items-baseline mb-2">
        <h2 className="text-sm font-semibold text-gray-300">Mood trend (last 30 days)</h2>
        <span className="text-xs text-gray-500">daily average sentiment</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" role="img" aria-label="Daily average journal sentiment">
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="#475569" strokeDasharray="3 3" />
        {trend.map((d, i) => {
          const h = Math.max(2, Math.abs(d.avg_score) * (mid - 4));
          const up = d.avg_score >= 0;
          return (
            <rect key={d.date} x={i * step} y={up ? mid - h : mid} width={bw} height={h} rx="2"
                  fill={up ? '#34d399' : '#fb7185'}>
              <title>{`${d.date}: ${d.avg_score} (${d.entries} entr${d.entries === 1 ? 'y' : 'ies'})`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function Journal() {
  // --- STATES ---
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // ML features: semantic search, "similar entries", sentiment trend
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchInfo, setSearchInfo] = useState(null); // { label, mode } while a search/similar view is active
  const [searchResults, setSearchResults] = useState(null); // null = show normal list
  const [trend, setTrend] = useState([]);
  
  // Form States
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('private'); // private, public, circles
  const [tags, setTags] = useState('');
  
  // Sharing Logic
  const [myCircles, setMyCircles] = useState([]); // List of circles I belong to
  const [selectedCircles, setSelectedCircles] = useState([]); // Circles I chose to share with

  useEffect(() => {
    fetchJournals();
    fetchTrend();
  }, []);

  // While some entries are still waiting for the ML service, quietly refresh until they're scored.
  const hasPending = journals.some(j => j.analysisStatus === 'pending');
  useEffect(() => {
    if (!hasPending || searchResults) return undefined;
    const id = setInterval(() => { fetchJournals(); fetchTrend(); }, 10000);
    return () => clearInterval(id);
  }, [hasPending, searchResults]);

  // Fetch circles only when user selects "Circles" visibility
  useEffect(() => {
    if (visibility === 'circles' && myCircles.length === 0) {
      fetchMyCircles();
    }
  }, [visibility]);

  const fetchJournals = async () => {
    try {
      const res = await journalAPI.getAll();
      setJournals(res.data.journals || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async () => {
    try {
      const res = await journalAPI.getSentimentTrend(30);
      setTrend(res.data.trend || []);
    } catch (error) {
      // Mood trend is a nice-to-have; never break the page for it.
      console.error('Failed to load sentiment trend', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) { clearSearch(); return; }
    setSearching(true);
    try {
      const res = await journalAPI.semanticSearch(q);
      setSearchResults(res.data.journals || []);
      setSearchInfo({ label: `Results for “${q}”`, mode: res.data.mode });
    } catch (error) {
      console.error('Search failed', error);
      alert('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const showSimilar = async (journal) => {
    setSearching(true);
    try {
      const res = await journalAPI.getSimilar(journal.id);
      setSearchResults(res.data.journals || []);
      setSearchInfo({
        label: `Entries similar to “${journal.title}”`,
        mode: res.data.available === false ? 'unavailable' : 'semantic',
      });
    } catch (error) {
      console.error('Similar lookup failed', error);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearchResults(null);
    setSearchInfo(null);
  };

  const fetchMyCircles = async () => {
    try {
      const res = await circleAPI.getMyCircles();
      setMyCircles(res.data.circles || []);
    } catch (error) {
      console.error("Failed to load circles", error);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      // Create the payload
      const payload = {
        title,
        body,
        visibility,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        // IMPORTANT: Send the list of selected circle IDs
        sharedCircles: visibility === 'circles' ? selectedCircles : [] 
      };

      await journalAPI.create(payload);
      
      // Reset and close
      setShowModal(false);
      setTitle('');
      setBody('');
      setVisibility('private');
      setSelectedCircles([]);
      fetchJournals();
      fetchTrend();
    } catch (error) {
      alert('Failed to save journal');
    }
  };

  const toggleCircleSelection = (circleId) => {
    setSelectedCircles(prev => 
      prev.includes(circleId) 
        ? prev.filter(id => id !== circleId) 
        : [...prev, circleId]
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Journal 📔</h1>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold"
          >
            + New Entry
          </button>
        </div>

        {/* Mood trend (hidden until there is scored data) */}
        <SentimentTrend trend={trend} />

        {/* Semantic search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by meaning, e.g. “times I felt anxious about work”"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <button type="submit" disabled={searching} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold">
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {searchInfo && (
          <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
            <span>
              {searchInfo.label}
              {searchInfo.mode === 'keyword' && ' — smart search is unavailable right now, showing keyword matches'}
              {searchInfo.mode === 'unavailable' && ' — similarity search is not enabled on this server'}
            </span>
            <button onClick={clearSearch} className="text-blue-400 hover:underline">Clear</button>
          </div>
        )}
        {searchResults && searchResults.length === 0 && (
          <p className="text-gray-500 mb-4">No matching entries.</p>
        )}

        {/* Journal List */}
        <div className="space-y-4">
          {loading ? <p>Loading...</p> : (searchResults || journals).map(journal => (
            <div key={journal.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-xl">{journal.title}</h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  journal.visibility === 'private' ? 'bg-gray-700 text-gray-300' : 
                  journal.visibility === 'public' ? 'bg-green-900 text-green-300' : 
                  'bg-purple-900 text-purple-300'
                }`}>
                  {journal.visibility.toUpperCase()}
                </span>
              </div>
              <p className="text-gray-300 whitespace-pre-wrap">{journal.body}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-gray-500">{new Date(journal.createdAt).toLocaleDateString()}</p>
                  <SentimentBadge journal={journal} />
                  {journal.similarity != null && (
                    <span className="text-xs px-2 py-1 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700">
                      {Math.round(journal.similarity * 100)}% match
                    </span>
                  )}
                </div>
                <button onClick={() => showSimilar(journal)} className="text-xs text-blue-400 hover:underline">
                  Find similar entries
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* === CREATE MODAL === */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 p-6 rounded-2xl w-full max-w-2xl border border-slate-700">
              <h2 className="text-2xl font-bold mb-4">New Journal Entry</h2>
              
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    placeholder="Title your day..."
                    required
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Content</label>
                  <textarea 
                    value={body} 
                    onChange={e => setBody(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-40"
                    placeholder="Write your thoughts..."
                    required
                  />
                </div>

                {/* Visibility Selector */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Visibility</label>
                  <select 
                    value={visibility} 
                    onChange={e => setVisibility(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="private">🔒 Private (Only me)</option>
                    <option value="public">🌍 Public (Everyone)</option>
                    <option value="circles">👥 Specific Circles</option>
                  </select>
                </div>

                {/* CIRCLE SELECTOR (Only shows if 'Specific Circles' is chosen) */}
                {visibility === 'circles' && (
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 animate-in fade-in">
                    <p className="text-sm text-purple-400 mb-2 font-bold">Select circles to share with:</p>
                    {myCircles.length === 0 ? (
                      <p className="text-xs text-gray-500">You haven't joined any circles yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {myCircles.map(circle => (
                          <label key={circle.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                            <input 
                              type="checkbox" 
                              checked={selectedCircles.includes(circle.id)}
                              onChange={() => toggleCircleSelection(circle.id)}
                              className="rounded border-slate-600 bg-slate-700 text-purple-500"
                            />
                            <span className="text-sm">{circle.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tags (comma separated)</label>
                  <input 
                    value={tags} 
                    onChange={e => setTags(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                    placeholder="happy, stress, work..."
                  />
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold">Save Entry</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default Journal;