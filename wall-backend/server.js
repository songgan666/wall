const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// 频率限制：每个 IP 每秒最多 3 次请求
const rateLimitMap = new Map();
const RATE_LIMIT = 3;
const WINDOW_MS = 1000;

app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress;
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (record && now - record.start < WINDOW_MS) {
        record.count++;
        if (record.count > RATE_LIMIT) {
            return res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试' });
        }
    } else {
        rateLimitMap.set(ip, { start: now, count: 1 });
    }

    next();
});

// 中间件
app.use(express.json());

// 托管前端静态文件（前后端同源，无需 CORS）
app.use(express.static(path.join(__dirname, '..')));

// Cookie 解析
app.use((req, res, next) => {
    req.cookies = {};
    const raw = req.headers.cookie;
    if (raw) {
        raw.split(';').forEach(pair => {
            const [key, ...rest] = pair.trim().split('=');
            if (key) req.cookies[key] = decodeURIComponent(rest.join('='));
        });
    }
    next();
});

// 认证中间件：从 HttpOnly cookie 读 user_id
app.use((req, res, next) => {
    req.userId = req.cookies.user_id ? parseInt(req.cookies.user_id, 10) : null;
    next();
});

// 挂载所有路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 匿名墙后端服务器已在 http://localhost:${PORT} 启动`);
});
