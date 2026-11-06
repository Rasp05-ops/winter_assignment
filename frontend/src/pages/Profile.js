import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../services/api'; // Ensure you import the new API object

function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState({
    username: '',
    email: '',
    displayName: '',
    bio: '',
    interests: [],
    profilePicture: ''
  });

  // Form state for editing
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    tags: '' // We handle tags as a comma-separated string in the UI
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await userAPI.getProfile();
      const userData = res.data.user;
      
      setUser(userData);
      setFormData({
        displayName: userData.displayName || '',
        bio: userData.bio || '',
        tags: userData.interests ? userData.interests.join(', ') : ''
      });
    } catch (error) {
      console.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // --- Image Upload Logic ---
  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Upload to backend
      const res = await userAPI.uploadAvatar(file);
      
      // 2. Update local state with new URL
      // Assuming backend returns { url: '/uploads/...' }
      setUser(prev => ({ ...prev, profilePicture: res.data.url || res.data.profilePicture }));
      
      // Optional: Force a page reload or context update if the header image doesn't update automatically
      window.location.reload(); 
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if(!window.confirm("Remove profile picture?")) return;
    try {
      await userAPI.deleteAvatar();
      fetchProfile(); // Reload to show default
      window.location.reload();
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  // --- Text Update Logic ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      // Convert comma string back to array
      const interestsArray = formData.tags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      await userAPI.updateProfile({
        displayName: formData.displayName,
        bio: formData.bio,
        interests: interestsArray
      });
      alert('Profile updated successfully!');
      fetchProfile();
    } catch (error) {
      console.error('Update failed', error);
    }
  };

  // Helper to construct image URL (Adjust based on how your backend serves statics)
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    // Assuming your server runs on localhost:3001 and serves uploads statically
    return `http://localhost:3001/uploads/profile-pictures/${path}`; 
  };

  if (loading) return <div className="text-white text-center py-20">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-slate-900 to-dark-bg">
      <header className="border-b border-dark-border backdrop-blur-lg bg-dark-card/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center space-x-4">
          <button onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white">← Back</button>
          <h1 className="text-2xl font-bold text-white">Edit Profile</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="glass rounded-3xl p-8 border border-dark-border">
          
          {/* --- Avatar Section --- */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={handleImageClick}>
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-dark-card shadow-xl">
                 {/* Display Image or Placeholder */}
                {user.profilePicture && user.profilePicture !== 'default-avatar.png' ? (
                   // If backend sends just filename, you might need to prepend backend URL
                   // If backend sends full URL, use it directly
                   <img 
                     src={user.profilePicture.includes('/') ? `http://localhost:3001${user.url || user.profilePicture}` : `http://localhost:3001/uploads/profile-pictures/${user.profilePicture}`} 
                     alt="Profile" 
                     className="w-full h-full object-cover" 
                     onError={(e) => {e.target.src='https://via.placeholder.com/150'}}
                   />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-4xl">
                    {user.displayName?.[0] || user.username?.[0] || ''}
                  </div>
                )}
              </div>
              
              {/* Overlay on Hover */}
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-sm font-medium"> Change</span>
              </div>
            </div>
            
            {uploading && <p className="text-accent-blue mt-2 text-sm">Uploading...</p>}
            
            {user.profilePicture && user.profilePicture !== 'default-avatar.png' && (
              <button onClick={handleDeleteAvatar} className="text-red-400 text-sm mt-2 hover:underline">
                Remove Picture
              </button>
            )}

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
          </div>

          {/* --- Details Form --- */}
          <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg mx-auto">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Display Name</label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:border-accent-blue outline-none"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Bio</label>
              <textarea
                rows="3"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:border-accent-blue outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">Interests (comma separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
                placeholder="e.g. music, coding, hiking"
                className="w-full bg-dark-bg border border-dark-border rounded-xl px-4 py-3 text-white focus:border-accent-blue outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-blue to-accent-purple text-white font-bold shadow-lg hover:opacity-90 transition-all"
            >
              Save Changes
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}

export default Profile;