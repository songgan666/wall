/**
 * sqlGuard.js — SQL 注入检测中间件
 *
 * 【防御层 2】基于正则模式匹配的 SQL 注入攻击检测。
 *
 * 本中间件在请求到达路由处理函数之前，扫描所有入站数据
 * （body、query 参数、URL 参数、Authorization 头）中是否
 * 包含已知的 SQL 注入攻击模式。
 *
 * 重要说明：这是 SECONDARY 防御层。PRIMARY 防御层是参数化
 * 查询（db.execute() with ? 占位符）。本中间件用于捕获因
 * 配置错误、未来代码变更或 mysql2 驱动未知漏洞而可能绕过
 * 参数化查询的攻击。
 *
 * 检测到攻击时：
 *   - 立即返回 HTTP 403（请求不会到达路由处理函数）
 *   - 将攻击尝试记录到控制台，用于安全审计
 *   - 响应中包含检测到的攻击模式名称（便于教学）
 */

// ============================================================
// SQL 注入攻击模式注册表
// ============================================================
const SQL_INJECTION_PATTERNS = [
    {
        name: 'SQL Tautology (OR =)',
        regex: /('|")\s*OR\s+['"]?\s*=\s*['"]?/i,
        severity: 'HIGH',
        description: '经典永真式绕过：WHERE username=\'\' OR \'1\'=\'1\''
    },
    {
        name: 'UNION SELECT Injection',
        regex: /\bUNION\s+(ALL\s+)?SELECT\b/i,
        severity: 'HIGH',
        description: '尝试使用 UNION 合并查询结果以窃取其他表数据'
    },
    {
        name: 'SQL Statement Chaining',
        regex: /;\s*(DROP|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|ALTER\s+TABLE|CREATE\s+TABLE|TRUNCATE|EXEC)\s+/i,
        severity: 'CRITICAL',
        description: '尝试通过分号链式执行破坏性 SQL 命令'
    },
    {
        name: 'Comment-based SQL Termination',
        regex: /'\s*--\s*$/im,
        severity: 'MEDIUM',
        description: '使用 -- 注释掉原始查询的剩余部分'
    },
    {
        name: 'Time-based Blind Injection (SLEEP)',
        regex: /\bSLEEP\s*\(/i,
        severity: 'HIGH',
        description: '使用 SLEEP() 函数进行基于时间的盲注攻击'
    },
    {
        name: 'Time-based Blind Injection (BENCHMARK)',
        regex: /\bBENCHMARK\s*\(/i,
        severity: 'HIGH',
        description: '使用 BENCHMARK() 函数进行基于时间的盲注攻击'
    },
    {
        name: 'Database Schema Enumeration',
        regex: /\bINFORMATION_SCHEMA\b/i,
        severity: 'MEDIUM',
        description: '尝试枚举数据库结构（表名、列名等）'
    },
    {
        name: 'File System Access',
        regex: /\b(LOAD_FILE|INTO\s+(OUT|DUMP)FILE|xp_cmdshell)\b/i,
        severity: 'CRITICAL',
        description: '尝试读写服务器文件或执行系统命令'
    },
    {
        name: 'Stacked Queries Marker',
        regex: /'\s*;\s*$/im,
        severity: 'LOW',
        description: '可能的语句终止并尝试堆叠另一个查询'
    },
];

// ============================================================
// 扫描函数
// ============================================================

/**
 * 扫描单个字符串值，检测是否包含 SQL 注入攻击模式
 *
 * @param {*} value - 待检测的值（非字符串类型会被直接跳过）
 * @param {string} context - 值的来源上下文（如 "body.username"）
 * @returns {object|null} 检测到攻击时返回 { name, severity, context, value }，否则 null
 */
function scanValue(value, context) {
    if (!value || typeof value !== 'string') return null;

    for (const entry of SQL_INJECTION_PATTERNS) {
        if (entry.regex.test(value)) {
            return {
                name: entry.name,
                severity: entry.severity,
                description: entry.description,
                context,
                value: value.substring(0, 150), // 截断用于日志可读性
            };
        }
    }
    return null;
}

/**
 * 遍历对象的每个键值对，检测是否有任意值包含 SQL 注入模式
 *
 * @param {object} obj - 待扫描的对象（如 req.body）
 * @param {string} sourceName - 对象来源名称（如 "body"）
 * @returns {object|null} 检测到攻击时返回匹配信息，否则 null
 */
function scanObject(obj, sourceName) {
    if (!obj || typeof obj !== 'object') return null;

    for (const [key, value] of Object.entries(obj)) {
        // 若值为嵌套对象（如 JSON 中的嵌套结构），递归扫描
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const hit = scanObject(value, `${sourceName}.${key}`);
            if (hit) return hit;
        }
        // 扫描基本类型值
        const hit = scanValue(String(value), `${sourceName}.${key}`);
        if (hit) return hit;
    }
    return null;
}

// ============================================================
// 主中间件导出
// ============================================================
function sqlGuardMiddleware(req, res, next) {
    // 1. 扫描 Authorization 请求头（auth 中间件用于 token 查询）
    //    攻击者可能在 token 中注入 SQL 以绕过认证
    const authHit = scanValue(req.headers.authorization, 'headers.Authorization');
    if (authHit) {
        console.warn(
            `[SQL-GUARD] BLOCKED | ${authHit.severity} | ${authHit.name} ` +
            `| IP: ${req.ip} | Source: ${authHit.context} | ` +
            `Payload: "${authHit.value}"`
        );
        return res.status(403).json({
            code: 403,
            message: `请求被 SQL 注入防护拦截。检测到: ${authHit.name}`,
            guard: 'sqlGuard',
            layer: 2,
            hint: '在请求头中检测到 SQL 注入攻击模式，已阻止此请求。'
        });
    }

    // 2. 扫描 URL 查询参数（req.query）
    const queryHit = scanObject(req.query, 'query');
    if (queryHit) {
        console.warn(
            `[SQL-GUARD] BLOCKED | ${queryHit.severity} | ${queryHit.name} ` +
            `| IP: ${req.ip} | Source: ${queryHit.context} | ` +
            `Payload: "${queryHit.value}"`
        );
        return res.status(403).json({
            code: 403,
            message: `请求被 SQL 注入防护拦截。检测到: ${queryHit.name}`,
            guard: 'sqlGuard',
            layer: 2,
            hint: '在 URL 查询参数中检测到 SQL 注入攻击模式，已阻止此请求。'
        });
    }

    // 3. 扫描 URL 路由参数（req.params，如 :postId）
    const paramsHit = scanObject(req.params, 'params');
    if (paramsHit) {
        console.warn(
            `[SQL-GUARD] BLOCKED | ${paramsHit.severity} | ${paramsHit.name} ` +
            `| IP: ${req.ip} | Source: ${paramsHit.context} | ` +
            `Payload: "${paramsHit.value}"`
        );
        return res.status(403).json({
            code: 403,
            message: `请求被 SQL 注入防护拦截。检测到: ${paramsHit.name}`,
            guard: 'sqlGuard',
            layer: 2,
            hint: '在 URL 路径参数中检测到 SQL 注入攻击模式，已阻止此请求。'
        });
    }

    // 4. 扫描请求体（req.body — 已被 express.json() 解析）
    const bodyHit = scanObject(req.body, 'body');
    if (bodyHit) {
        console.warn(
            `[SQL-GUARD] BLOCKED | ${bodyHit.severity} | ${bodyHit.name} ` +
            `| IP: ${req.ip} | Source: ${bodyHit.context} | ` +
            `Payload: "${bodyHit.value}"`
        );
        return res.status(403).json({
            code: 403,
            message: `请求被 SQL 注入防护拦截。检测到: ${bodyHit.name}`,
            guard: 'sqlGuard',
            layer: 2,
            hint: '在请求体中检测到 SQL 注入攻击模式，已阻止此请求。'
        });
    }

    // 5. 未检测到威胁 — 放行至下一个中间件/路由
    next();
}

module.exports = sqlGuardMiddleware;
