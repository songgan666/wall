(function () {
    // ==================== 存储键名 ====================
    const STORAGE_KEYS = {
        USERS: 'anonymous_wall_users',
        POSTS: 'anonymous_wall_posts',
        CURRENT_USER: 'anonymous_wall_current_user',
        LIKED_POSTS: 'anonymous_wall_liked_posts',
    };

    // ==================== 初始化默认数据 ====================
    function initData() {
        if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
            const defaultUsers = [
                {
                    id: 'u1',
                    username: 'student01',
                    password: '123456',
                    nickname: '校园小助手',
                    email: 'helper@campus.cn',
                    avatar: '?',
                },
                {
                    id: 'u2',
                    username: 'alice',
                    password: '111',
                    nickname: '爱丽丝',
                    email: 'alice@campus.cn',
                    avatar: '?',
                },
            ];
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
        }

        if (!localStorage.getItem(STORAGE_KEYS.POSTS)) {
            const defaultPosts = [
                {
                    id: 'p1',
                    userId: 'u1',
                    content: '今天阳光明媚，心情特别好，想和大家分享一下。早上起床后看到窗外的蓝天，整个人都精神了起来。',
                    timestamp: Date.now() - 600000,
                    likes: 12,
                    likedBy: [],
                    comments: [
                        { id: 'c1', userId: 'u2', user: '匿名用户A', text: '确实，今天天气真不错！', timestamp: Date.now() - 300000 },
                        { id: 'c2', userId: 'u1', user: '匿名用户B', text: '我也出去走了一圈，感觉很舒服。', timestamp: Date.now() - 200000 },
                    ],
                },
                {
                    id: 'p2',
                    userId: 'u2',
                    content: '图书馆新开了咖啡角，推荐大家去试试。',
                    timestamp: Date.now() - 1200000,
                    likes: 8,
                    likedBy: [],
                    comments: [],
                },
            ];
            localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(defaultPosts));
        }
    }
    initData();

    // ==================== 数据读写工具 ====================
    function getUsers() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
    }

    function getPosts() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.POSTS)) || [];
    }

    function savePosts(posts) {
        localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(posts));
    }

    function getCurrentUser() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    }

    function setCurrentUser(user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    }

    function clearCurrentUser() {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }

    // ==================== 点赞状态管理 ====================
    function getLikedPosts() {
        if (!currentUser) return [];
        const key = STORAGE_KEYS.LIKED_POSTS + '_' + currentUser.id;
        return JSON.parse(localStorage.getItem(key)) || [];
    }

    function addLikedPost(postId) {
        if (!currentUser) return;
        const liked = getLikedPosts();
        if (!liked.includes(postId)) {
            liked.push(postId);
            localStorage.setItem(STORAGE_KEYS.LIKED_POSTS + '_' + currentUser.id, JSON.stringify(liked));
        }
    }

    function removeLikedPost(postId) {
        if (!currentUser) return;
        let liked = getLikedPosts();
        liked = liked.filter(id => id !== postId);
        localStorage.setItem(STORAGE_KEYS.LIKED_POSTS + '_' + currentUser.id, JSON.stringify(liked));
    }

    function isPostLiked(postId) {
        return getLikedPosts().includes(postId);
    }

    // ==================== DOM 元素 ====================
    const loginPage = document.getElementById('loginPage');
    const profilePage = document.getElementById('profilePage');
    const feedPage = document.getElementById('feedPage');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    let currentUser = getCurrentUser();

    // ==================== 页面切换 ====================
    function showPage(pageId) {
        [loginPage, profilePage, feedPage].forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    // ==================== 确认弹窗（通用） ====================
    function showConfirmDialog(message, onConfirm) {
        const existing = document.querySelector('.modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <p>${message}</p>
                <div class="modal-buttons">
                    <button class="modal-btn modal-btn-cancel" id="modalCancel">取消</button>
                    <button class="modal-btn modal-btn-confirm" id="modalConfirm">确认删除</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();

        overlay.querySelector('#modalCancel').addEventListener('click', closeModal);
        overlay.querySelector('#modalConfirm').addEventListener('click', () => {
            closeModal();
            if (typeof onConfirm === 'function') onConfirm();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
    }

    // ==================== 删除帖子 ====================
    function deletePost(postId) {
        showConfirmDialog('确定要删除这条帖子吗？<br><small>帖子和所有评论将被永久删除</small>', () => {
            let posts = getPosts();
            posts = posts.filter(p => p.id !== postId);
            savePosts(posts);
            removeLikedPost(postId);
            refreshCurrentView();
        });
    }

    // ==================== 删除评论 ====================
    function deleteComment(postId, commentId) {
        const posts = getPosts();
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const comment = (post.comments || []).find(c => c.id === commentId);
        const commentPreview = comment
            ? comment.text.substring(0, 30) + (comment.text.length > 30 ? '...' : '')
            : '这条评论';

        showConfirmDialog(
            '确定要删除这条评论吗？<br><small>"' + escapeHtml(commentPreview) + '"</small>',
            () => {
                let posts = getPosts();
                const post = posts.find(p => p.id === postId);
                if (post && post.comments) {
                    post.comments = post.comments.filter(c => c.id !== commentId);
                    savePosts(posts);
                    refreshCurrentView();
                }
            }
        );
    }

    // ==================== 清空当前用户所有帖子 ====================
    function deleteAllUserPosts() {
        if (!currentUser) return;
        const posts = getPosts();
        const userPosts = posts.filter(p => p.userId === currentUser.id);
        if (userPosts.length === 0) {
            alert('你还没有发布过帖子');
            return;
        }
        showConfirmDialog(
            '确定要清空你的所有帖子吗？<br><small>共 ' + userPosts.length + ' 条帖子将被删除</small>',
            () => {
                let posts = getPosts();
                const userPostIds = posts.filter(p => p.userId === currentUser.id).map(p => p.id);
                posts = posts.filter(p => p.userId !== currentUser.id);
                savePosts(posts);
                userPostIds.forEach(id => removeLikedPost(id));
                refreshCurrentView();
            }
        );
    }

    // ==================== 刷新视图 ====================
    function refreshCurrentView() {
        if (profilePage.classList.contains('active')) {
            renderProfile();
        }
        if (feedPage.classList.contains('active')) {
            renderFeed();
        }
    }

    // ==================== 点赞切换 ====================
    function toggleLike(postId) {
        if (!currentUser) {
            alert('请先登录');
            return;
        }
        let posts = getPosts();
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        if (!post.likedBy) post.likedBy = [];

        if (isPostLiked(postId)) {
            post.likes = Math.max(0, (post.likes || 0) - 1);
            post.likedBy = post.likedBy.filter(uid => uid !== currentUser.id);
            removeLikedPost(postId);
        } else {
            post.likes = (post.likes || 0) + 1;
            if (!post.likedBy.includes(currentUser.id)) {
                post.likedBy.push(currentUser.id);
            }
            addLikedPost(postId);
        }
        savePosts(posts);
        refreshCurrentView();
    }

    // ==================== 渲染个人面板 ====================
    function renderProfile() {
        if (!currentUser) return;

        document.getElementById('profileName').textContent = currentUser.nickname || currentUser.username;
        document.getElementById('profileEmail').textContent = currentUser.email || '未设置邮箱';
        document.getElementById('profileAvatar').textContent = currentUser.avatar || '?';

        const posts = getPosts();
        const userPosts = posts.filter(p => p.userId === currentUser.id);

        document.getElementById('statPosts').textContent = userPosts.length;

        let totalLikes = 0;
        let totalComments = 0;
        userPosts.forEach(p => {
            totalLikes += p.likes || 0;
            totalComments += (p.comments && p.comments.length) || 0;
        });
        document.getElementById('statLikes').textContent = totalLikes;
        document.getElementById('statComments').textContent = totalComments;

        const userPostList = document.getElementById('userPostList');
        if (userPosts.length === 0) {
            userPostList.innerHTML = '<li class="empty-hint">暂无帖子</li>';
        } else {
            const sorted = [...userPosts].sort((a, b) => b.timestamp - a.timestamp);
            userPostList.innerHTML = sorted.map(post => {
                const timeStr = formatTime(post.timestamp);
                const commentCount = (post.comments && post.comments.length) || 0;
                return `
                    <li class="post-item">
                        <div class="post-item-content">
                            <span>${escapeHtml(post.content.substring(0, 35))}${post.content.length > 35 ? '...' : ''}</span>
                            <div class="post-item-time">${timeStr} | 赞 ${post.likes || 0} | 评论 ${commentCount}</div>
                        </div>
                        <button class="delete-btn" data-postid="${post.id}" title="删除此帖">删除</button>
                    </li>
                `;
            }).join('');

            userPostList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    deletePost(this.getAttribute('data-postid'));
                });
            });
        }
    }

    // ==================== 渲染帖子动态 ====================
    function renderFeed() {
        const posts = getPosts();
        const feedList = document.getElementById('feedList');
        if (!feedList) return;

        const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);

        feedList.innerHTML = sortedPosts.map(post => {
            const timeStr = formatTime(post.timestamp);
            const commentCount = (post.comments || []).length;
            const isOwner = currentUser && post.userId === currentUser.id;
            const liked = currentUser && isPostLiked(post.id);
            const likeClass = liked ? 'like-action liked' : 'like-action';
            const likeText = liked ? '已赞' : '点赞';

            // 渲染评论列表
            const commentsList = (post.comments || []);
            let commentsHtml = '';
            if (commentsList.length === 0) {
                commentsHtml = '<div class="comments-empty">暂无评论</div>';
            } else {
                commentsHtml = commentsList.map(comment => {
                    const isCommentOwner = currentUser && comment.userId === currentUser.id;
                    const isPostOwner = currentUser && post.userId === currentUser.id;
                    const canDeleteComment = isCommentOwner || isPostOwner;
                    const commentTime = formatTime(comment.timestamp || post.timestamp);
                    return `
                        <div class="comment-item">
                            <div class="comment-text">
                                <strong>${escapeHtml(comment.user)}</strong>
                                <span style="color:#999;font-size:0.7rem;margin-left:4px;">${commentTime}</span>
                                <br>${escapeHtml(comment.text)}
                            </div>
                            ${canDeleteComment ? `
                                <button class="comment-delete-btn"
                                    data-postid="${post.id}"
                                    data-commentid="${comment.id}"
                                    title="删除评论">
                                    删除
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('');
            }

            return `
                <div class="feed-card" data-postid="${post.id}">
                    <div class="feed-meta">
                        <span>匿名用户</span>
                        <span>${timeStr}</span>
                    </div>
                    <div class="feed-content">${escapeHtml(post.content)}</div>
                    <div class="feed-actions">
                        <span class="${likeClass}" data-postid="${post.id}">
                            ${likeText} <span class="like-count">${post.likes || 0}</span>
                        </span>
                        <span class="comment-toggle" data-postid="${post.id}">
                            评论(<span class="comment-count">${commentCount}</span>)
                        </span>
                        ${isOwner ? `
                            <button class="feed-delete-btn" data-postid="${post.id}" title="删除帖子">删除</button>
                        ` : ''}
                    </div>
                    <div class="comment-section hidden" id="comments-${post.id}">
                        ${commentsHtml}
                        <div class="comment-input-row">
                            <input type="text" placeholder="说点什么..." class="comment-input" data-postid="${post.id}" maxlength="200">
                            <button class="add-comment-btn" data-postid="${post.id}">发送</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // ========== 绑定所有事件 ==========

        // 1. 评论展开/收起
        feedList.querySelectorAll('.comment-toggle').forEach(el => {
            el.addEventListener('click', function () {
                const postId = this.getAttribute('data-postid');
                const section = document.getElementById('comments-' + postId);
                if (section) section.classList.toggle('hidden');
            });
        });

        // 2. 点赞切换
        feedList.querySelectorAll('.like-action').forEach(el => {
            el.addEventListener('click', function () {
                toggleLike(this.getAttribute('data-postid'));
            });
        });

        // 3. 添加评论
        feedList.querySelectorAll('.add-comment-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                if (!currentUser) {
                    alert('请先登录后再评论');
                    return;
                }
                const postId = this.getAttribute('data-postid');
                const input = feedList.querySelector('.comment-input[data-postid="' + postId + '"]');
                if (!input) return;

                const text = input.value.trim();
                if (!text) {
                    alert('请输入评论内容');
                    return;
                }
                if (text.length > 200) {
                    alert('评论不能超过200字');
                    return;
                }

                const posts = getPosts();
                const post = posts.find(p => p.id === postId);
                if (post) {
                    if (!post.comments) post.comments = [];
                    post.comments.push({
                        id: 'c' + Date.now(),
                        userId: currentUser.id,
                        user: '匿名用户',
                        text: text,
                        timestamp: Date.now(),
                    });
                    savePosts(posts);
                    renderFeed();
                }
            });
        });

        // 4. 删除帖子（动态列表中的）
        feedList.querySelectorAll('.feed-delete-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                deletePost(this.getAttribute('data-postid'));
            });
        });

        // 5. 删除评论
        feedList.querySelectorAll('.comment-delete-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const postId = this.getAttribute('data-postid');
                const commentId = this.getAttribute('data-commentid');
                deleteComment(postId, commentId);
            });
        });

        // 6. 评论输入框回车发送
        feedList.querySelectorAll('.comment-input').forEach(input => {
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const postId = this.getAttribute('data-postid');
                    const btn = feedList.querySelector('.add-comment-btn[data-postid="' + postId + '"]');
                    if (btn) btn.click();
                }
            });
        });
    }

    // ==================== 格式化时间 ====================
    function formatTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return minutes + '分钟前';
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + '小时前';
        const days = Math.floor(hours / 24);
        if (days < 30) return days + '天前';
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    // ==================== HTML 转义 ====================
    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ==================== 发布新帖子 ====================
    function publishPost() {
        if (!currentUser) {
            alert('请先登录');
            showPage('loginPage');
            return;
        }
        const content = document.getElementById('newPostContent').value.trim();
        if (!content) {
            alert('写点什么吧');
            return;
        }
        if (content.length > 500) {
            alert('帖子内容不能超过500字');
            return;
        }
        const posts = getPosts();
        posts.push({
            id: 'p' + Date.now(),
            userId: currentUser.id,
            content: content,
            timestamp: Date.now(),
            likes: 0,
            likedBy: [],
            comments: [],
        });
        savePosts(posts);
        document.getElementById('newPostContent').value = '';
        renderFeed();
        if (profilePage.classList.contains('active')) renderProfile();
    }

    // ==================== 登录逻辑 ====================
    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) {
            alert('请输入用户名和密码');
            return;
        }
        const user = getUsers().find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = user;
            setCurrentUser(user);
            showPage('feedPage');
            renderFeed();
        } else {
            alert('用户名或密码错误');
        }
    });

    passwordInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // ==================== 退出登录 ====================
    function logout() {
        clearCurrentUser();
        currentUser = null;
        showPage('loginPage');
        usernameInput.value = '';
        passwordInput.value = '';
    }

    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('logoutFromFeed')?.addEventListener('click', logout);

    // ==================== 页面导航 ====================
    function goToProfile() {
        if (!currentUser) {
            alert('请先登录');
            showPage('loginPage');
            return;
        }
        renderProfile();
        showPage('profilePage');
    }

    document.getElementById('toProfileIcon')?.addEventListener('click', goToProfile);
    document.getElementById('toProfileFromFeed')?.addEventListener('click', goToProfile);

    document.getElementById('backToFeedBtn')?.addEventListener('click', () => {
        renderFeed();
        showPage('feedPage');
    });

    document.getElementById('toFeedFromProfile')?.addEventListener('click', () => {
        renderFeed();
        showPage('feedPage');
    });

    document.getElementById('publishPostBtn')?.addEventListener('click', publishPost);
    document.getElementById('deleteAllPostsBtn')?.addEventListener('click', deleteAllUserPosts);

    document.getElementById('forgotLink')?.addEventListener('click', () =>
        alert('演示模式：请使用 student01 / 123456')
    );

    document.getElementById('registerLink')?.addEventListener('click', () =>
        alert('注册功能将在后续版本添加')
    );

    // ==================== 初始加载 ====================
    if (currentUser) {
        showPage('feedPage');
        renderFeed();
    } else {
        showPage('loginPage');
    }
})();