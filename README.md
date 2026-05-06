# 匿名墙

校园匿名交流平台，采用 **Node.js + Express + MySQL** 架构。

## 项目结构

```
wall/
├── index.html              # 前端主页面
├── script.js               # 前端逻辑（含 XSS 防护）
├── style.css               # 样式
├── wall-backend/
│   ├── server.js           # 后端主入口
│   ├── db.js               # 数据库连接池
│   ├── routes/
│   │   ├── auth.js         # 登录 + 注册
│   │   └── posts.js        # 帖子/评论/点赞 CRUD
│   ├── sql/
│   │   └── init.sql        # 建表 + 种子数据
│   ├── .env                # 环境变量（数据库密码等）
│   ├── package.json
│   └── API_DOC.md          # 接口文档
```

## 快速启动

1. 确保本地运行着 MySQL（XAMPP 或独立安装均可）。
2. 创建数据库并导入表结构：
   ```
   mysql -u root -p < wall-backend/sql/init.sql
   ```
3. 修改 `wall-backend/.env` 中的数据库密码。
4. 安装依赖并启动：
   ```
   cd wall-backend
   npm install
   npm start
   ```
5. 浏览器打开 `index.html`（或用 Live Server 托管前端）。

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| GET | `/api/posts` | 获取全部帖子及评论 |
| POST | `/api/posts` | 发布帖子 |
| DELETE | `/api/posts/:id` | 删除帖子（归属性校验） |
| POST | `/api/posts/:id/comments` | 发表评论 |
| DELETE | `/api/posts/:id/comments/:cid` | 删除评论（归属性校验） |
| POST | `/api/posts/:id/like` | 点赞/取消赞 |

详见 [API_DOC.md](wall-backend/API_DOC.md)。

## 安全措施

### 当前已实施

| 措施 | 位置 | 说明 |
|------|------|------|
| SQL 注入防护 | 全部路由 | 所有查询使用 `?` 参数化，杜绝字符串拼接 |
| IDOR 水平越权防护 | posts.js | 删帖/删评论时校验 `user_id`，只能删自己的 |
| XSS 防护 — 尖括号替换 | 前后端双重 | `<` `>` 发送前替换为全角 `＜` `＞`，`escapeHtml()` 兜底 |
| XSS 防护 — script 标签 | 前后端双重 | `<script>` 经尖括号替换后失效，不可执行 |
| XSS 防护 — on* 事件 | 前后端双重 | `onclick=` 等替换为 `@@on_click=`，阻断事件注入 |
| 输入校验 | auth.js / posts.js | 空值校验、长度校验、用户名唯一性校验 |

### XSS 过滤流程

```
用户输入: <script>alert(1)</script> <div onclick="x"> <3
    ↓ sanitizeContent() 发送前替换
存入数据库: ＜script＞alert(1)＜/script＞ ＜div @@on_click="x"＞ ＜3
    ↓ restoreContent() 显示前恢复
恢复后: <script>alert(1)</script> <div onclick="x"> <3
    ↓ escapeHtml() 渲染转义
浏览器显示: 纯文本，不执行任何代码
```

### 待实施

- 密码 bcrypt 哈希（当前明文比对，实验环境）
- JWT 身份认证（当前 user_id 由前端传递）
- 点赞按人限制（当前为全局计数器）

## 技术栈

- 前端：原生 HTML/CSS/JS（无框架）
- 后端：Express 5.x
- 数据库：MySQL + mysql2（连接池）
