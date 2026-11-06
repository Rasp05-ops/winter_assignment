const Circle = require('../models/Circle');
const CircleMember = require('../models/CircleMember');
const CirclePost = require('../models/CirclePost');
const PostComment = require('../models/PostComment');
const User = require('../models/User');
const { Op } = require('sequelize');
const { createNotification } = require('./notificationController');

/* =========================================
   HELPER FUNCTIONS
   ========================================= */

// Check if user is Admin or Moderator
const isAdmin = async (userId, circleId) => {
  const member = await CircleMember.findOne({
    where: { 
      userId, 
      circleId, 
      role: { [Op.in]: ['admin', 'moderator'] },
      status: 'active'
    }
  });
  return !!member;
};

// Check if user is a Member
const isMember = async (userId, circleId) => {
  const member = await CircleMember.findOne({
    where: { userId, circleId, status: 'active' }
  });
  return !!member;
};

/* =========================================
   CIRCLE MANAGEMENT
   ========================================= */

exports.createCircle = async (req, res) => {
  try {
    const { name, description, category, tags, isPrivate } = req.body;

    // 1. Create the Circle
    const circle = await Circle.create({
      name,
      description,
      category,
      tags: tags || [],
      isPrivate: isPrivate || false,
      createdBy: req.userId, // <--- FIXED: Must match your database column name!
      memberCount: 1
    });

    // 2. Make the Creator an ADMIN automatically
    await CircleMember.create({
      userId: req.userId,
      circleId: circle.id,
      role: 'admin',
      status: 'active'
    });

    res.status(201).json({ success: true, message: 'Circle created', circle });
  } catch (error) {
    console.error('Create circle error:', error); // Check your terminal for "column does not exist"
    res.status(500).json({ error: 'Failed to create circle' });
  }
};
exports.getAllCircles = async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    let where = {};

    if (category && category !== 'All') where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search.toLowerCase()] } }
      ];
    }

    const circles = await Circle.findAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['username', 'profilePicture'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['memberCount', 'DESC']]
    });

    res.json({ success: true, circles });
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ error: 'Failed to fetch circles' });
  }
};

exports.getCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const circle = await Circle.findByPk(circleId, {
      include: [{ model: User, as: 'creator', attributes: ['username', 'profilePicture'] }]
    });

    if (!circle) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    const membership = await CircleMember.findOne({
      where: { userId: req.userId, circleId }
    });

    res.json({
      success: true,
      circle: {
        ...circle.toJSON(),
        userMembership: membership ? membership.status : 'not_member',
        userRole: membership?.role || null
      }
    });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ error: 'Failed to fetch circle' });
  }
};
exports.getMyCircles = async (req, res) => {
  try {
    const memberships = await CircleMember.findAll({
      where: { userId: req.userId, status: 'active' },
      include: [{ model: Circle, as: 'circle' }]
    });

    // Extract just the circle data
    const circles = memberships.map(m => m.circle);
    
    res.json({ success: true, circles });
  } catch (error) {
    console.error('Get my circles error:', error);
    res.status(500).json({ error: 'Failed to fetch your circles' });
  }
};

exports.updateCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { name, description, category, tags, isPrivate } = req.body;

    // ADMIN CHECK
    if (!await isAdmin(req.userId, circleId)) {
      return res.status(403).json({ error: 'Admin only' });
    }

    const circle = await Circle.findByPk(circleId);
    if (!circle) return res.status(404).json({ error: 'Circle not found' });

    if (name) circle.name = name;
    if (description !== undefined) circle.description = description;
    if (category) circle.category = category;
    if (tags) circle.tags = tags;
    if (isPrivate !== undefined) circle.isPrivate = isPrivate;

    await circle.save();
    res.json({ success: true, message: 'Circle updated', circle });
  } catch (error) {
    console.error('Update circle error:', error);
    res.status(500).json({ error: 'Failed to update circle' });
  }
};

/* =========================================
   MEMBERSHIP & ADMIN ACTIONS
   ========================================= */

