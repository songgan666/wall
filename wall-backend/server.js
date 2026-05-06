const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

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
