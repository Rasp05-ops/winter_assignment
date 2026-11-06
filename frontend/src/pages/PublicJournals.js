import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { journalAPI } from '../services/api';

function PublicJournals() {
  const navigate = useNavigate();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicJournals();
  }, []);

  const fetchPublicJournals = async () => {
    try {
      const res = await journalAPI.getPublic();
      setJournals(res.data);
    } catch (error) {
      console.error('Failed to fetch public journals', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
        <h1 className="text-3xl font-bold">Community Stories </h1>
      </header>

      {loading ? (
        <p>Loading...</p>
      ) : journals.length === 0 ? (
        <p className="text-gray-500">No public stories yet.</p>
      ) : (
        <div className="grid gap-6">
          {journals.map((journal) => (
            <div key={journal.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center overflow-hidden">
                  {journal.user?.profilePicture ? (
                    <img 
                      src={`http://localhost:3001/uploads/profile-pictures/${journal.user.profilePicture}`} 
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    <span>Journal</span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold">{journal.title}</h3>
                  <p className="text-xs text-gray-400">by @{journal.user?.username || 'Unknown'}</p>
                </div>
              </div>
              <p className="text-gray-300">{journal.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PublicJournals;