exports.joinCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    
    const circle = await Circle.findByPk(circleId);
    if (!circle) return res.status(404).json({ error: 'Circle not found' });

    const existing = await CircleMember.findOne({
      where: { userId: req.userId, circleId }
    });

    if (existing && existing.status === 'active') {
      return res.status(400).json({ error: 'Already a member' });
    }
    if (existing && existing.status === 'pending') {
      return res.status(400).json({ error: 'Request already pending' });
    }

    // Private circles require approval
    const status = circle.isPrivate ? 'pending' : 'active';

    if (existing) {
      existing.status = status;
      existing.joinedAt = new Date();
      await existing.save();
    } else {
      await CircleMember.create({
        userId: req.userId,
        circleId,
        status,
        role: 'member'
      });
    }

    if (!circle.isPrivate) {
      await circle.increment('memberCount');
    }

    res.json({
      success: true,
      message: circle.isPrivate ? 'Join request sent' : 'Joined successfully',
      status
    });
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ error: 'Failed to join circle' });
  }
};

exports.leaveCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    
    const membership = await CircleMember.findOne({
      where: { userId: req.userId, circleId, status: 'active' }
    });

    if (!membership) return res.status(400).json({ error: 'Not a member' });

    // Prevent the last admin from leaving without promoting someone else
    if (membership.role === 'admin') {
      const adminCount = await CircleMember.count({
        where: { circleId, role: 'admin', status: 'active' }
      });
      if (adminCount === 1) {
        return res.status(400).json({ error: 'Cannot leave. Promote another admin first.' });
      }
    }

    await membership.destroy(); // Completely remove record or set to 'left' depending on preference
    await Circle.decrement('memberCount', { where: { id: circleId } });

    res.json({ success: true, message: 'Left circle' });
  } catch (error) {
    console.error('Leave circle error:', error);
    res.status(500).json({ error: 'Failed to leave circle' });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const { circleId } = req.params;
    if (!await isMember(req.userId, circleId)) return res.status(403).json({ error: 'Members only' });

    const members = await CircleMember.findAll({
      where: { circleId, status: 'active' },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'displayName', 'profilePicture'] }],
      order: [['role', 'ASC'], ['joinedAt', 'ASC']] // Admins first
    });

    res.json({ success: true, members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { circleId, memberId } = req.params;

    // ADMIN CHECK
    if (!await isAdmin(req.userId, circleId)) return res.status(403).json({ error: 'Admin only' });

    const membership = await CircleMember.findOne({
      where: { userId: memberId, circleId, status: 'active' }
    });

    if (!membership) return res.status(404).json({ error: 'Member not found' });

    // Protect other admins
    if (membership.role === 'admin' && memberId !== req.userId) {
      return res.status(400).json({ error: 'Cannot remove another admin' });
    }

    await membership.destroy();
    await Circle.decrement('memberCount', { where: { id: circleId } });

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

exports.promoteMember = async (req, res) => {
  try {
    const { circleId, memberId } = req.params;
    // const { role } = req.body; // Expecting 'admin' or 'moderator'
    // Defaulting to admin for simple promotion logic, or use body
    const role = 'admin';

    // ADMIN CHECK
    if (!await isAdmin(req.userId, circleId)) return res.status(403).json({ error: 'Admin only' });

    const membership = await CircleMember.findOne({
      where: { userId: memberId, circleId, status: 'active' }
    });

    if (!membership) return res.status(404).json({ error: 'Member not found' });

    membership.role = role;
    await membership.save();

    res.json({ success: true, message: `Promoted to ${role}` });
  } catch (error) {
    console.error('Promote error:', error);
    res.status(500).json({ error: 'Failed to promote member' });
  }
};

/* =========================================
   JOIN REQUESTS (ADMIN ONLY)
   ========================================= */

exports.getJoinRequests = async (req, res) => {
  try {
    const { circleId } = req.params;
    if (!await isAdmin(req.userId, circleId)) return res.status(403).json({ error: 'Admin only' });

    const requests = await CircleMember.findAll({
      where: { circleId, status: 'pending' },
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'displayName', 'profilePicture'] }]
    });

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { circleId, membershipId } = req.params;
    if (!await isAdmin(req.userId, circleId)) return res.status(403).json({ error: 'Admin only' });

    const membership = await CircleMember.findByPk(membershipId);
    if (!membership) return res.status(404).json({ error: 'Request not found' });

    membership.status = 'active';
    membership.joinedAt = new Date();
    await membership.save();
    
    await Circle.increment('memberCount', { where: { id: circleId } });

    res.json({ success: true, message: 'Request approved' });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { circleId, membershipId } = req.params;
    if (!await isAdmin(req.userId, circleId)) return res.status(403).json({ error: 'Admin only' });

    const membership = await CircleMember.findByPk(membershipId);
    if (!membership) return res.status(404).json({ error: 'Request not found' });

    await membership.destroy(); // Simply remove the request
    res.json({ success: true, message: 'Request rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
};

/* =========================================
   POSTS
   ========================================= */

exports.getPosts = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    if (!await isMember(req.userId, circleId)) return res.status(403).json({ error: 'Members only' });

    const posts = await CirclePost.findAll({
      where: { circleId },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'profilePicture'] }],
      order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ success: true, posts });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

