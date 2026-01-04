import React, { useState, useEffect } from 'react';
import { journalAPI, circleAPI } from '../services/api';

function Journal() {
  // --- STATES ---
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
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
  }, []);

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

        {/* Journal List */}
        <div className="space-y-4">
          {loading ? <p>Loading...</p> : journals.map(journal => (
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
              <p className="text-xs text-gray-500 mt-4">{new Date(journal.createdAt).toLocaleDateString()}</p>
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