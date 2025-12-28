const Circle = require('../models/Circle');
const CircleMember = require('../models/CircleMember');
const CirclePost = require('../models/CirclePost');
const PostComment = require('../models/PostComment');
const User = require('../models/User');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// ========== CIRCLE MANAGEMENT ==========

// Get all circles (public + user's circles)
exports.getAllCircles = async (req, res) => {
  try {
    const userId = req.userId;
    const { category, search, visibility } = req.query;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    let whereClause = {};

    // Filter by category
    if (category) {
      whereClause.category = category;
    }

    // Filter by visibility
    if (visibility === 'public') {
      whereClause.isPrivate = false;
    } else if (visibility === 'private') {
      whereClause.isPrivate = true;
    }

    // Search by name or tags
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { tags: { [Op.contains]: [search.toLowerCase()] } }
      ];
    }

    const circles = await Circle.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'profilePicture']
        }
      ],
      limit: limit + 1,
      offset,
      order: [['memberCount', 'DESC'], ['createdAt', 'DESC']]
    });

    const hasMore = circles.length > limit;
    const circleList = hasMore ? circles.slice(0, -1) : circles;

    // Check membership status for each circle
    const circlesWithStatus = await Promise.all(
      circleList.map(async (circle) => {
        const membership = await CircleMember.findOne({
          where: { userId, circleId: circle.id }
        });

        return {
          id: circle.id,
          name: circle.name,
          description: circle.description,
          category: circle.category,
          tags: circle.tags,
          memberCount: circle.memberCount,
          isPrivate: circle.isPrivate,
          coverImage: circle.coverImage,
          creator: circle.creator,
          membershipStatus: membership ? membership.status : 'not_member',
          userRole: membership ? membership.role : null
        };
      })
    );

    res.json({
      success: true,
      circles: circlesWithStatus,
      hasMore
    });
  } catch (error) {
    console.error('Get circles error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch circles' 
    });
  }
};

// Get single circle details
exports.getCircleById = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;

    const circle = await Circle.findByPk(circleId, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'displayName', 'profilePicture']
        }
      ]
    });

    if (!circle) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Circle not found' 
      });
    }

    // Check user's membership
    const membership = await CircleMember.findOne({
      where: { userId, circleId }
    });

    // If private and not a member, don't show full details
    if (circle.isPrivate && (!membership || membership.status !== 'active')) {
      return res.json({
        success: true,
        circle: {
          id: circle.id,
          name: circle.name,
          description: circle.description,
          category: circle.category,
          tags: circle.tags,
          memberCount: circle.memberCount,
          isPrivate: true,
          coverImage: circle.coverImage,
          membershipStatus: membership ? membership.status : 'not_member',
          creator: circle.creator
        }
      });
    }

    res.json({
      success: true,
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        category: circle.category,
        tags: circle.tags,
        memberCount: circle.memberCount,
        isPrivate: circle.isPrivate,
        coverImage: circle.coverImage,
        createdAt: circle.createdAt,
        creator: circle.creator,
        membershipStatus: membership ? membership.status : 'not_member',
        userRole: membership ? membership.role : null
      }
    });
  } catch (error) {
    console.error('Get circle error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch circle details' 
    });
  }
};

// Create new circle
exports.createCircle = async (req, res) => {
  try {
    const { name, description, category, tags, isPrivate } = req.body;
    const userId = req.userId;

    const circle = await Circle.create({
      name,
      description,
      category,
      tags: tags || [],
      isPrivate: isPrivate || false,
      createdBy: userId,
      memberCount: 1
    });

    // Creator automatically becomes admin member
    await CircleMember.create({
      userId,
      circleId: circle.id,
      role: 'admin',
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Circle created successfully',
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        category: circle.category,
        tags: circle.tags,
        isPrivate: circle.isPrivate,
        coverImage: circle.coverImage,
        memberCount: circle.memberCount
      }
    });
  } catch (error) {
    console.error('Create circle error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to create circle' 
    });
  }
};

