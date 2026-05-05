const express = require('express');
const router = express.Router();
const db = require('../db');

// 用户登录
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ code: 400, message: "用户名或密码不能为空" });
    }

    try {
        // 【安全点：防 SQL 注入】使用 ? 占位符，绝对不能直接拼接字符串
        const [users] = await db.query(
            'SELECT id, username, nickname, avatar FROM users WHERE username = ? AND password_hash = ?',
            [username, password] // 注意：实验环境中暂用明文比对，真实生产环境需使用 bcrypt 对比 hash
        );

        if (users.length > 0) {
            // 登录成功
            res.json({
                code: 200,
                message: "登录成功",
                user: users[0] // 返回用户信息给前端
            });
        } else {
            res.status(401).json({ code: 401, message: "用户名或密码错误" });
        }
    } catch (error) {
        console.error("登录错误:", error);
        res.status(500).json({ code: 500, message: "服务器内部错误" });
    }
});

module.exports = router;