const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

// 用户注册
router.post('/register', async (req, res) => {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
        return res.status(400).json({ code: 400, message: "用户名或密码不能为空" });
    }
    if (username.length < 2 || username.length > 50) {
        return res.status(400).json({ code: 400, message: "用户名长度需在 2-50 个字符之间" });
    }
    if (password.length < 3 || password.length > 100) {
        return res.status(400).json({ code: 400, message: "密码长度需在 3-100 个字符之间" });
    }

    try {
        const [existing] = await db.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existing.length > 0) {
            return res.status(409).json({ code: 409, message: "用户名已被占用" });
        }

        const [result] = await db.execute(
            'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)',
            [username, password, nickname || username]
        );

        const userId = result.insertId;
        const token = generateToken();
        await db.execute('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [userId, token]);

        res.status(201).json({
            code: 201,
            message: "注册成功",
            token,
            user: { id: userId, username, nickname: nickname || username }
        });
    } catch (error) {
        console.error("注册错误:", error);
        res.status(500).json({ code: 500, message: "服务器内部错误" });
    }
});

// 用户登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ code: 400, message: "用户名或密码不能为空" });
    }

    try {
        // 【安全点：防 SQL 注入】使用 ? 占位符，绝对不能直接拼接字符串
        const [users] = await db.execute(
            'SELECT id, username, nickname, avatar FROM users WHERE username = ? AND password_hash = ?',
            [username, password] // 注意：实验环境中暂用明文比对，真实生产环境需使用 bcrypt 对比 hash
        );

        if (users.length > 0) {
            const user = users[0];
            const token = generateToken();
            await db.execute('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);

            res.json({
                code: 200,
                message: "登录成功",
                token,
                user
            });
        } else {
            res.status(401).json({ code: 401, message: "用户名或密码错误" });
        }
    } catch (error) {
        console.error("登录错误:", error);
        res.status(500).json({ code: 500, message: "服务器内部错误" });
    }
});

// 用户登出
router.post('/logout', authMiddleware, async (req, res) => {
    const token = req.headers.authorization.slice(7);
    await db.execute('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ code: 200, message: "已登出" });
});

module.exports = router;