// Join circle (public instantly, private sends request)
exports.joinCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;

    const circle = await Circle.findByPk(circleId);

    if (!circle) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Circle not found' 
      });
    }

    // Check if already a member
    const existingMembership = await CircleMember.findOne({
      where: { userId, circleId }
    });

    if (existingMembership) {
      if (existingMembership.status === 'active') {
        return res.status(400).json({ 
          error: 'Already member',
          message: 'You are already a member of this circle' 
        });
      } else if (existingMembership.status === 'pending') {
        return res.status(400).json({ 
          error: 'Request pending',
          message: 'Your join request is pending approval' 
        });
      } else if (existingMembership.status === 'left') {
        // Rejoin - update status
        existingMembership.status = circle.isPrivate ? 'pending' : 'active';
        existingMembership.joinedAt = new Date();
        await existingMembership.save();

        if (!circle.isPrivate) {
          await circle.increment('memberCount');
        }

        return res.json({
          success: true,
          message: circle.isPrivate 
            ? 'Join request sent successfully' 
            : 'Joined circle successfully',
          status: existingMembership.status
        });
      }
    }

    // Create membership
    const status = circle.isPrivate ? 'pending' : 'active';
    
    await CircleMember.create({
      userId,
      circleId,
      role: 'member',
      status
    });

    // Increment member count only for public circles
    if (!circle.isPrivate) {
      await circle.increment('memberCount');
    }

    res.json({
      success: true,
      message: circle.isPrivate 
        ? 'Join request sent successfully. Waiting for admin approval.' 
        : 'Joined circle successfully',
      status
    });
  } catch (error) {
    console.error('Join circle error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to join circle' 
    });
  }
};

// Leave circle
exports.leaveCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;

    const circle = await Circle.findByPk(circleId);

    if (!circle) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Circle not found' 
      });
    }

    const membership = await CircleMember.findOne({
      where: { userId, circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(400).json({ 
        error: 'Not a member',
        message: 'You are not a member of this circle' 
      });
    }

    // Check if user is creator/only admin
    if (membership.role === 'admin') {
      const adminCount = await CircleMember.count({
        where: { circleId, role: 'admin', status: 'active' }
      });

      if (adminCount === 1) {
        return res.status(400).json({ 
          error: 'Cannot leave',
          message: 'You are the only admin. Please promote another member to admin first or delete the circle.' 
        });
      }
    }

    // Update status to left
    membership.status = 'left';
    await membership.save();

    // Decrement member count
    await circle.decrement('memberCount');

    res.json({
      success: true,
      message: 'Left circle successfully'
    });
  } catch (error) {
    console.error('Leave circle error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to leave circle' 
    });
  }
};

// ========== CIRCLE ADMIN TOOLS ==========

// Check if user is admin
const isCircleAdmin = async (userId, circleId) => {
  const membership = await CircleMember.findOne({
    where: { 
      userId, 
      circleId, 
      role: { [Op.in]: ['admin', 'moderator'] },
      status: 'active'
    }
  });
  return !!membership;
};

// Get pending join requests
exports.getJoinRequests = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;

    // Check if user is admin
    if (!await isCircleAdmin(userId, circleId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can view join requests' 
      });
    }

    const requests = await CircleMember.findAll({
      where: { circleId, status: 'pending' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'displayName', 'profilePicture', 'bio']
      }],
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      requests: requests.map(r => ({
        id: r.id,
        user: r.user,
        requestedAt: r.createdAt
      }))
    });
  } catch (error) {
    console.error('Get join requests error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch join requests' 
    });
  }
};

// Approve join request
exports.approveJoinRequest = async (req, res) => {
  try {
    const { circleId, membershipId } = req.params;
    const userId = req.userId;

    // Check if user is admin
    if (!await isCircleAdmin(userId, circleId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can approve join requests' 
      });
    }

    const membership = await CircleMember.findOne({
      where: { id: membershipId, circleId, status: 'pending' }
    });

    if (!membership) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Join request not found' 
      });
    }

    membership.status = 'active';
    membership.joinedAt = new Date();
    await membership.save();

    // Increment member count
    await Circle.increment('memberCount', { where: { id: circleId } });

    res.json({
      success: true,
      message: 'Join request approved successfully'
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to approve join request' 
    });
  }
};

