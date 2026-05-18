# 匿名墙 API 接口文档

**Base URL**: `http://localhost:3000`

**认证方式**：需认证的接口在请求头携带 `Authorization: Bearer <token>`，token 由登录/注册接口返回。

---

## 1. 认证接口 (Auth)

- **POST** `/api/auth/register`
  - 认证：否
  - 请求体：`{ "username": "newuser", "password": "123" }`
  - 成功返回：`{ "code": 201, "message": "注册成功", "token": "<token>", "user": { "id": 4, "username": "newuser", "nickname": "newuser" } }`
  - 错误码：400（参数不合法）、409（用户名已存在）

- **POST** `/api/auth/login`
  - 认证：否
  - 请求体：`{ "username": "student01", "password": "123456" }`
  - 成功返回：`{ "code": 200, "message": "登录成功", "token": "<token>", "user": { "id": 1, "username": "student01", "nickname": "校园小助手" } }`
  - 错误码：401（用户名或密码错误）

- **POST** `/api/auth/logout`
  - 认证：是
  - 功能：销毁当前 token，登出后需重新登录。

---

## 2. 帖子接口 (Posts)

- **GET** `/api/posts`
  - 认证：否（携带 token 时返回每帖的 `liked` 状态）
  - 成功返回：`{ "code": 200, "data": [{ "id": 1, "userId": 1, "content": "...", "timestamp": 1714320000000, "likes": 3, "liked": true, "comments": [...] }] }`

- **POST** `/api/posts`
  - 认证：是
  - 请求体：`{ "content": "帖子内容" }`
  - 成功返回：`{ "code": 200, "message": "发布成功", "data": { "id": 5 } }`

- **DELETE** `/api/posts/:postId`
  - 认证：是
  - 功能：删除帖子（仅限帖主本人）
  - 错误码：403（无权删除）

- **POST** `/api/posts/:postId/like`
  - 认证：是
  - 功能：点赞/取消赞（切换），每人每帖限一赞
  - 请求体：无
  - 成功返回：`{ "code": 200, "message": "点赞成功", "liked": true }` 或 `{ "code": 200, "message": "取消点赞", "liked": false }`

---

## 3. 评论接口 (Comments)

- **POST** `/api/posts/:postId/comments`
  - 认证：是
  - 请求体：`{ "text": "评论内容" }`
  - 成功返回：`{ "code": 200, "message": "评论成功", "data": { "id": 10 } }`

- **DELETE** `/api/posts/:postId/comments/:commentId`
  - 认证：是
  - 功能：删除评论（仅限评论者本人）
  - 错误码：403（无权删除）
