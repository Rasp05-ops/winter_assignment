import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, moodAPI, circleAPI } from '../services/api'; // <--- Added circleAPI
import Notifications from '../components/Notifications';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');

  // New state for calculated recommendations
  const [recommendedCircles, setRecommendedCircles] = useState([]);

  useEffect(() => {
    fetchDashboard();
  }, [user]);

const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [dashRes, circlesRes] = await Promise.all([
        dashboardAPI.getDashboard(),
        circleAPI.getAll()
      ]);

      const dashData = dashRes.data.dashboard;
      setDashboard(dashData);

      const allCircles = circlesRes.data.circles || [];
      const joinedIds = dashData.joinedCircles ? dashData.joinedCircles.map(c => c.id) : [];
      
      // 1. Filter: Get only UNJOINED circles
      let candidates = allCircles.filter(circle => !joinedIds.includes(circle.id));

      // 2. Personalization Logic (Scoring System)
      const userInterests = user?.interests || []; // e.g. ['anxiety', 'yoga']
      
      // If user has a recent mood log, prioritize relevant categories
      // (This assumes dashData.moodStats.lastMood exists, or we use defaults)
      const currentMood = dashData.moodStats?.lastMood || 'neutral';
      const moodKeywords = currentMood === 'bad' ? ['anxiety', 'depression', 'stress'] : 
                           currentMood === 'good' ? ['productivity', 'mindfulness'] : [];

      // Sort candidates by relevance score
      candidates.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        // Scoring A
        if (moodKeywords.includes(a.category?.toLowerCase())) scoreA += 5; // High priority for mood
        if (userInterests.includes(a.category)) scoreA += 3; // Medium for interest match
        if (a.tags?.some(tag => userInterests.includes(tag))) scoreA += 1; // Low for tag match
        scoreA += (a.memberCount || 0) * 0.1; // Tie-breaker: popularity

        // Scoring B
        if (moodKeywords.includes(b.category?.toLowerCase())) scoreB += 5;
        if (userInterests.includes(b.category)) scoreB += 3;
        if (b.tags?.some(tag => userInterests.includes(tag))) scoreB += 1;
        scoreB += (b.memberCount || 0) * 0.1;

        return scoreB - scoreA; // Descending order (Highest score first)
      });

      // 3. Take top 3
      setRecommendedCircles(candidates.slice(0, 3));
      
      if (dashData.moodLogPrompt) {
        setShowMoodModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleLogMood = async () => {
    if (!selectedMood) return;
    
    try {
      await moodAPI.logMood({ mood: selectedMood });
      setShowMoodModal(false);
      fetchDashboard(); // Refresh dashboard
    } catch (error) {
      console.error('Failed to log mood:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading your dashboard...</div>
      </div>
    );
  }

  const moods = [
    { value: 'good', label: 'Good', color: 'from-green-500 to-emerald-500' },
    { value: 'neutral', label: 'Neutral', color: 'from-yellow-500 to-orange-500' },
    { value: 'bad', label: 'Bad', color: 'from-red-500 to-rose-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* ================= HEADER ================= */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          
          {/* Left Side: Logo */}
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue via-accent-purple to-accent-pink flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold gradient-text">MindSpace</h1>
          </div>

          {/* Right Side: Navigation & User Actions */}
          <div className="flex items-center space-x-6">
            <div className="hidden md:flex items-center space-x-6">
              <button 
      onClick={() => navigate('/discovery')}
      className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
    >
      <span>Discover</span>
    </button>
              <button onClick={() => navigate('/circles')} className="text-gray-400 hover:text-white transition-colors">
                Circles
              </button>
            </div>

            <div className="hidden md:block w-px h-6 bg-dark-border"></div>

            <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate('/profile')} 
                className="flex items-center space-x-2 group hover:bg-white/5 p-2 rounded-lg transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center overflow-hidden border border-transparent group-hover:border-accent-blue">
                   {user?.profilePicture ? (
                     <img 
                        src={`http://localhost:3001/uploads/profile-pictures/${user.profilePicture}`} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                     />
                   ) : (
                     <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
                   )}
                </div>
                <span className="text-gray-400 text-sm font-medium group-hover:text-white transition-colors">
                  Hey, {user?.username}!
                </span>
              </button>
              
              <Notifications />
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-all text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Welcome Section */}
        <div className="mb-10 animate-slide-up flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">
              Welcome back, {user?.displayName || user?.username}!
            </h2>
            <p className="text-gray-400">Here's what's happening with your mental wellness today</p>
          </div>
          
          <button
            onClick={() => navigate('/mood')}
            className="px-6 py-3 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-xl font-semibold shadow-lg hover:scale-105 transition-all flex items-center space-x-2"
          >
            <span>Open</span>
            <span>Open Mood Tracker</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          
          {/* Card 1: Mood Stats */}
          <div 
            onClick={() => navigate('/mood')}
            className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-sm">Mood</span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">
              {dashboard?.moodStats?.loggedDays || 0}
            </h3>
            <p className="text-gray-400 text-sm">Days logged this week</p>
          </div>

          {/* Card 2: Circles Joined */}
          <div 
            onClick={() => navigate('/circles')}
            className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-purple transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-sm">Circles</span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">
              {dashboard?.joinedCircles?.length || 0}
            </h3>
            <p className="text-gray-400 text-sm">Support circles joined</p>
          </div>

          {/* Card 3: Journal Entries */}
          <div 
            onClick={() => navigate('/journal')}
            className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-pink transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="text-sm">Journal</span>
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-1">
              {dashboard?.recentJournals?.length || 0}
            </h3>
            <p className="text-gray-400 text-sm">Journal entries</p>
          </div>
        </div>

        {/* Community Feed Button */}
        <div className="mt-8 mb-8">
          <button 
            onClick={() => navigate('/community')}
            className="w-full p-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg transition-all transform hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-xl font-bold mb-1"> Community Stories</h3>
                <p className="text-blue-100">Read public journals from other members</p>
              </div>
              <span className="text-3xl">→</span>
            </div>
          </button>
        </div>

        {/* Recommended Circles Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Recommended Circles</h3>
            <button 
              onClick={() => navigate('/circles')}
              className="text-accent-blue hover:text-accent-purple transition-colors text-sm font-medium flex items-center"
            >
              View All <span className="ml-1">→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedCircles.length === 0 ? (
              <div className="col-span-3 text-center text-gray-500 py-8">
                <p>No new circles to recommend right now.</p>
                <button onClick={() => navigate('/circles')} className="text-blue-400 text-sm hover:underline mt-2">Browse all circles</button>
              </div>
            ) : (
              recommendedCircles.slice(0, 3).map((circle) => (
                <div 
                  key={circle.id} 
                  onClick={() => navigate(`/circles/${circle.id}`)}
                  className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all group cursor-pointer flex flex-col h-full"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-2xl flex-shrink-0">
                      {circle.category === 'anxiety' && ''}
                      {circle.category === 'depression' && ''}
                      {circle.category === 'stress' && ''}
                      {circle.category === 'mindfulness' && ''}
                      {circle.category === 'productivity' && ''}
                      {!['anxiety','depression','stress','mindfulness','productivity'].includes(circle.category) && ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-semibold group-hover:text-accent-blue transition-colors truncate">
                        {circle.name}
                      </h4>
                      <p className="text-gray-500 text-xs">{circle.memberCount} members</p>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2 flex-grow">{circle.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {circle.tags?.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-accent-blue/10 text-accent-blue text-xs rounded-lg border border-accent-blue/20">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Journals Section */}
        {dashboard?.recentJournals?.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Recent Journals</h3>
              <button 
                onClick={() => navigate('/journal')}
                className="text-accent-pink hover:text-white transition-colors text-sm font-medium flex items-center"
              >
                View All <span className="ml-1">→</span>
              </button>
            </div>
            
            <div className="space-y-4">
              {dashboard.recentJournals.map((journal) => (
                <div 
                  key={journal.id} 
                  onClick={() => navigate('/journal')}
                  className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-pink transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-semibold group-hover:text-accent-pink transition-colors mb-1">{journal.title}</h4>
                      <p className="text-gray-400 text-sm line-clamp-1">{journal.body || "No preview available"}</p>
                    </div>
                    <span className="text-gray-500 text-xs whitespace-nowrap ml-4">
                      {new Date(journal.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Mood Log Modal */}
      {showMoodModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass rounded-3xl p-8 max-w-md w-full border border-dark-border animate-slide-up shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-2 text-center">How are you feeling today?</h3>
            <p className="text-gray-400 mb-8 text-center">Track your daily mood to understand your patterns</p>
            
            <div className="grid grid-cols-3 gap-4 mb-8">
              {moods.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${
                    selectedMood === mood.value
                      ? 'border-accent-blue bg-accent-blue/10 scale-105'
                      : 'border-dark-border hover:border-accent-blue/50 hover:bg-white/5'
                  }`}
                >
                  <div className="text-lg mb-2 transition-transform hover:scale-110">{mood.label}</div>
                  <div className="text-white text-sm font-medium">{mood.label}</div>
                </button>
              ))}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowMoodModal(false)}
                className="flex-1 py-3 px-6 rounded-xl bg-transparent text-gray-400 font-medium border border-dark-border hover:bg-white/5 transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleLogMood}
                disabled={!selectedMood}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-accent-blue/20 transition-all transform active:scale-95"
              >
                Log Mood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;