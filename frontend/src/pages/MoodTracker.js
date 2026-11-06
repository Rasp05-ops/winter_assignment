import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { moodAPI } from '../services/api';

function MoodTracker() {
  const navigate = useNavigate();
  const [view, setView] = useState('calendar'); // 'calendar' or 'stats'
  const [calendar, setCalendar] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');
  const [moodDetails, setMoodDetails] = useState({
    emotions: [],
    activities: [],
    notes: '',
  });

  const moods = [
    { value: 'good', label: 'Good', color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/20' },
    { value: 'neutral', label: 'Neutral', color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-500/20' },
    { value: 'bad', label: 'Bad', color: 'from-red-500 to-rose-500', bg: 'bg-red-500/20' },
  ];

  const emotions = ['happy', 'sad', 'anxious', 'calm', 'energetic', 'tired', 'stressed', 'peaceful'];
  const activities = ['exercise', 'meditation', 'work', 'socializing', 'hobby', 'rest', 'therapy'];

  useEffect(() => {
    fetchData();
  }, [view]);

  const fetchData = async () => {
    try {
      if (view === 'calendar') {
        const response = await moodAPI.getCalendar(30);
        setCalendar(response.data);
      } else {
        const response = await moodAPI.getStats(30);
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch mood data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogMood = async () => {
    if (!selectedMood) return;

    try {
      await moodAPI.logMood({
        mood: selectedMood,
        emotions: moodDetails.emotions,
        activities: moodDetails.activities,
        notes: moodDetails.notes,
      });
      setShowLogModal(false);
      setSelectedMood('');
      setMoodDetails({ emotions: [], activities: [], notes: '' });
      fetchData();
    } catch (error) {
      console.error('Failed to log mood:', error);
    }
  };

  const getMoodEmoji = (mood) => {
    return moods.find(m => m.value === mood)?.label || '';
  };

  const getMoodColor = (mood) => {
    return moods.find(m => m.value === mood)?.bg || 'bg-gray-500/20';
  };

  const generateCalendarDays = () => {
    if (!calendar) return [];
    
    const days = [];
    const today = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const moodLog = calendar.calendar?.find(log => log.date === dateStr);
      
      days.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en', { weekday: 'short' }),
        dayNum: date.getDate(),
        mood: moodLog?.mood || null,
      });
    }
    
    return days;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* Header */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
                ← Back
              </button>
              <h1 className="text-2xl font-bold gradient-text">Mood Tracker</h1>
            </div>
            <button
              onClick={() => setShowLogModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-lg hover:scale-105 transition-all"
            >
              + Log Mood
            </button>
          </div>

          {/* View Tabs */}
          <div className="flex space-x-2">
            <button
              onClick={() => setView('calendar')}
              className={`px-4 py-2 rounded-lg transition-all ${
                view === 'calendar'
                  ? 'bg-gradient-to-r from-accent-blue to-accent-purple text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
               Calendar
            </button>
            <button
              onClick={() => setView('stats')}
              className={`px-4 py-2 rounded-lg transition-all ${
                view === 'stats'
                  ? 'bg-gradient-to-r from-accent-blue to-accent-purple text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
               Statistics
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading...</div>
        ) : view === 'calendar' ? (
          /* Calendar View */
          <div>
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="glass rounded-2xl p-6 border border-dark-border">
                <div className="text-gray-400 text-sm mb-2">Total Logs</div>
                <div className="text-3xl font-bold text-white">{calendar?.stats?.total || 0}</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-green-500/30 bg-green-500/5">
                <div className="text-gray-400 text-sm mb-2"> Good Days</div>
                <div className="text-3xl font-bold text-green-400">{calendar?.stats?.good || 0}</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-yellow-500/30 bg-yellow-500/5">
                <div className="text-gray-400 text-sm mb-2"> Neutral Days</div>
                <div className="text-3xl font-bold text-yellow-400">{calendar?.stats?.neutral || 0}</div>
              </div>
              <div className="glass rounded-2xl p-6 border border-red-500/30 bg-red-500/5">
                <div className="text-gray-400 text-sm mb-2"> Bad Days</div>
                <div className="text-3xl font-bold text-red-400">{calendar?.stats?.bad || 0}</div>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="glass rounded-2xl p-6 border border-dark-border">
              <h3 className="text-xl font-bold text-white mb-6">Last 30 Days</h3>
              <div className="grid grid-cols-7 gap-2">
                {generateCalendarDays().map((day, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square rounded-xl border ${
                      day.mood
                        ? `${getMoodColor(day.mood)} border-accent-blue/50`
                        : 'border-dark-border bg-dark-card/50'
                    } flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-all`}
                    title={day.date}
                  >
                    <div className="text-xs text-gray-500 mb-1">{day.dayName}</div>
                    <div className="text-sm font-medium">{day.mood ? getMoodEmoji(day.mood) : 'No entry'}</div>
                    <div className="text-xs text-gray-400 mt-1">{day.dayNum}</div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-6 mt-6 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/50"></div>
                  <span className="text-gray-400">Good</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/50"></div>
                  <span className="text-gray-400">Neutral</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50"></div>
                  <span className="text-gray-400">Bad</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Statistics View */
          <div className="space-y-8">
            {/* Overview */}
            <div className="glass rounded-2xl p-6 border border-dark-border">
              <h3 className="text-xl font-bold text-white mb-6">30-Day Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Logged Days</div>
                  <div className="text-3xl font-bold text-white">{stats?.stats?.totalLogs || 0}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Consistency</div>
                  <div className="text-3xl font-bold text-accent-blue">{stats?.stats?.consistency || 0}%</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Current Streak</div>
                  <div className="text-3xl font-bold text-accent-purple">{stats?.stats?.streaks?.current || 0} </div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-1">Longest Streak</div>
                  <div className="text-3xl font-bold text-accent-pink">{stats?.stats?.streaks?.longest || 0}</div>
                </div>
              </div>
            </div>

            {/* Mood Distribution */}
            <div className="glass rounded-2xl p-6 border border-dark-border">
              <h3 className="text-xl font-bold text-white mb-6">Mood Distribution</h3>
              <div className="space-y-4">
                {moods.map((mood) => {
                  const percentage = stats?.stats?.percentages?.[mood.value] || 0;
                  return (
                    <div key={mood.value}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm">{mood.label}</span>
                          <span className="text-white">{mood.label}</span>
                        </div>
                        <span className="text-gray-400">{percentage}%</span>
                      </div>
                      <div className="w-full h-2 bg-dark-card rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${mood.color} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Emotions & Activities */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Emotions */}
              <div className="glass rounded-2xl p-6 border border-dark-border">
                <h3 className="text-xl font-bold text-white mb-4">Top Emotions</h3>
                <div className="space-y-3">
                  {stats?.stats?.topEmotions?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-300">{item.emotion}</span>
                      <span className="text-accent-blue font-semibold">{item.count}x</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Activities */}
              <div className="glass rounded-2xl p-6 border border-dark-border">
                <h3 className="text-xl font-bold text-white mb-4">Top Activities</h3>
                <div className="space-y-3">
                  {stats?.stats?.topActivities?.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-300">{item.activity}</span>
                      <span className="text-accent-purple font-semibold">{item.count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Log Mood Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass rounded-3xl p-8 max-w-lg w-full border border-dark-border animate-slide-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Log Your Mood</h2>

            {/* Mood Selection */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-3">How are you feeling?</label>
              <div className="grid grid-cols-3 gap-4">
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
                    <div className="text-lg mb-2">{mood.label}</div>
                    <div className="text-white text-sm font-medium">{mood.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Emotions */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-3">What emotions? (optional)</label>
              <div className="flex flex-wrap gap-2">
                {emotions.map((emotion) => (
                  <button
                    key={emotion}
                    onClick={() => {
                      setMoodDetails(prev => ({
                        ...prev,
                        emotions: prev.emotions.includes(emotion)
                          ? prev.emotions.filter(e => e !== emotion)
                          : [...prev.emotions, emotion]
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      moodDetails.emotions.includes(emotion)
                        ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/50'
                        : 'bg-dark-card text-gray-400 border border-dark-border hover:border-accent-blue/50'
                    }`}
                  >
                    {emotion}
                  </button>
                ))}
              </div>
            </div>

            {/* Activities */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-3">What did you do? (optional)</label>
              <div className="flex flex-wrap gap-2">
                {activities.map((activity) => (
                  <button
                    key={activity}
                    onClick={() => {
                      setMoodDetails(prev => ({
                        ...prev,
                        activities: prev.activities.includes(activity)
                          ? prev.activities.filter(a => a !== activity)
                          : [...prev.activities, activity]
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      moodDetails.activities.includes(activity)
                        ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/50'
                        : 'bg-dark-card text-gray-400 border border-dark-border hover:border-accent-purple/50'
                    }`}
                  >
                    {activity}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-gray-300 text-sm font-medium mb-3">Notes (optional)</label>
              <textarea
                value={moodDetails.notes}
                onChange={(e) => setMoodDetails(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none resize-none"
                rows="3"
                placeholder="Any additional thoughts..."
              />
            </div>

            {/* Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => setShowLogModal(false)}
                className="flex-1 py-3 px-6 rounded-xl bg-dark-card text-gray-300 border border-dark-border hover:border-accent-blue transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogMood}
                disabled={!selectedMood}
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold disabled:opacity-50 transition-all"
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

export default MoodTracker;
