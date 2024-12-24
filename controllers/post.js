const asyncHandler = require('express-async-handler')
const Post = require('../models/post')
const Comment = require('../models/comment');
const User = require('../models/user');
const { default: mongoose } = require('mongoose');
const { generateShortCode } = require('../utils/contansts');

const getPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 5 } = req.query;
    const skip = (page - 1) * limit;
    const response = await Post.find().skip(skip).limit(Number(limit));
    const totalPosts = await Post.countDocuments();
    const hasMore = skip + response.length < totalPosts;
    return res.status(200).json({
        posts: response,
        hasMore,
        mess: response ? 'Has Post' : 'Can not get posts'
    })
})

const getCurentPost = asyncHandler(async (req, res) => {
    const { pid } = req.query;
    const response = await Post.findById(pid);
    return res.status(200).json({
        success: response ? true : false,
        post: response,
        mes: response ? 'Get post successfully' : 'Can not get post'
    })
})

const getCommentInPost = asyncHandler(async (req, res) => {
    const { pid } = req.params;

    try {
        const post = await Post.findById(pid);
        if (!post) {
            return res.status(404).json({
                success: false,
                mes: 'Post not found',
            });
        }

        const commentIds = post.comments.map(comment => comment._id);
        const detailedComments = await Promise.all(
            commentIds.map(id => Comment.findOne({ _id: new mongoose.Types.ObjectId(id) }))
        );

        return res.status(200).json({
            success: true,
            comments: detailedComments,
            mes: 'Get comments successfully',
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            mes: 'Error fetching comments',
        });
    }
})

const likePost = asyncHandler(async (req, res) => {
    const { uid, pid } = req.body;
    try {

        const user = await User.findById(uid);
        const post = await Post.findById(pid);
        if (!post) return res.status(404).json({ mes: 'Post not found' });
        const hasLike = post.arrayUserLike.includes(uid);
        if (hasLike) {
            post.arrayUserLike = post.arrayUserLike.filter(id => id.toString() !== uid);
            post.likesCount -= 1;
            await post.save();
            user.likePostId.remove(pid);
            await user.save();
            return res.status(200).json({ message: 'Removed post like successfully', post });
        } else {
            post.arrayUserLike.push(uid);
            post.likesCount += 1;
            await post.save();
            user.likePostId.push(pid);
            await user.save();
            return res.status(200).json({ mes: 'Liked post successfully', post });
        }
    } catch (error) {
        console.log('error at like post: ' + error)
    }
})

const addCommentPost = asyncHandler(async (req, res) => {
    const { pid, text, ownerUsername, ownerProfilePicUrl, ownerId } = req.body;

    // Kiểm tra đầu vào
    if (!pid || !text || !ownerUsername || !ownerProfilePicUrl || !ownerId) {
        return res.status(400).json({ mes: 'Missing required fields' });
    }

    try {
        // Tìm bài viết cần thêm comment
        const post = await Post.findById(pid);
        if (!post) {
            return res.status(404).json({ mes: 'Post not found' });
        }

        // Tạo bình luận mới
        const newComment = new Comment({
            text,
            ownerUsername,
            ownerProfilePicUrl,
            ownerId,
            repliesCount: 0,
            likesCount: 0,
        });

        // Lưu bình luận vào CSDL
        const savedComment = await newComment.save();

        // Cập nhật bài viết (nếu cần lưu danh sách comment trong bài viết)
        post.comments.push(savedComment._id);
        post.commentsCount += 1;
        await post.save();

        // Trả về bình luận vừa thêm
        res.status(201).json({
            mes: 'Comment added successfully',
            comment: savedComment,
            post,
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ mes: 'Failed to add comment', error });
    }
});

const createPost = asyncHandler(async (req, res) => {
    const { caption, username } = req.body;
    const images = req.files?.images?.map(el => el.path)
    const shortCode = generateShortCode();
    const url = 'https://www.instagram.com/p/' + shortCode + '/';
    if (images) req.body.images = images
    const user = await User.findOne({ username });
    if (!user) {
        return res.status(404).json({ mes: 'User not found' })
    }
    const response = await Post.create({
        shortCode,
        caption,
        url,
        images,
        ownerFullName: user.ownerFullName,
        ownerUsername: user.username
    });
    return res.status(200).json({
        success: response ? true : false,
        mes: response ? 'Create new post successfully' : 'Something went wrongs',
        response
    });
})

const getPostsByuid = asyncHandler(async (req, res) => {
    const { uid } = req.params;
    console.log(uid)
    const user = await User.findById(uid);
    if (!user) {
        return res.status(404).json({ mes: 'User not found' })
    }
    const response = await Post.find({ ownerUsername: user.username });
    return res.status(200).json({
        success: response ? true : false,
        mes: response ? 'getPostsByuid successfully' : 'Something went wrong!',
        response
    })
})
module.exports = {
    getPosts,
    getCurentPost,
    getCommentInPost,
    likePost,
    addCommentPost,
    createPost,
    getPostsByuid
}