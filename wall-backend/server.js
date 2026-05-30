const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// ============================================================
// SQL 注入防御层 2：恶意模式检测中间件
// 在所有入站请求数据（body、query、params、headers）中扫描
// 已知的 SQL 注入攻击模式，在路由处理之前拦截攻击请求。
// 主要防御层为参数化查询（Layer 1），本层提供纵深防御。
// ============================================================
app.use(require('./middleware/sqlGuard'));

// 手动托管前端静态文件（避免 express.static 挂载整个项目根目录）
const rootDir = path.join(__dirname, '..');
app.get('/index.html', (req, res) => res.sendFile(path.join(rootDir, 'index.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(rootDir, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(rootDir, 'style.css')));

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 匿名墙后端服务器已在 http://localhost:${PORT} 启动`);
});
