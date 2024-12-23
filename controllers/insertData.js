const User = require('../models/user')
const ChildPost = require('../models/childPost')
const Replie = require('../models/replie')
const Comment = require('../models/comment')
const Post = require('../models/post')
const data_posts = require('../scrape_data/dataset_instagram-scraper_posts.json')
const asyncHandler = require('express-async-handler')

const fn = async (user_child) => {
    try {
        const existingUser = await User.findOne({ username: user_child?.ownerUsername });
        if (existingUser) {
            console.log(`${user_child?.ownerUsername} was exists`)
            return;
        }
        await User.create({
            id: user_child?.id,
            fullname: '',
            username: user_child?.ownerUsername,
            email: user_child?.ownerUsername + '@gmail.com',
            password: '12345678',
            avatar: user_child?.ownerProfilePicUrl,
        })
    } catch (error) {
        console.log(error)
    }
}
// ne insert ben day la no vo them db cua tui a
// ok
const fn_childPost = async (post_child) => {
    await ChildPost.create({
        id: post_child?.id,
        type: post_child?.type,
        shortCode: post_child?.shortCode,
        caption: post_child?.caption,
        hashtags: post_child?.hashtags,
        mentions: post_child?.mentions,
        url: post_child?.url,
        commentsCount: post_child?.commentsCount,
        comments: post_child?.latestComments,
        dimensionsHeight: post_child?.dimensionsHeight,
        dimensionsWidth: post_child?.dimensionsWidth,
        displayUrl: post_child?.displayUrl,
        images: post_child?.images,
        alt: post_child?.alt,
        likesCount: post_child?.likesCount,
        timestamp: post_child?.timestamp,
        childPosts: post_child?.childPosts,
        ownerId: post_child?.ownerId,
    })
}

const fn_replies = async (rep) => {
    await Replie.create({
        id: rep?.id,
        text: rep?.text,
        ownerUsername: rep?.ownerUsername,
        ownerProfilePicUrl: rep?.ownerProfilePicUrl,
        timestamp: rep?.timestamp,
        repliesCount: rep?.repliesCount,
        replies: rep?.replies,
        likesCount: rep?.likesCount,
        ownerId: rep?.owner?.id,
    })
}

const fn_comments = async (comment) => {
    try {
        const replies = comment?.repliesCount > 0
            ? comment?.replies.map(reply => ({ id: reply.id }))
            : [];

        await Comment.create({
            id: comment?.id,
            text: comment?.text,
            ownerUsername: comment?.ownerUsername,
            ownerProfilePicUrl: comment?.ownerProfilePicUrl,
            timestamp: comment?.timestamp,
            repliesCount: comment?.repliesCount,
            replies,
            likesCount: comment?.likesCount,
            ownerId: comment?.owner?.id,
        });
    } catch (error) {
        console.log(error)
    }
}

const fn_posts = async (post) => {
    // await Post.findOneAndDelete({ id: post?.id })
    try {
        const comments = post?.latestComments !== null
            ? post?.latestComments.map(cmt => ({ id: cmt.id }))
            : [];

        const childPosts = post?.childPosts !== null
            ? post?.childPosts.map(child => ({ id: child.id }))
            : [];

        const musicInfo = post?.musicInfo !== null
            ? {
                artist_name: post?.artist_name,
                song_name: post?.song_name,
                uses_original_audio: post?.uses_original_audio,
                should_mute_audio: post?.should_mute_audio,
                should_mute_audio_reason: post?.should_mute_audio_reason,
                audio_id: post?.audio_id,
            }
            : {};

        await Post.create({
            id: post?.id,
            type: post?.type,
            shortCode: post?.shortCode,
            caption: post?.caption,
            hashtags: post?.hashtags,
            mentions: post?.mentions,
            url: post?.url,
            commentsCount: post?.commentsCount,
            comments,
            dimensionsHeight: post?.dimensionsHeight,
            dimensionsWidth: post?.dimensionsWidth,
            displayUrl: post?.displayUrl,
            images: post?.images,
            videoUrl: post?.videoUrl,
            alt: post?.alt,
            likesCount: post?.likesCount,
            timestamp: post?.timestamp,
            videoViewCount: post?.videoViewCount,
            videoPlayCount: post?.videoPlayCount,
            childPosts,
            ownerFullName: post?.ownerFullName,
            ownerUsername: post?.ownerUsername,
            ownerId: post?.ownerId,
            productType: post?.productType,
            isPinned: post?.isPinned,
            isSponsored: post?.isSponsored,
            musicInfo
        });
    } catch (error) {
        console.log(error)
    }
}

const fn_del = async (user_child) => {
    try {
        await User.findOneAndDelete({
            username: user_child?.ownerUsername,
        })
    } catch (error) {
        console.log(error)
    }
}

const insertUser = asyncHandler(async (req, res) => {
    const promises = [];
    for (let user of data_posts) {
        for (let user_child of user?.latestComments) promises.push(fn(user_child))
    }
    await Promise.all(promises)
    return res.json('insert data success')
})

const insertChildPost = asyncHandler(async (req, res) => {
    const promises = [];
    for (let user of data_posts) {
        for (let post_child of user?.childPosts) promises.push(fn_childPost(post_child))
    }
    await Promise.all(promises)
    return res.json('insert data child post success')
})

const insertReplie = asyncHandler(async (req, res) => {
    const promises = [];
    for (let user of data_posts) {
        for (let replie of user?.latestComments) {
            for (let rep of replie?.replies) {
                promises.push(fn_replies(rep))
            }
        }
    }
    await Promise.all(promises)
    return res.json('insert data replies success')
})

const insertComment = asyncHandler(async (req, res) => {
    const promises = [];
    for (let user of data_posts) {
        for (let comment of user?.latestComments) {
            promises.push(fn_comments(comment))
        }
    }
    await Promise.all(promises)
    return res.json('insert comment success')
})

const insertPost = asyncHandler(async (req, res) => {
    const promises = [];
    for (let post of data_posts) {
        promises.push(fn_posts(post))
    }
    await Promise.all(promises)
    return res.json('insert post success')
})
module.exports = {
    insertUser,
    insertChildPost,
    insertReplie,
    insertComment,
    insertPost
}