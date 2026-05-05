# 匿名墙 API 接口文档

**Base URL**: `http://localhost:3000`

## 1. 认证接口 (Auth)
- **POST** `/api/auth/login`
  - 功能：用户登录。
  - 请求体：`{ "username": "student01", "password": "123" }`
  - 成功返回：`{ "code": 200, "user": { "id", "username", "nickname", "avatar" } }`

## 2. 帖子接口 (Posts)
- **GET** `/api/posts`
  - 功能：获取全站帖子及嵌套评论。
- **POST** `/api/posts`
  - 功能：发布帖子。
  - 请求体：`{ "user_id": 1, "content": "帖子内容" }`
- **DELETE** `/api/posts/:postId`
  - 功能：删除帖子。
  - 请求体：`{ "user_id": 1 }` (必须传入当前用户ID用于越权校验)
- **POST** `/api/posts/:postId/like`
  - 功能：点赞/取消赞。
  - 请求体：`{ "action": "like" }`

## 3. 评论接口 (Comments)
- **POST** `/api/posts/:postId/comments`
  - 功能：发布评论。
  - 请求体：`{ "user_id": 1, "text": "评论内容" }`
- **DELETE** `/api/posts/:postId/comments/:commentId`
  - 功能：删除评论。
  - 请求体：`{ "user_id": 1 }` (必须传入当前用户ID用于越权校验)