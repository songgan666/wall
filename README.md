# 匿名墙

校园匿名交流平台，采用 **Node.js + Express + MySQL** 架构，针对实验环境采用 Docker 单容器一键部署。

## 项目结构
```Plaintext
wall/
├── index.html              # 前端主页面
├── script.js               # 前端逻辑（含 XSS 防护）
├── style.css               # 样式
├── docker-compose.yml      # Docker 编排文件
├── Dockerfile              # Docker 镜像构建图纸
├── entrypoint.sh           # 容器启动脚本（初始化数据库环境与启动后端）
├── wall-backend/
│   ├── server.js           # 后端主入口（托管前端 + API）
│   ├── db.js               # 数据库连接池
│   ├── middleware/
│   │   └── auth.js         # Session Token 认证中间件
│   ├── routes/
│   │   ├── auth.js         # 登录 + 注册 + 登出
│   │   └── posts.js        # 帖子/评论/点赞 CRUD
│   ├── sql/
│   │   └── init.sql        # 建表 + 种子数据
│   ├── package.json
│   └── API_DOC.md          # 接口文档
```
## 快速启动 (Docker 一键部署)

本项目针对验收需求进行了环境统合，采用 Ubuntu 基础镜像将 MySQL 数据库与 Node.js 后端集成在单一容器内，无需本地配置环境。

1. 确保宿主机已安装 Docker 及 Docker Compose。
2. 在项目根目录执行以下命令，构建并后台启动服务：
   `docker compose up --build -d`
3. 浏览器访问 `http://localhost:3000` 即可使用。

**维护命令：**
- 查看运行日志：`docker compose logs -f`
- 停止容器服务：`docker compose down`

## API 端点

| 方法 | 端点 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/auth/register` | 否 | 用户注册（返回 token） |
| POST | `/api/auth/login` | 否 | 用户登录（返回 token） |
| POST | `/api/auth/logout` | 是 | 用户登出（销毁 token） |
| GET | `/api/posts` | 否 | 获取全部帖子及评论（已登录含点赞状态） |
| POST | `/api/posts` | 是 | 发布帖子 |
| DELETE | `/api/posts/:id` | 是 | 删除帖子（归属性校验） |
| POST | `/api/posts/:id/comments` | 是 | 发表评论 |
| DELETE | `/api/posts/:id/comments/:cid` | 是 | 删除评论（归属性校验） |
| POST | `/api/posts/:id/like` | 是 | 点赞/取消赞（一人一赞） |

认证方式：请求头 `Authorization: Bearer <token>`

详见 `API_DOC.md`。

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
| Session Token 认证 | middleware/auth.js | 随机 token 签发，需认证接口校验 Authorization 头 |
| 点赞按人限制 | posts.js | 使用 likes 表追踪，每个用户每帖仅可点赞一次 |

### XSS 过滤流程

用户输入: `<script>alert(1)</script> <div onclick="x"> <3`
↓ sanitizeContent() 发送前替换
存入数据库: `＜script＞alert(1)＜/script＞ ＜div @@on_click="x"＞ ＜3`
↓ restoreContent() 显示前恢复
恢复后: `<script>alert(1)</script> <div onclick="x"> <3`
↓ escapeHtml() 渲染转义
浏览器显示: 纯文本，不执行任何代码

### 待实施

- 密码 bcrypt 哈希（当前明文比对，实验环境）

## 技术栈

- 前端：原生 HTML/CSS/JS（无框架）
- 后端：Express 5.x
- 数据库：MySQL + mysql2（连接池）
- 部署架构：Docker + Docker Compose (单容器集成架构)