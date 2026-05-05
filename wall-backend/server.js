const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors()); 
app.use(express.json()); // 解析前端发来的 JSON 数据

// 挂载所有路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/posts', require('./routes/posts'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 匿名墙后端服务器已在 http://localhost:${PORT} 启动`);
});