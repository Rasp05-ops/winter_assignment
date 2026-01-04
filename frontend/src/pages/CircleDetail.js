import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { circleAPI } from '../services/api';

function CircleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [circle, setCircle] = useState(null);
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCircleData();
  }, [id]);

  const fetchCircleData = async () => {
    try {
      const [circleRes, postsRes] = await Promise.all([
        circleAPI.getById(id),
        circleAPI.getPosts(id),
      ]);
      setCircle(circleRes.data.circle);
      setPosts(postsRes.data.posts || []);
    } catch (error) {
      console.error('Failed to fetch circle:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      await circleAPI.createPost(id, { content: newPost, type: 'text' });
      setNewPost('');
      fetchCircleData();
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-white">Loading...</div>;
  }

  if (!circle) {
    return <div className="min-h-screen bg-dark-bg flex items-center justify-center text-white">Circle not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      {/* Header */}
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button onClick={() => navigate('/circles')} className="text-gray-400 hover:text-white mb-4">
            ← Back to Circles
          </button>
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-3xl">
              {circle.category === 'anxiety' && '😰'}
              {circle.category === 'depression' && '😔'}
              {circle.category === 'stress' && '😓'}
              {circle.category === 'mindfulness' && '🧘'}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{circle.name}</h1>
              <p className="text-gray-400 mb-3">{circle.description}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>👥 {circle.memberCount} members</span>
                <span>📍 {circle.category}</span>
                {circle.isPrivate && <span>🔒 Private</span>}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Create Post */}
        {circle.userMembership === 'active' && (
          <div className="glass rounded-2xl p-6 border border-dark-border mb-6">
            <form onSubmit={handleCreatePost}>
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="w-full px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white focus:border-accent-blue outline-none resize-none"
                rows="3"
                placeholder="Share your thoughts with the circle..."
              />
              <button
                type="submit"
                className="mt-3 px-6 py-2 bg-gradient-to-r from-accent-blue to-accent-purple text-white rounded-lg hover:scale-105 transition-all"
              >
                Post
              </button>
            </form>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              No posts yet. Be the first to share!
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="glass rounded-2xl p-6 border border-dark-border">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold">
                    {post.author.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-white font-semibold">{post.author.displayName || post.author.username}</span>
                      <span className="text-gray-500 text-sm">•</span>
                      <span className="text-gray-500 text-sm">{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-gray-300">{post.content}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <button className="hover:text-accent-blue transition-colors">
                    💬 {post.commentCount} comments
                  </button>
                  <button className="hover:text-accent-blue transition-colors">
                    ❤️ {post.likeCount} likes
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default CircleDetail;
