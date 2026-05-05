const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取所有帖子及评论 (按时间倒序)
router.get('/', async (req, res) => {
    try {
        // 查出所有帖子
        const [posts] = await db.query('SELECT * FROM posts ORDER BY created_at DESC');
        // 查出所有评论
        const [comments] = await db.query('SELECT c.*, u.username as user FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at ASC');
        
        // 将评论按 post_id 组装到对应的帖子中
        const formattedPosts = posts.map(post => {
            return {
                id: post.id,
                userId: post.user_id,
                content: post.content,
                timestamp: new Date(post.created_at).getTime(),
                likes: post.likes_count,
                comments: comments.filter(c => c.post_id === post.id).map(c => ({
                    id: c.id,
                    userId: c.user_id,
                    user: c.user,
                    text: c.content,
                    timestamp: new Date(c.created_at).getTime()
                }))
            };
        });

        res.json({ code: 200, data: formattedPosts });
    } catch (error) {
        res.status(500).json({ code: 500, message: "获取动态失败" });
    }
});

// 发布新帖子
router.post('/', async (req, res) => {
    const { user_id, content } = req.body;
    if (!user_id || !content) return res.status(400).json({ message: "参数不完整" });

    try {
        const [result] = await db.query(
            'INSERT INTO posts (user_id, content) VALUES (?, ?)',
            [user_id, content]
        );
        res.json({ code: 200, message: "发布成功", data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ code: 500, message: "发布失败" });
    }
});

// 删除帖子
router.delete('/:postId', async (req, res) => {
    const { postId } = req.params;
    const { user_id } = req.body; // 假设前端把当前登录用户的 ID 传过来

    try {
        // 【安全点：水平越权防护 (IDOR)】
        // 删除时不仅要匹配帖子ID，还要强校验这篇帖子的 user_id 是否等于当前请求者的 user_id
        const [result] = await db.query(
            'DELETE FROM posts WHERE id = ? AND user_id = ?',
            [postId, user_id]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ code: 403, message: "删除失败：帖子不存在或无权限删除他人帖子" });
        }
        res.json({ code: 200, message: "帖子删除成功" });
    } catch (error) {
        res.status(500).json({ code: 500, message: "服务器错误" });
    }
});

// 发布评论
router.post('/:postId/comments', async (req, res) => {
    const { postId } = req.params;
    const { user_id, text } = req.body;

    try {
        const [result] = await db.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, user_id, text]
        );
        res.json({ code: 200, message: "评论成功", data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ code: 500, message: "评论失败" });
    }
});

// 删除评论
router.delete('/:postId/comments/:commentId', async (req, res) => {
    const { commentId } = req.params;
    const { user_id } = req.body;

    try {
        // 【安全点：水平越权防护 (IDOR)】只能删自己的评论
        const [result] = await db.query(
            'DELETE FROM comments WHERE id = ? AND user_id = ?',
            [commentId, user_id]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ code: 403, message: "无权限删除此评论" });
        }
        res.json({ code: 200, message: "评论删除成功" });
    } catch (error) {
        res.status(500).json({ code: 500, message: "服务器错误" });
    }
});

// 点赞/取消点赞 (简单实现)
router.post('/:postId/like', async (req, res) => {
    const { postId } = req.params;
    const { action } = req.body; // 'like' 或 'unlike'

    try {
        if (action === 'like') {
            await db.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
        } else {
            await db.query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?', [postId]);
        }
        res.json({ code: 200, message: "操作成功" });
    } catch (error) {
        res.status(500).json({ code: 500, message: "操作失败" });
    }
});

module.exports = router;