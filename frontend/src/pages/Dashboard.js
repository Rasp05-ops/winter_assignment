import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, moodAPI } from '../services/api';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await dashboardAPI.getDashboard();
      setDashboard(response.data.dashboard);
      
      // Show mood prompt if not logged today
      if (response.data.dashboard.moodLogPrompt) {
        setShowMoodModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
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
    { value: 'good', emoji: '😊', label: 'Good', color: 'from-green-500 to-emerald-500' },
    { value: 'neutral', emoji: '😐', label: 'Neutral', color: 'from-yellow-500 to-orange-500' },
    { value: 'bad', emoji: '😢', label: 'Bad', color: 'from-red-500 to-rose-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* Header */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue via-accent-purple to-accent-pink flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold gradient-text">MindSpace</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Hey, {user?.username}!</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-lg transition-all text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-slide-up">
          <h2 className="text-4xl font-bold text-white mb-2">
            Welcome back, {user?.displayName || user?.username}! 👋
          </h2>
          <p className="text-gray-400">Here's what's happening with your mental wellness today</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {dashboard?.moodStats?.loggedDays || 0}
            </h3>
            <p className="text-gray-400 text-sm">Days logged this week</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-purple transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {dashboard?.joinedCircles?.length || 0}
            </h3>
            <p className="text-gray-400 text-sm">Support circles joined</p>
          </div>

          <div className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-pink transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {dashboard?.recentJournals?.length || 0}
            </h3>
            <p className="text-gray-400 text-sm">Journal entries</p>
          </div>
        </div>

        {/* Recommended Circles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">Recommended Circles</h3>
            <button className="text-accent-blue hover:text-accent-purple transition-colors text-sm">
              View All →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboard?.recommendedCircles?.slice(0, 3).map((circle) => (
              <div key={circle.id} className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all group cursor-pointer">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-2xl">
                    {circle.category === 'anxiety' && '😰'}
                    {circle.category === 'depression' && '😔'}
                    {circle.category === 'stress' && '😓'}
                    {circle.category === 'mindfulness' && '🧘'}
                    {circle.category === 'productivity' && '⚡'}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold group-hover:text-accent-blue transition-colors">
                      {circle.name}
                    </h4>
                    <p className="text-gray-500 text-xs">{circle.memberCount} members</p>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{circle.description}</p>
                <div className="flex flex-wrap gap-2">
                  {circle.tags?.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-accent-blue/10 text-accent-blue text-xs rounded-lg">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Journals */}
        {dashboard?.recentJournals?.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-white mb-6">Recent Journals</h3>
            <div className="space-y-4">
              {dashboard.recentJournals.map((journal) => (
                <div key={journal.id} className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-purple transition-all cursor-pointer">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white font-semibold">{journal.title}</h4>
                    <span className="text-gray-500 text-sm">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-3xl p-8 max-w-md w-full border border-dark-border animate-slide-up">
            <h3 className="text-2xl font-bold text-white mb-2">How are you feeling today?</h3>
            <p className="text-gray-400 mb-6">Track your daily mood to understand your patterns</p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              {moods.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    selectedMood === mood.value
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-dark-border hover:border-accent-blue/50'
                  }`}
                >
                  <div className="text-4xl mb-2">{mood.emoji}</div>
                  <div className="text-white text-sm font-medium">{mood.label}</div>
                </button>
              ))}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setShowMoodModal(false)}
                className="flex-1 py-3 px-6 rounded-xl bg-dark-card text-gray-300 font-semibold border border-dark-border hover:border-accent-blue transition-all"
              >
                Skip
              </button>
              <button
                onClick={handleLogMood}
                disabled={!selectedMood}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
