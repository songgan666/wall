const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// 发送前替换：尖括号→全角，on*事件→标记（纵深防御）
function sanitizeContent(text) {
    if (!text) return '';
    return text
        .replace(/</g, '＜')
        .replace(/>/g, '＞')
        .replace(/\bon(\w+)(\s*=)/gi, '@@on_$1$2');
}

// 获取所有帖子及评论 (按时间倒序)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const userId = req.userId || null;

        const [posts] = await db.query('SELECT * FROM posts ORDER BY created_at DESC');
        const [comments] = await db.query('SELECT c.*, u.username as user FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at ASC');

        // 查当前用户点赞了哪些帖子
        let likedSet = new Set();
        if (userId) {
            const [liked] = await db.query('SELECT post_id FROM likes WHERE user_id = ?', [userId]);
            liked.forEach(row => likedSet.add(row.post_id));
        }

        const formattedPosts = posts.map(post => ({
            id: post.id,
            userId: post.user_id,
            content: post.content,
            timestamp: new Date(post.created_at).getTime(),
            likes: post.likes_count,
            liked: likedSet.has(post.id),
            comments: comments.filter(c => c.post_id === post.id).map(c => ({
                id: c.id,
                userId: c.user_id,
                user: c.user,
                text: c.content,
                timestamp: new Date(c.created_at).getTime()
            }))
        }));

        res.json({ code: 200, data: formattedPosts });
    } catch (error) {
        res.status(500).json({ code: 500, message: "获取动态失败" });
    }
});

// 发布新帖子
router.post('/', authMiddleware, async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "内容不能为空" });

    try {
        const [result] = await db.query(
            'INSERT INTO posts (user_id, content) VALUES (?, ?)',
            [req.userId, sanitizeContent(content)]
        );
        res.json({ code: 200, message: "发布成功", data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ code: 500, message: "发布失败" });
    }
});

// 删除帖子
router.delete('/:postId', authMiddleware, async (req, res) => {
    const { postId } = req.params;

    try {
        const [result] = await db.query(
            'DELETE FROM posts WHERE id = ? AND user_id = ?',
            [postId, req.userId]
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
router.post('/:postId/comments', authMiddleware, async (req, res) => {
    const { postId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ code: 400, message: "评论内容不能为空" });

    try {
        const [result] = await db.query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, req.userId, sanitizeContent(text)]
        );
        res.json({ code: 200, message: "评论成功", data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ code: 500, message: "评论失败" });
    }
});

// 删除评论
router.delete('/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    const { commentId } = req.params;

    try {
        const [result] = await db.query(
            'DELETE FROM comments WHERE id = ? AND user_id = ?',
            [commentId, req.userId]
        );

        if (result.affectedRows === 0) {
            return res.status(403).json({ code: 403, message: "无权限删除此评论" });
        }
        res.json({ code: 200, message: "评论删除成功" });
    } catch (error) {
        res.status(500).json({ code: 500, message: "服务器错误" });
    }
});

// 点赞/取消点赞（一人一赞，再次点击取消）
router.post('/:postId/like', authMiddleware, async (req, res) => {
    const { postId } = req.params;

    try {
        const [existing] = await db.query(
            'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
            [req.userId, postId]
        );

        if (existing.length > 0) {
            await db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.userId, postId]);
            await db.query('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?', [postId]);
            res.json({ code: 200, message: "取消点赞", liked: false });
        } else {
            await db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.userId, postId]);
            await db.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [postId]);
            res.json({ code: 200, message: "点赞成功", liked: true });
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: "操作失败" });
    }
});

module.exports = router;