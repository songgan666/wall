const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

// ============================================================
// 【防御层 3】输入类型校验 — 数值型路由参数必须是正整数
// 即使参数化查询可以防止 SQL 注入，类型校验仍然提供：
//   - 快速拒绝畸形请求（fail-fast）
//   - 防止未来代码变更引入的其他注入风险
//   - 给合法 API 调用者提供清晰的错误信息
// ============================================================
function validatePositiveInt(value, paramName) {
    if (value === undefined || value === null || value === '') {
        return { valid: false, error: `${paramName} 不能为空` };
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0 || num > 2147483647) {
        return { valid: false, error: `${paramName} 必须为正整数，收到: ${String(value).substring(0, 50)}` };
    }
    return { valid: true, value: num };
}

// 发送前替换：尖括号→全角，on*事件→标记（纵深防御：XSS + SQL 审计）
function sanitizeContent(text) {
    if (!text) return '';

    // ---------- SQL 注入被动审计（仅日志记录，不拦截）----------
    // 帖子内容通过参数化查询安全存储，SQL 关键字不会被执行。
    // 但审计日志可以帮助发现潜在攻击尝试。
    const sqlPatterns = [
        { name: 'UNION SELECT', regex: /\bUNION\s+(ALL\s+)?SELECT\b/i },
        { name: 'Tautology', regex: /('|")\s*OR\s+['"]?\s*=\s*['"]?/i },
        { name: 'SQL comment termination', regex: /'\s*--\s*$/im },
        { name: 'SLEEP/BENCHMARK', regex: /\b(SLEEP|BENCHMARK)\s*\(/i },
        { name: 'INFORMATION_SCHEMA', regex: /\bINFORMATION_SCHEMA\b/i },
    ];
    for (const { name, regex } of sqlPatterns) {
        if (regex.test(text)) {
            console.warn(
                `[CONTENT-AUDIT] 帖子/评论内容中检测到 SQL 模式 "${name}"。` +
                `内容将通过参数化查询安全存储，此日志仅用于审计。`
            );
        }
    }

    // ---------- 主要 XSS 过滤 ----------
    return text
        .replace(/</g, '＜')
        .replace(/>/g, '＞')
        .replace(/\bon(\w+)(\s*=)/gi, '@@on_$1$2');
}

// 获取所有帖子及评论 (按时间倒序)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const userId = req.userId || null;

        const [posts] = await db.execute('SELECT * FROM posts ORDER BY created_at DESC');
        const [comments] = await db.execute('SELECT c.*, u.username as user FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.created_at ASC');

        // 查当前用户点赞了哪些帖子
        let likedSet = new Set();
        if (userId) {
            const [liked] = await db.execute('SELECT post_id FROM likes WHERE user_id = ?', [userId]);
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
        const [result] = await db.execute(
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

    // 【防御层 3】校验 postId 必须为正整数
    const idCheck = validatePositiveInt(postId, 'postId');
    if (!idCheck.valid) {
        return res.status(400).json({ code: 400, message: idCheck.error });
    }
    const safePostId = idCheck.value;

    try {
        const [result] = await db.execute(
            'DELETE FROM posts WHERE id = ? AND user_id = ?',
            [safePostId, req.userId]
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

    // 【防御层 3】校验 postId 必须为正整数
    const idCheck = validatePositiveInt(postId, 'postId');
    if (!idCheck.valid) {
        return res.status(400).json({ code: 400, message: idCheck.error });
    }
    const safePostId = idCheck.value;

    try {
        const [result] = await db.execute(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [safePostId, req.userId, sanitizeContent(text)]
        );
        res.json({ code: 200, message: "评论成功", data: { id: result.insertId } });
    } catch (error) {
        res.status(500).json({ code: 500, message: "评论失败" });
    }
});

// 删除评论
router.delete('/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    const { commentId } = req.params;

    // 【防御层 3】校验 commentId 必须为正整数
    const idCheck = validatePositiveInt(commentId, 'commentId');
    if (!idCheck.valid) {
        return res.status(400).json({ code: 400, message: idCheck.error });
    }
    const safeCommentId = idCheck.value;

    try {
        const [result] = await db.execute(
            'DELETE FROM comments WHERE id = ? AND user_id = ?',
            [safeCommentId, req.userId]
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

    // 【防御层 3】校验 postId 必须为正整数
    const idCheck = validatePositiveInt(postId, 'postId');
    if (!idCheck.valid) {
        return res.status(400).json({ code: 400, message: idCheck.error });
    }
    const safePostId = idCheck.value;

    try {
        const [existing] = await db.execute(
            'SELECT id FROM likes WHERE user_id = ? AND post_id = ?',
            [req.userId, safePostId]
        );

        if (existing.length > 0) {
            await db.execute('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [req.userId, safePostId]);
            await db.execute('UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ?', [safePostId]);
            res.json({ code: 200, message: "取消点赞", liked: false });
        } else {
            await db.execute('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [req.userId, safePostId]);
            await db.execute('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [safePostId]);
            res.json({ code: 200, message: "点赞成功", liked: true });
        }
    } catch (error) {
        res.status(500).json({ code: 500, message: "操作失败" });
    }
});

module.exports = router;