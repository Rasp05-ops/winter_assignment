import React, { useState, useEffect } from 'react';
import { circleAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

function Circles() {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const navigate = useNavigate();

  const categories = [
    { value: 'all', label: 'All', emoji: '🌟' },
    { value: 'anxiety', label: 'Anxiety', emoji: '😰' },
    { value: 'depression', label: 'Depression', emoji: '😔' },
    { value: 'stress', label: 'Stress', emoji: '😓' },
    { value: 'mindfulness', label: 'Mindfulness', emoji: '🧘' },
    { value: 'productivity', label: 'Productivity', emoji: '⚡' },
    { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  ];

  useEffect(() => {
    fetchCircles();
  }, [selectedCategory]);

  const fetchCircles = async () => {
    try {
      const params = selectedCategory !== 'all' ? { category: selectedCategory } : {};
      const response = await circleAPI.getAll(params);
      setCircles(response.data.circles || []);
    } catch (error) {
      console.error('Failed to fetch circles:', error);
    } finally {
      setLoading(false);
    }
  };

// Update this function to accept 'e' (the event)
const handleJoinCircle = async (e, circleId) => {
    e.stopPropagation(); // Prevents clicking the card background
    
    try {
      await circleAPI.join(circleId);
      
      // If successful:
      alert("Success! You have joined the circle.");
      fetchCircles(); // Refresh the list
    } catch (error) {
      console.error('Join error details:', error);
      
      // Get the specific message sent by the backend
      const serverMessage = error.response?.data?.message || error.response?.data?.error || "Unknown error";
      
      // Show it to the user
      alert(` ${serverMessage}`);
    }
  };  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* Header */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">
              ← Back
            </button>
            <h1 className="text-2xl font-bold gradient-text">Support Circles</h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-lg hover:scale-105 transition-all"
          >
            + Create Circle
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Filter */}
        <div className="flex space-x-2 mb-8 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                selectedCategory === cat.value
                  ? 'bg-gradient-to-r from-accent-blue to-accent-purple text-white'
                  : 'bg-dark-card text-gray-400 hover:text-white border border-dark-border'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>

        {/* Circles Grid */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading circles...</div>
        ) : circles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No circles found in this category</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-accent-blue hover:text-accent-purple"
            >
              Create the first one →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {circles.map((circle) => (
              <div
                key={circle.id}
                className="glass rounded-2xl p-6 border border-dark-border hover:border-accent-blue transition-all group cursor-pointer"
                onClick={() => navigate(`/circles/${circle.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-2xl">
                      {categories.find(c => c.value === circle.category)?.emoji || '🎯'}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold group-hover:text-accent-blue transition-colors">
                        {circle.name}
                      </h3>
                      <p className="text-gray-500 text-xs">{circle.memberCount} members</p>
                    </div>
                  </div>
                  {circle.isPrivate && (
                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded-lg">
                      🔒 Private
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {circle.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {circle.tags?.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-1 bg-accent-blue/10 text-accent-blue text-xs rounded-lg">
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Join Button */}
<button
  onClick={(e) => handleJoinCircle(e, circle._id || circle.id)} // <--- Pass 'e' here
  className={`w-full py-2 px-4 rounded-xl font-medium transition-all mt-auto ${
    circle.userMembership === 'active'
      ? 'bg-green-500/20 text-green-400 border border-green-500/50 cursor-default'
      : circle.userMembership === 'pending'
      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 cursor-default'
      : 'bg-accent-blue/10 text-accent-blue border border-accent-blue/50 hover:bg-accent-blue/20'
  }`}
  // Disable button if already joined or pending
  disabled={circle.userMembership === 'active' || circle.userMembership === 'pending'}
>
  {circle.userMembership === 'active'
    ? '✓ Joined'
    : circle.userMembership === 'pending'
    ? '⏳ Pending'
    : circle.isPrivate
    ? 'Request to Join'
    : 'Join Circle'}
</button>              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Circle Modal */}
      {showCreateModal && (
        <CreateCircleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchCircles();
          }}
        />
      )}
    </div>
  );
}

// Create Circle Modal Component
function CreateCircleModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'anxiety',
    tags: '',
    isPrivate: false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      await circleAPI.create(data);
      onSuccess();
    } catch (error) {
      console.error('Failed to create circle:', error);
      alert('Failed to create circle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-3xl p-8 max-w-lg w-full border border-dark-border animate-slide-up max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-white mb-6">Create New Circle</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Circle Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none"
              placeholder="e.g., Anxiety Support Group"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none resize-none"
              rows="3"
              placeholder="Describe your circle..."
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none"
            >
              <option value="anxiety">😰 Anxiety</option>
              <option value="depression">😔 Depression</option>
              <option value="stress">😓 Stress</option>
              <option value="mindfulness">🧘 Mindfulness</option>
              <option value="productivity">⚡ Productivity</option>
              <option value="relationships">❤️ Relationships</option>
              <option value="other">🌟 Other</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none"
              placeholder="support, therapy, coping"
            />
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
              className="w-5 h-5 rounded bg-dark-card border-dark-border"
            />
            <label className="text-gray-300 text-sm">Make this circle private (require approval to join)</label>
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-xl bg-dark-card text-gray-300 border border-dark-border hover:border-accent-blue transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-semibold disabled:opacity-50 transition-all"
            >
              {loading ? 'Creating...' : 'Create Circle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Circles;
