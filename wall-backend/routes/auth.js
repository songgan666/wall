const express = require('express');
const router = express.Router();
const db = require('../db');

const COOKIE_OPTS = 'SameSite=Strict; HttpOnly; Path=/; Max-Age=86400';

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
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existing.length > 0) {
            return res.status(409).json({ code: 409, message: "用户名已被占用" });
        }

        const [result] = await db.query(
            'INSERT INTO users (username, password_hash, nickname) VALUES (?, ?, ?)',
            [username, password, nickname || username]
        );

        const userId = result.insertId;
        res.setHeader('Set-Cookie', `user_id=${userId}; ${COOKIE_OPTS}`);
        res.status(201).json({
            code: 201,
            message: "注册成功",
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
        const [users] = await db.query(
            'SELECT id, username, nickname, avatar FROM users WHERE username = ? AND password_hash = ?',
            [username, password]
        );

        if (users.length > 0) {
            const user = users[0];
            res.setHeader('Set-Cookie', `user_id=${user.id}; ${COOKIE_OPTS}`);
            res.json({
                code: 200,
                message: "登录成功",
                user: user
            });
        } else {
            res.status(401).json({ code: 401, message: "用户名或密码错误" });
        }
    } catch (error) {
        console.error("登录错误:", error);
        res.status(500).json({ code: 500, message: "服务器内部错误" });
    }
});

// 退出登录
router.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'user_id=; SameSite=Strict; HttpOnly; Path=/; Max-Age=0');
    res.json({ code: 200, message: "已退出登录" });
});

module.exports = router;