exports.createPost = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { content, type = 'text' } = req.body;

    if (!await isMember(req.userId, circleId)) return res.status(403).json({ error: 'Members only' });

    const post = await CirclePost.create({
      circleId,
      userId: req.userId,
      content,
      type
    });

    const fullPost = await CirclePost.findByPk(post.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'profilePicture'] }]
    });

    res.status(201).json({ success: true, message: 'Post created', post: fullPost });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await CirclePost.findByPk(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (post.userId !== req.userId) return res.status(403).json({ error: 'Can only edit your own posts' });

    post.content = content;
    await post.save();

    res.json({ success: true, message: 'Post updated', post });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await CirclePost.findByPk(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    // Allow owner OR admin to delete
    const canDelete = post.userId === req.userId || await isAdmin(req.userId, post.circleId);
    
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this post' });

    await post.destroy();
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

/* =========================================
   COMMENTS
   ========================================= */

exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const post = await CirclePost.findByPk(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!await isMember(req.userId, post.circleId)) return res.status(403).json({ error: 'Members only' });

    const comments = await PostComment.findAll({
      where: { postId },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'profilePicture'] }],
      order: [['createdAt', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({ success: true, comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

exports.createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    const post = await CirclePost.findByPk(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    if (!await isMember(req.userId, post.circleId)) return res.status(403).json({ error: 'Members only' });

    const comment = await PostComment.create({ 
      postId, 
      userId: req.userId, 
      content 
    });
    
    await post.increment('commentCount');

    const fullComment = await PostComment.findByPk(comment.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'displayName', 'profilePicture'] }]
    });

    // ===== NOTIFICATION LOGIC =====
    if (post.userId !== req.userId) {
      const commenter = await User.findByPk(req.userId);
      await createNotification({
        userId: post.userId,
        type: 'comment',
        title: 'New comment',
        message: `${commenter.displayName || commenter.username} commented on your post`,
        actionUrl: `/circles/${post.circleId}/posts/${postId}`,
        relatedUserId: req.userId,
        relatedItemId: comment.id,
        relatedItemType: 'comment'
      });
    }

    res.status(201).json({ success: true, message: 'Comment added', comment: fullComment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await PostComment.findByPk(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.userId !== req.userId) return res.status(403).json({ error: 'Can only edit your own comments' });

    comment.content = content;
    await comment.save();

    res.json({ success: true, message: 'Comment updated', comment });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await PostComment.findByPk(commentId, {
      include: [{ model: CirclePost, as: 'post' }]
    });

    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Allow owner OR admin to delete
    const canDelete = comment.userId === req.userId || await isAdmin(req.userId, comment.post.circleId);
    
    if (!canDelete) return res.status(403).json({ error: 'Cannot delete this comment' });

    await comment.destroy();
    await CirclePost.decrement('commentCount', { where: { id: comment.postId } });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};