// Reject join request
exports.rejectJoinRequest = async (req, res) => {
  try {
    const { circleId, membershipId } = req.params;
    const userId = req.userId;

    // Check if user is admin
    if (!await isCircleAdmin(userId, circleId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can reject join requests' 
      });
    }

    const membership = await CircleMember.findOne({
      where: { id: membershipId, circleId, status: 'pending' }
    });

    if (!membership) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Join request not found' 
      });
    }

    membership.status = 'rejected';
    await membership.save();

    res.json({
      success: true,
      message: 'Join request rejected'
    });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to reject join request' 
    });
  }
};

// Update circle details
exports.updateCircle = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;
    const { name, description, category, tags, isPrivate } = req.body;

    // Check if user is admin
    if (!await isCircleAdmin(userId, circleId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can edit circle details' 
      });
    }

    const circle = await Circle.findByPk(circleId);

    if (!circle) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Circle not found' 
      });
    }

    // Update fields
    if (name !== undefined) circle.name = name;
    if (description !== undefined) circle.description = description;
    if (category !== undefined) circle.category = category;
    if (tags !== undefined) circle.tags = tags;
    if (isPrivate !== undefined) circle.isPrivate = isPrivate;

    await circle.save();

    res.json({
      success: true,
      message: 'Circle updated successfully',
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        category: circle.category,
        tags: circle.tags,
        isPrivate: circle.isPrivate
      }
    });
  } catch (error) {
    console.error('Update circle error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to update circle' 
    });
  }
};

// Remove member
exports.removeMember = async (req, res) => {
  try {
    const { circleId, memberId } = req.params;
    const userId = req.userId;

    // Check if user is admin
    if (!await isCircleAdmin(userId, circleId)) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can remove members' 
      });
    }

    const membership = await CircleMember.findOne({
      where: { userId: memberId, circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Member not found' 
      });
    }

    // Cannot remove other admins
    if (membership.role === 'admin' && memberId !== userId) {
      return res.status(400).json({ 
        error: 'Cannot remove',
        message: 'Cannot remove another admin. Demote them first.' 
      });
    }

    membership.status = 'left';
    await membership.save();

    // Decrement member count
    await Circle.decrement('memberCount', { where: { id: circleId } });

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to remove member' 
    });
  }
};

// Promote member to admin
exports.promoteMember = async (req, res) => {
  try {
    const { circleId, memberId } = req.params;
    const { role } = req.body; // 'admin' or 'moderator'
    const userId = req.userId;

    // Check if user is admin
    const requesterMembership = await CircleMember.findOne({
      where: { userId, circleId, role: 'admin', status: 'active' }
    });

    if (!requesterMembership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Only admins can promote members' 
      });
    }

    const membership = await CircleMember.findOne({
      where: { userId: memberId, circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Member not found' 
      });
    }

    if (!['admin', 'moderator'].includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        message: 'Role must be admin or moderator' 
      });
    }

    membership.role = role;
    await membership.save();

    res.json({
      success: true,
      message: `Member promoted to ${role} successfully`
    });
  } catch (error) {
    console.error('Promote member error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to promote member' 
    });
  }
};

// Get circle members
exports.getCircleMembers = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;

    // Check if user is member
    const userMembership = await CircleMember.findOne({
      where: { userId, circleId, status: 'active' }
    });

    if (!userMembership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a member to view members list' 
      });
    }

    const members = await CircleMember.findAll({
      where: { circleId, status: 'active' },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'displayName', 'profilePicture', 'bio']
      }],
      order: [
        ['role', 'ASC'], // Admins first
        ['joinedAt', 'ASC']
      ]
    });

    res.json({
      success: true,
      members: members.map(m => ({
        id: m.id,
        user: m.user,
        role: m.role,
        joinedAt: m.joinedAt
      }))
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch members' 
    });
  }
};

// ========== CIRCLE FEED (POSTS & COMMENTS) ==========

