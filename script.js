(function () {
    // ==================== 核心配置 ====================
    const API_BASE = '/api';
    let currentUser = JSON.parse(localStorage.getItem('wall_current_user')) || null;
    let allPostsData = []; // 在内存中暂存从后端拉取的帖子数据

    // ==================== 统一的网络请求工具 ====================
    async function request(path, options = {}) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || '请求失败');
            return data;
        } catch (err) {
            alert(err.message);
            return null;
        }
    }

    // ==================== DOM 元素 ====================
    const loginPage = document.getElementById('loginPage');
    const profilePage = document.getElementById('profilePage');
    const feedPage = document.getElementById('feedPage');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    // ==================== 工具函数 ====================
    function showPage(pageId) {
        [loginPage, profilePage, feedPage].forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
    }

    function formatTime(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}小时前`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}天前`;
        return new Date(timestamp).toLocaleDateString('zh-CN');
    }

    // 发送前替换：尖括号/引号 → 全角，on*事件 → 标记
    function sanitizeContent(text) {
        if (!text) return '';
        return text
            .replace(/</g, '＜')
            .replace(/>/g, '＞')
            .replace(/"/g, '＂')
            .replace(/'/g, '＇')
            .replace(/\bon(\w+)(\s*=)/gi, '@@on_$1$2');
    }

    // 显示前恢复：全角 → 尖括号/引号，标记 → on*
    function restoreContent(text) {
        if (!text) return '';
        return text
            .replace(/＜/g, '<')
            .replace(/＞/g, '>')
            .replace(/＂/g, '"')
            .replace(/＇/g, "'")
            .replace(/@@on_/gi, 'on');
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text).replace(/[&<>"']/g, match => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return map[match];
        });
    }

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
    }

    // ==================== 核心数据拉取与渲染 ====================
    
    // 刷新数据并更新当前视图
    async function loadDataAndRender() {
        const res = await request('/posts');
        if (res && res.data) {
            allPostsData = res.data;
            if (feedPage.classList.contains('active')) renderFeed();
            if (profilePage.classList.contains('active')) renderProfile();
        }
    }

    // 渲染动态大厅
    function renderFeed() {
        const feedList = document.getElementById('feedList');
        if (!feedList) return;

        feedList.innerHTML = allPostsData.map(post => {
            const timeStr = formatTime(post.timestamp);
            const isOwner = currentUser && post.userId === currentUser.id;
            
            // 为了简化点赞逻辑，前端仅作展示，不记录每个用户的点赞状态历史
            const commentsHtml = post.comments.length === 0 
                ? '<div class="comments-empty">💬 暂无评论，来说两句吧</div>'
                : post.comments.map(c => {
                    const isCommentOwner = currentUser && c.userId === currentUser.id;
                    return `
                        <div class="comment-item">
                            <div class="comment-text">
                                <strong>${escapeHtml(c.user)}</strong>
                                <span style="color:#9f9aaf;font-size:0.7rem;margin-left:4px;">${formatTime(c.timestamp)}</span>
                                <br>${escapeHtml(restoreContent(c.text))}
                            </div>
                            ${isCommentOwner ? `<button class="comment-delete-btn" onclick="window.wallAction.deleteComment(${post.id}, ${c.id})">🗑️ 删除</button>` : ''}
                        </div>
                    `;
                }).join('');

            return `
                <div class="feed-card">
                    <div class="feed-meta"><span>👤 匿名用户</span><span>${timeStr}</span></div>
                    <div class="feed-content">${escapeHtml(restoreContent(post.content))}</div>
                    <div class="feed-actions">
                        <span class="like-action" onclick="window.wallAction.toggleLike(${post.id})">❤️ ${post.likes}</span>
                        <span onclick="document.getElementById('comments-${post.id}').classList.toggle('hidden')">💬 评论(${post.comments.length})</span>
                        ${isOwner ? `<button class="feed-delete-btn" onclick="window.wallAction.deletePost(${post.id})">🗑️ 删除</button>` : ''}
                    </div>
                    <div class="comment-section hidden" id="comments-${post.id}">
                        ${commentsHtml}
                        <div class="comment-input-row">
                            <input type="text" placeholder="说点什么..." id="input-${post.id}" onkeydown="if(event.key==='Enter') window.wallAction.addComment(${post.id})">
                            <button class="add-comment-btn" onclick="window.wallAction.addComment(${post.id})">发送</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 渲染个人面板
    function renderProfile() {
        if (!currentUser) return;

        document.getElementById('profileName').textContent = currentUser.nickname || currentUser.username;
        document.getElementById('profileAvatar').textContent = currentUser.avatar || '🙂';

        const myPosts = allPostsData.filter(p => p.userId === currentUser.id);
        document.getElementById('statPosts').textContent = myPosts.length;
        
        let totalLikes = 0, totalComments = 0;
        myPosts.forEach(p => {
            totalLikes += p.likes;
            totalComments += p.comments.length;
        });
        document.getElementById('statLikes').textContent = totalLikes;
        document.getElementById('statComments').textContent = totalComments;

        const userPostList = document.getElementById('userPostList');
        if (myPosts.length === 0) {
            userPostList.innerHTML = '<li class="empty-hint">📝 暂无帖子</li>';
        } else {
            userPostList.innerHTML = myPosts.map(post => `
                <li class="post-item">
                    <div class="post-item-content">
                        <span>${escapeHtml(restoreContent(post.content.substring(0, 35)))}${post.content.length > 35 ? '...' : ''}</span>
                        <div class="post-item-time">${formatTime(post.timestamp)} · ❤️ ${post.likes} · 💬 ${post.comments.length}</div>
                    </div>
                    <button class="delete-btn" onclick="window.wallAction.deletePost(${post.id})">🗑️</button>
                </li>
            `).join('');
        }
    }

    // ==================== 接口调用动作 (挂载到 window 方便内联事件调用) ====================
    window.wallAction = {
        async toggleLike(postId) {
            if (!currentUser) return alert("请先登录");
            await request(`/posts/${postId}/like`, { method: 'POST', body: JSON.stringify({ action: 'like' }) });
            loadDataAndRender();
        },
        deletePost(postId) {
            showConfirmDialog('确定要删除这条帖子吗？<br><small style="color:#999;">帖子和所有评论将被永久删除</small>', async () => {
                await request(`/posts/${postId}`, { method: 'DELETE' });
                loadDataAndRender();
            });
        },
        async addComment(postId) {
            if (!currentUser) return alert("请先登录");
            const input = document.getElementById(`input-${postId}`);
            const text = input.value.trim();
            if (!text) return;
            
            await request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ text: sanitizeContent(text) }) });
            loadDataAndRender();
        },
        deleteComment(postId, commentId) {
            showConfirmDialog('确定要删除这条评论吗？', async () => {
                await request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
                loadDataAndRender();
            });
        }
    };

    // ==================== 页面事件绑定 ====================

    // 登录事件
    loginBtn.addEventListener('click', async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) return alert('请输入用户名和密码');

        const res = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (res && res.code === 200) {
            currentUser = res.user;
            localStorage.setItem('wall_current_user', JSON.stringify(currentUser));
            showPage('feedPage');
            loadDataAndRender();
        }
    });

    passwordInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') loginBtn.click();
    });

    // 发帖事件
    document.getElementById('publishPostBtn')?.addEventListener('click', async () => {
        if (!currentUser) return alert('请先登录');
        const content = document.getElementById('newPostContent').value.trim();
        if (!content) return alert('写点什么吧～');

        await request('/posts', { method: 'POST', body: JSON.stringify({ content: sanitizeContent(content) }) });
        document.getElementById('newPostContent').value = '';
        loadDataAndRender();
    });

    // 导航与退出
    const logout = async () => {
        await request('/auth/logout', { method: 'POST' });
        currentUser = null;
        localStorage.removeItem('wall_current_user');
        showPage('loginPage');
    };
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('logoutFromFeed')?.addEventListener('click', logout);

    document.getElementById('toProfileIcon')?.addEventListener('click', () => { renderProfile(); showPage('profilePage'); });
    document.getElementById('toProfileFromFeed')?.addEventListener('click', () => { renderProfile(); showPage('profilePage'); });
    document.getElementById('backToFeedBtn')?.addEventListener('click', () => { renderFeed(); showPage('feedPage'); });
    document.getElementById('toFeedFromProfile')?.addEventListener('click', () => { renderFeed(); showPage('feedPage'); });

    // ==================== 初始化 ====================
    if (currentUser) {
        showPage('feedPage');
        loadDataAndRender();
    } else {
        showPage('loginPage');
    }
})();