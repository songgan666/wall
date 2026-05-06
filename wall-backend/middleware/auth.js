const crypto = require('crypto');
const db = require('../db');

// 生成随机 token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 认证中间件 — 从 Authorization header 提取 token，查询 sessions 表获取 user_id
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ code: 401, message: '未登录' });
    }

    const token = authHeader.slice(7);
    try {
        const [rows] = await db.query(
            'SELECT user_id FROM sessions WHERE token = ?',
            [token]
        );
        if (rows.length === 0) {
            return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' });
        }
        req.userId = rows[0].user_id;
        next();
    } catch (err) {
        res.status(500).json({ code: 500, message: '服务器错误' });
    }
}

// 可选认证 — 已登录则附加 userId，未登录也能继续
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const [rows] = await db.query(
                'SELECT user_id FROM sessions WHERE token = ?',
                [token]
            );
            if (rows.length > 0) {
                req.userId = rows[0].user_id;
            }
        } catch (err) {
            // ignore
        }
    }
    next();
}

module.exports = { generateToken, authMiddleware, optionalAuth };
