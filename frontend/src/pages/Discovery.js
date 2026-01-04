import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchAPI, circleAPI } from '../services/api';

// Debounce hook to prevent API spam while typing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

function Discovery() {
  const navigate = useNavigate();
  
  // State
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null means "Discovery Mode"
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'circles', 'users', 'journals'

  // Discovery Data (Default View)
  const [recommended, setRecommended] = useState([]);
  const [trending, setTrending] = useState([]);
  
  // Filters
  const [availableFilters, setAvailableFilters] = useState({ tags: [], categories: [] });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const debouncedQuery = useDebounce(query, 500);

  // 1. Initial Load: Get Recommendations & Filters
  useEffect(() => {
    fetchDiscoveryData();
    fetchFilters();
  }, []);

  // 2. Search Effect: Triggers when query or filters change
  useEffect(() => {
    if (debouncedQuery.length >= 2 || selectedCategory || selectedTags.length > 0) {
      handleSearch();
    } else if (debouncedQuery.length === 0) {
      setResults(null); // Go back to discovery mode
    }
  }, [debouncedQuery, selectedCategory, selectedTags, activeTab]);

  const fetchDiscoveryData = async () => {
    try {
      const [recRes, trendRes] = await Promise.all([
        searchAPI.getDiscover(),
        searchAPI.getTrending()
      ]);
      setRecommended(recRes.data.circles || []);
      setTrending(trendRes.data.circles || []);
    } catch (error) {
      console.error('Discovery load failed:', error);
    }
  };

  const fetchFilters = async () => {
    try {
      const res = await searchAPI.getFilters();
      setAvailableFilters(res.data.filters);
    } catch (error) {
      console.error('Filters load failed:', error);
    }
  };

const handleSearch = async () => {
    setLoading(true);
    try {
      // CASE 1: SEARCH USERS
      if (activeTab === 'users') {
        // Make sure you have this function in your api.js!
        const res = await searchAPI.searchUsers(debouncedQuery);
        setResults({ 
          users: res.data.users, 
          circles: [], 
          journals: [] 
        });
      }
      
      // CASE 2: GLOBAL SEARCH (ALL) - No filters applied
      else if (activeTab === 'all' && !selectedCategory && selectedTags.length === 0) {
        const res = await searchAPI.searchAll(debouncedQuery);
        setResults(res.data.results);
      } 
      
      // CASE 3: SEARCH CIRCLES (Specific Tab OR 'All' with filters)
      else {
        const params = {
          query: debouncedQuery,
          category: selectedCategory,
          tags: selectedTags,
        };
        const res = await searchAPI.searchCircles(params);
        
        // We set circles, and empty out others so they don't show stale data
        setResults({
          circles: res.data.circles,
          users: [], 
          journals: []
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleJoinCircle = async (e, circleId) => {
    e.stopPropagation();
    try {
      await circleAPI.join(circleId);
      // Refresh logic could go here
      alert('Request sent!');
    } catch (error) {
      console.error('Join failed', error);
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* Search Header */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4 mb-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
              ←
            </button>
            <div className="flex-1 relative">
              <span className="absolute left-4 top-3.5 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search circles, users, journals..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none"
              />
            </div>
          </div>

          {/* Filters & Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex space-x-2">
              {['all', 'circles', 'users'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg capitalize text-sm transition-all ${
                    activeTab === tab 
                      ? 'bg-accent-blue text-white' 
                      : 'text-gray-400 hover:text-white bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Category Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-dark-card border border-dark-border text-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-accent-blue"
            >
              <option value="">All Categories</option>
              {availableFilters.categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Popular Tags */}
          {availableFilters.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pb-2">
              {availableFilters.tags.slice(0, 8).map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-accent-purple text-white border-accent-purple'
                      : 'border-dark-border text-gray-400 hover:border-gray-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Searching the cosmos...</div>
        ) : !results ? (
          /* ================= DISCOVERY MODE (Default) ================= */
          <div className="space-y-12">
            
            {/* Recommended Section */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">✨ Recommended for You</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommended.map(circle => (
                  <CircleCard key={circle.id} circle={circle} onClick={() => navigate(`/circles/${circle.id}`)} onJoin={handleJoinCircle} />
                ))}
              </div>
            </section>

            {/* Trending Section */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">🔥 Trending Now</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trending.map(circle => (
                  <CircleCard key={circle.id} circle={circle} onClick={() => navigate(`/circles/${circle.id}`)} onJoin={handleJoinCircle} />
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ================= SEARCH RESULTS MODE ================= */
          <div className="space-y-10">
            
            {/* Circles Results */}
            {(activeTab === 'all' || activeTab === 'circles') && results.circles?.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-gray-300 mb-4">Circles ({results.circles.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.circles.map(circle => (
                    <CircleCard key={circle.id} circle={circle} onClick={() => navigate(`/circles/${circle.id}`)} onJoin={handleJoinCircle} />
                  ))}
                </div>
              </section>
            )}

            {/* Users Results */}
            {(activeTab === 'all' || activeTab === 'users') && results.users?.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-gray-300 mb-4">Users ({results.users.length})</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {results.users.map(user => (
                    <div key={user.id} className="glass p-4 rounded-xl border border-dark-border text-center">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-gray-700 to-gray-600 mb-2 flex items-center justify-center text-xl">
                        {user.profilePicture ? <img src={user.profilePicture} alt="" className="rounded-full" /> : '👤'}
                      </div>
                      <div className="font-bold text-white">{user.displayName}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Journals Results (Only in 'all' tab usually) */}
            {activeTab === 'all' && results.journals?.length > 0 && (
              <section>
                <h3 className="text-xl font-semibold text-gray-300 mb-4">Public Journals ({results.journals.length})</h3>
                <div className="space-y-4">
                  {results.journals.map(journal => (
                    <div key={journal.id} className="glass p-6 rounded-xl border border-dark-border hover:border-accent-blue transition-all cursor-pointer">
                      <h4 className="font-bold text-white mb-2">{journal.title}</h4>
                      <p className="text-gray-400 text-sm line-clamp-2">{journal.body}</p>
                      <div className="mt-2 text-xs text-gray-500">By @{journal.user?.username}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {(!results.circles?.length && !results.users?.length && !results.journals?.length) && (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">🤔</div>
                <h3 className="text-white text-xl">No results found</h3>
                <p className="text-gray-400">Try adjusting your search terms or filters.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// Sub-component for consistent Circle cards
function CircleCard({ circle, onClick, onJoin }) {
  return (
    <div 
      onClick={onClick}
      className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all group cursor-pointer flex flex-col h-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-accent-blue transition-colors">
            {circle.name}
          </h3>
          <p className="text-xs text-gray-500">{circle.memberCount} members • {circle.category}</p>
        </div>
        {circle.isPrivate && <span className="text-yellow-500 text-xs border border-yellow-500/30 px-2 py-1 rounded">🔒</span>}
      </div>
      
      <p className="text-gray-400 text-sm mb-4 line-clamp-2 flex-grow">{circle.description}</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {circle.tags?.slice(0, 2).map((tag, i) => (
          <span key={i} className="text-xs px-2 py-1 bg-white/5 rounded text-gray-300">#{tag}</span>
        ))}
      </div>

      <button
        onClick={(e) => onJoin(e, circle.id)}
        className="w-full py-2 bg-accent-blue/10 text-accent-blue border border-accent-blue/50 rounded-lg hover:bg-accent-blue hover:text-white transition-all text-sm font-medium"
      >
        Join Circle
      </button>
    </div>
  );
}

export default Discovery;