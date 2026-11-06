import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { circleAPI, journalAPI } from '../services/api'; // Added journalAPI import

function CircleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // --- VIEW STATE (Tabs) ---
  const [activeTab, setActiveTab] = useState('discussions'); // 'discussions' or 'journals'

  // --- DATA STATE ---
  const [circle, setCircle] = useState(null);
  const [posts, setPosts] = useState([]);
  const [journals, setJournals] = useState([]); // Shared Journals
  const [loading, setLoading] = useState(true);

  // Post Creation
  const [newPost, setNewPost] = useState('');

  // Admin Panel State
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [editingCircle, setEditingCircle] = useState(false);
  const [editCircleData, setEditCircleData] = useState({ name: '', description: '' });

  // Comment System State
  const [activePostId, setActivePostId] = useState(null);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Edit State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  useEffect(() => {
    fetchCircleData();
  }, [id]);

  // Fetch Journals when tab changes to 'journals'
  useEffect(() => {
    if (activeTab === 'journals' && journals.length === 0) {
      fetchSharedJournals();
    }
  }, [activeTab]);

  const fetchCircleData = async () => {
    try {
      const [circleRes, postsRes] = await Promise.all([
        circleAPI.getById(id),
        circleAPI.getPosts(id),
      ]);
      setCircle(circleRes.data.circle);
      setPosts(postsRes.data.posts || []);
      setEditCircleData({
        name: circleRes.data.circle.name,
        description: circleRes.data.circle.description
      });
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedJournals = async () => {
    try {
      const res = await journalAPI.getByCircle(id);
      setJournals(res.data.journals || []);
    } catch (error) {
      console.error("Failed to fetch journals", error);
    }
  };

  // --- POST ACTIONS ---
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    try {
      await circleAPI.createPost(id, { content: newPost });
      setNewPost('');
      fetchCircleData(); 
    } catch (error) {
      alert('Failed to post');
    }
  };

  const startEditingPost = (post) => {
    setEditingPostId(post.id || post._id);
    setEditPostContent(post.content);
  };

  const saveEditedPost = async () => {
    try {
      await circleAPI.updatePost(editingPostId, editPostContent);
      setPosts(posts.map(p => (p.id || p._id) === editingPostId ? { ...p, content: editPostContent } : p));
      setEditingPostId(null);
    } catch (error) {
      alert("Failed to update post");
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await circleAPI.deletePost(postId);
      setPosts(posts.filter(p => (p.id || p._id) !== postId));
    } catch (error) {
      alert("Failed to delete post");
    }
  };

  // --- COMMENT ACTIONS ---
  const toggleComments = async (postId) => {
    if (activePostId === postId) {
      setActivePostId(null);
      return;
    }
    setActivePostId(postId);
    if (!comments[postId]) {
      setLoadingComments(true);
      try {
        const res = await circleAPI.getComments(postId);
        setComments(prev => ({ ...prev, [postId]: res.data.comments || res.data }));
      } catch (error) {
        console.error("Failed to load comments", error);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const res = await circleAPI.createComment(postId, commentText);
      const newComment = res.data.comment || res.data;
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), newComment] }));
      setPosts(posts.map(p => (p.id || p._id) === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p));
      setCommentText('');
    } catch (error) {
      alert("Failed to add comment");
    }
  };

  const startEditingComment = (comment) => {
    setEditingCommentId(comment.id || comment._id);
    setEditCommentContent(comment.content);
  };

  const saveEditedComment = async (postId) => {
    try {
      await circleAPI.updateComment(editingCommentId, editCommentContent);
      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].map(c => (c.id || c._id) === editingCommentId ? { ...c, content: editCommentContent } : c)
      }));
      setEditingCommentId(null);
    } catch (error) {
      alert("Failed to update comment");
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await circleAPI.deleteComment(commentId);
      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].filter(c => (c.id || c._id) !== commentId)
      }));
      setPosts(posts.map(p => (p.id || p._id) === postId ? { ...p, commentCount: Math.max(0, (p.commentCount || 0) - 1) } : p));
    } catch (error) {
      alert("Failed to delete comment");
    }
  };

  // --- ADMIN ACTIONS ---
  const handleAdminToggle = () => {
    const newState = !showAdminPanel;
    setShowAdminPanel(newState);
    if (newState) fetchAdminData();
  };

  const fetchAdminData = async () => {
    try {
      const [reqRes, memRes] = await Promise.all([
        circleAPI.getJoinRequests(id),
        circleAPI.getMembers(id)
      ]);
      setJoinRequests(reqRes.data.requests || []);
      setMembers(memRes.data.members || []);
    } catch (error) {
      console.error("Admin data error", error);
    }
  };

  const handleUpdateCircle = async (e) => {
    e.preventDefault();
    try {
      await circleAPI.updateCircle(id, editCircleData);
      setEditingCircle(false);
      fetchCircleData();
      alert("Circle updated!");
    } catch (error) {
      alert("Update failed");
    }
  };

  const adminActions = {
    approve: async (mid) => { await circleAPI.approveRequest(id, mid); fetchAdminData(); },
    reject: async (mid) => { await circleAPI.rejectRequest(id, mid); fetchAdminData(); },
    remove: async (uid) => { if(window.confirm("Remove user?")) { await circleAPI.removeMember(id, uid); fetchAdminData(); } },
    promote: async (uid) => { if(window.confirm("Promote to Admin?")) { await circleAPI.promoteMember(id, uid); fetchAdminData(); } }
  };

  if (loading) return <div className="text-white text-center p-10">Loading...</div>;
  if (!circle) return <div className="text-white text-center p-10">Circle not found</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg pb-20">
      
      {/* HEADER */}
      <header className="border-b border-dark-border bg-dark-card/50 sticky top-0 z-20 backdrop-blur-md p-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => navigate('/circles')} className="text-gray-400 hover:text-white">← Back</button>
            <h1 className="text-xl font-bold text-white">{circle.name}</h1>
          </div>
          
          <div className="flex gap-4">
            {/* TABS */}
            <div className="flex bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('discussions')}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'discussions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                💬 Discussions
              </button>
              <button 
                onClick={() => setActiveTab('journals')}
                className={`px-4 py-1.5 rounded-md text-sm transition-all ${activeTab === 'journals' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                📖 Shared Journals
              </button>
            </div>

            {circle.userRole === 'admin' && (
              <button 
                onClick={handleAdminToggle}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${showAdminPanel ? 'bg-purple-600 text-white' : 'bg-slate-800 text-purple-400 border border-purple-500/30'}`}
              >
                {showAdminPanel ? 'Close Admin' : '⚙️'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">

        {/* === ADMIN DASHBOARD === */}
        {showAdminPanel && circle.userRole === 'admin' && (
          <div className="mb-8 bg-slate-800/80 p-6 rounded-xl border border-purple-500/30 animate-in slide-in-from-top-4">
             {/* Edit Circle */}
             <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <h3 className="font-bold text-white">✏️ Settings</h3>
                  <button onClick={() => setEditingCircle(!editingCircle)} className="text-sm text-blue-400">{editingCircle ? 'Cancel' : 'Edit'}</button>
                </div>
                {editingCircle && (
                  <form onSubmit={handleUpdateCircle} className="space-y-3">
                    <input value={editCircleData.name} onChange={e => setEditCircleData({...editCircleData, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" />
                    <textarea value={editCircleData.description} onChange={e => setEditCircleData({...editCircleData, description: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white" rows="2" />
                    <button className="bg-purple-600 px-4 py-1 rounded text-white text-sm">Save</button>
                  </form>
                )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {/* Requests */}
               {circle.isPrivate && (
                 <div>
                   <h3 className="font-bold text-white mb-2">📩 Requests ({joinRequests.length})</h3>
                   <div className="max-h-40 overflow-y-auto bg-slate-900 p-2 rounded">
                     {joinRequests.map(req => (
                       <div key={req.id} className="flex justify-between items-center mb-2">
                         <span className="text-white text-sm">{req.user?.username}</span>
                         <div className="flex gap-1">
                           <button onClick={() => adminActions.approve(req.id)} className="text-green-400 bg-green-900/30 px-2 py-0.5 rounded text-xs">✓</button>
                           <button onClick={() => adminActions.reject(req.id)} className="text-red-400 bg-red-900/30 px-2 py-0.5 rounded text-xs">✗</button>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               {/* Members */}
               <div>
                 <h3 className="font-bold text-white mb-2">👥 Members</h3>
                 <div className="max-h-40 overflow-y-auto bg-slate-900 p-2 rounded">
                    {members.map(m => (
                      <div key={m.id} className="flex justify-between items-center mb-2">
                        <span className="text-white text-sm">{m.user?.username} {m.role==='admin' && '👑'}</span>
                        {m.user?.id !== currentUser.id && (
                          <div className="flex gap-1">
                             {m.role !== 'admin' && <button onClick={() => adminActions.promote(m.user.id)} className="text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs">Promote</button>}
                             <button onClick={() => adminActions.remove(m.user.id)} className="text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs">Remove</button>
                          </div>
                        )}
                      </div>
                    ))}
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* === CONTENT AREA === */}
        {circle.userMembership !== 'active' ? (
          <div className="text-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700">
             <h2 className="text-2xl font-bold text-white mb-2">Join to see content</h2>
             <p className="text-gray-400">{circle.userMembership === 'pending' ? 'Request Pending' : 'Join this circle to participate.'}</p>
          </div>
        ) : (
          <>
            {/* === TAB 1: DISCUSSIONS === */}
            {activeTab === 'discussions' && (
              <div className="animate-in fade-in">
                {/* Create Post */}
                <div className="glass rounded-2xl p-6 border border-dark-border mb-6">
                  <form onSubmit={handleCreatePost}>
                    <textarea 
                      value={newPost} 
                      onChange={e => setNewPost(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none resize-none" 
                      placeholder="Share with the circle..." 
                      rows="2" 
                    />
                    <div className="flex justify-end mt-2">
                       <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm transition-colors">Post</button>
                    </div>
                  </form>
                </div>

                {/* Posts Feed */}
                <div className="space-y-6">
                  {posts.map(post => {
                    const postId = post.id || post._id;
                    const isMyPost = post.author?.id === currentUser.id || post.author?._id === currentUser.id;
                    const isEditing = editingPostId === postId;

                    return (
                      <div key={postId} className="glass rounded-xl p-6 border border-dark-border relative group">
                        {/* Post Header */}
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                              {post.author?.profilePicture ? <img src={`http://localhost:3001/uploads/profile-pictures/${post.author.profilePicture}`} className="w-full h-full object-cover" alt=""/> : <span className="text-white">👤</span>}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{post.author?.displayName || post.author?.username}</h3>
                              <p className="text-xs text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          {(isMyPost || circle.userRole === 'admin') && !isEditing && (
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isMyPost && <button onClick={() => startEditingPost(post)} className="text-blue-400 hover:bg-blue-500/10 p-1 rounded">✏️</button>}
                              <button onClick={() => handleDeletePost(postId)} className="text-red-400 hover:bg-red-500/10 p-1 rounded">🗑️</button>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        {isEditing ? (
                          <div className="mb-4">
                            <textarea value={editPostContent} onChange={e => setEditPostContent(e.target.value)} className="w-full bg-slate-800 text-white p-2 rounded border border-slate-600" rows="3"/>
                            <div className="flex gap-2 mt-2">
                              <button onClick={saveEditedPost} className="text-xs bg-green-600 text-white px-3 py-1 rounded">Save</button>
                              <button onClick={() => setEditingPostId(null)} className="text-xs bg-gray-600 text-white px-3 py-1 rounded">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-300 whitespace-pre-wrap mb-4">{post.content}</p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-4 pt-4 border-t border-slate-700/50">
                          <button onClick={() => toggleComments(postId)} className={`flex items-center gap-2 text-sm transition-colors ${activePostId === postId ? 'text-blue-400' : 'text-slate-400 hover:text-blue-400'}`}>
                            <span>💬</span> <span>{post.commentCount || 0} Comments</span>
                          </button>
                        </div>

                        {/* Comments */}
                        {activePostId === postId && (
                          <div className="mt-4 bg-slate-800/30 rounded-lg p-4 animate-in fade-in">
                            <div className="space-y-4 mb-4 max-h-60 overflow-y-auto custom-scrollbar">
                              {loadingComments ? <p className="text-xs text-center text-gray-500">Loading...</p> : 
                               comments[postId]?.map(comment => {
                                 const commentId = comment.id || comment._id;
                                 const isMyComment = comment.user?.id === currentUser.id || comment.user?._id === currentUser.id;
                                 const isEditingComment = editingCommentId === commentId;

                                 return (
                                   <div key={commentId} className="flex gap-3 group/comment">
                                     <div className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 overflow-hidden">
                                        {comment.user?.profilePicture ? <img src={`http://localhost:3001/uploads/profile-pictures/${comment.user.profilePicture}`} className="w-full h-full object-cover" alt=""/> : <span className="text-xs flex h-full items-center justify-center">👤</span>}
                                     </div>
                                     <div className="flex-1 bg-slate-700/50 rounded-lg p-3">
                                       <div className="flex justify-between items-start">
                                         <span className="text-xs font-bold text-slate-200">{comment.user?.username}</span>
                                         {(isMyComment || circle.userRole === 'admin') && !isEditingComment && (
                                           <div className="flex gap-2 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                             {isMyComment && <button onClick={() => startEditingComment(comment)} className="text-[10px] text-blue-400 hover:underline">Edit</button>}
                                             <button onClick={() => handleDeleteComment(postId, commentId)} className="text-[10px] text-red-400 hover:underline">Delete</button>
                                           </div>
                                         )}
                                       </div>
                                       {isEditingComment ? (
                                         <div className="mt-1">
                                           <input value={editCommentContent} onChange={e => setEditCommentContent(e.target.value)} className="w-full bg-slate-900 text-white text-sm p-1 rounded border border-slate-600"/>
                                           <div className="flex gap-2 mt-1">
                                             <button onClick={() => saveEditedComment(postId)} className="text-[10px] text-green-400">Save</button>
                                             <button onClick={() => setEditingCommentId(null)} className="text-[10px] text-gray-400">Cancel</button>
                                           </div>
                                         </div>
                                       ) : (
                                         <p className="text-sm text-slate-300 mt-1">{comment.content}</p>
                                       )}
                                     </div>
                                   </div>
                                 );
                               })}
                            </div>
                            <div className="flex gap-2">
                              <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(postId)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="Write a comment..."/>
                              <button onClick={() => handleAddComment(postId)} className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg">Send</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* === TAB 2: SHARED JOURNALS === */}
            {activeTab === 'journals' && (
              <div className="animate-in fade-in space-y-4">
                {journals.length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <p>No journals have been shared with this circle yet.</p>
                    <p className="text-sm mt-2">Go to <a href="/journal" className="text-purple-400 hover:underline">My Journal</a> to write and share one!</p>
                  </div>
                ) : (
                  journals.map(journal => (
                    <div key={journal.id} className="glass p-6 rounded-xl border border-dark-border hover:border-purple-500/50 transition-colors">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center overflow-hidden">
                            {journal.user?.profilePicture ? (
                               <img src={`http://localhost:3001/uploads/profile-pictures/${journal.user.profilePicture}`} className="w-full h-full object-cover" alt="" />
                            ) : <span>📖</span>}
                         </div>
                         <div>
                            <h3 className="font-bold text-white text-lg">{journal.title}</h3>
                            <p className="text-xs text-gray-400">by @{journal.user?.username || 'Member'} • {new Date(journal.createdAt).toLocaleDateString()}</p>
                         </div>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap line-clamp-6">{journal.body}</p>
                      {journal.tags && journal.tags.length > 0 && (
                        <div className="mt-4 flex gap-2">
                          {journal.tags.map((tag, i) => (
                            <span key={i} className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default CircleDetail;