// Get circle posts
exports.getCirclePosts = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Check if user is member
    const membership = await CircleMember.findOne({
      where: { userId, circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a member to view posts' 
      });
    }

    const posts = await CirclePost.findAll({
      where: { circleId },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'displayName', 'profilePicture']
        }
      ],
      order: [
        ['isPinned', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit: limit + 1,
      offset
    });

    const hasMore = posts.length > limit;
    const postList = hasMore ? posts.slice(0, -1) : posts;

    res.json({
      success: true,
      posts: postList,
      hasMore
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch posts' 
    });
  }
};

// Create post
exports.createPost = async (req, res) => {
  try {
    const { circleId } = req.params;
    const userId = req.userId;
    const { title, content, type } = req.body;

    // Check if user is member
    const membership = await CircleMember.findOne({
      where: { userId, circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a member to create posts' 
      });
    }

    const post = await CirclePost.create({
      circleId,
      userId,
      content,
      type: type || 'text',
      attachments: []
    });

    const postWithAuthor = await CirclePost.findByPk(post.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: postWithAuthor
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to create post' 
    });
  }
};

// Update post
exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const { content } = req.body;

    const post = await CirclePost.findByPk(postId);

    if (!post) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Post not found' 
      });
    }

    // Only author can edit
    if (post.userId !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only edit your own posts' 
      });
    }

    post.content = content;
    await post.save();

    res.json({
      success: true,
      message: 'Post updated successfully',
      post
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to update post' 
    });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    const post = await CirclePost.findByPk(postId);

    if (!post) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Post not found' 
      });
    }

    // Author or circle admin can delete
    const isAdmin = await isCircleAdmin(userId, post.circleId);

    if (post.userId !== userId && !isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only delete your own posts' 
      });
    }

    await post.destroy();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to delete post' 
    });
  }
};

// Get post comments
exports.getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const post = await CirclePost.findByPk(postId);

    if (!post) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Post not found' 
      });
    }

    // Check if user is circle member
    const membership = await CircleMember.findOne({
      where: { userId, circleId: post.circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a member to view comments' 
      });
    }

    const comments = await PostComment.findAll({
      where: { postId },
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }],
      order: [['createdAt', 'ASC']],
      limit: limit + 1,
      offset
    });

    const hasMore = comments.length > limit;
    const commentList = hasMore ? comments.slice(0, -1) : comments;

    res.json({
      success: true,
      comments: commentList,
      hasMore
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch comments' 
    });
  }
};

// Create comment
exports.createComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const { content } = req.body;

    const post = await CirclePost.findByPk(postId);

    if (!post) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Post not found' 
      });
    }

    // Check if user is circle member
    const membership = await CircleMember.findOne({
      where: { userId, circleId: post.circleId, status: 'active' }
    });

    if (!membership) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You must be a member to comment' 
      });
    }

    const comment = await PostComment.create({
      postId,
      userId,
      content
    });

    // Increment comment count
    await post.increment('commentCount');

    const commentWithAuthor = await PostComment.findByPk(comment.id, {
      include: [{
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: commentWithAuthor
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to create comment' 
    });
  }
};

// Update comment
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;
    const { content } = req.body;

    const comment = await PostComment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Comment not found' 
      });
    }

    // Only author can edit
    if (comment.userId !== userId) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only edit your own comments' 
      });
    }

    comment.content = content;
    await comment.save();

    res.json({
      success: true,
      message: 'Comment updated successfully',
      comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to update comment' 
    });
  }
};

// Delete comment
exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    const comment = await PostComment.findByPk(commentId, {
      include: [{
        model: CirclePost,
        as: 'post'
      }]
    });

    if (!comment) {
      return res.status(404).json({ 
        error: 'Not found',
        message: 'Comment not found' 
      });
    }

    // Author or circle admin can delete
    const isAdmin = await isCircleAdmin(userId, comment.post.circleId);

    if (comment.userId !== userId && !isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You can only delete your own comments' 
      });
    }

    await comment.destroy();

    // Decrement comment count
    await CirclePost.decrement('commentCount', { where: { id: comment.postId } });

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to delete comment' 
    });
  }
};
