export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 工具函数：鉴权
        const checkAdmin = () => request.headers.get('x-admin-key') === env.ADMIN_SECRET;

        // ============================================================
        // 路由: 极速验证 /verify
        // ============================================================
        if (path === '/verify') {
            const uuid = url.searchParams.get('uuid');
            if (!uuid) return new Response('Missing UUID', { status: 400 });

            // 1. 准备时间参数
            const now = Date.now();
            const currentBeijingDate = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
            }).format(new Date());

            // ---------------------------------------------------------
            // [特殊规则配置区]
            // ---------------------------------------------------------
            let dailyLimit = 50;        // 默认每日 50 次
            let expirationMs = 31536000000; // 默认 1 年 (365天)

            // 规则 A: 指定 UUID 修改为 300 次
            if (uuid === 'fenguois-5f28-4bd9-b181-cc030851daba') {
                dailyLimit = 300;
            }

            // 规则 B: 之前提到的特殊 UUID 设置为 2年/35次
            if (uuid === 'fenguois-custom-35-2y') {
                dailyLimit = 35;
                expirationMs = 63072000000; // 2 年
            }
            // ---------------------------------------------------------

            // 2. [核心优化] 尝试“一击必杀”更新
            const result = await env.DB.prepare(`
        UPDATE licenses
        SET 
          daily_count = CASE 
            WHEN last_reset_date != ?2 THEN 1 
            ELSE daily_count + 1 
          END,
          last_reset_date = ?2,
          activated_at = COALESCE(activated_at, ?1) 
        WHERE uuid = ?3
          AND (activated_at IS NULL OR (?1 - activated_at) <= ?4) -- 动态过期时长
          AND (last_reset_date != ?2 OR daily_count < ?5)        -- 动态每日限额
        RETURNING id, uuid, daily_count, activated_at
      `).bind(now, currentBeijingDate, uuid, expirationMs, dailyLimit).first();

            // 3. [Happy Path] 验证成功
            if (result) {
                return new Response(JSON.stringify({
                    valid: true,
                    id: result.id,
                    uuid: result.uuid,
                    remaining_today: dailyLimit - result.daily_count, // 基于动态限额计算
                    uu: env.UU_VALUE || "aHR0cHM6Ly9kb3V5aW4tdmVyc2lvbi5wYWdlcy5kZXYvdXBkYXRhL2luc2lnYXBpa2V5Lmpzb24=",
                    expires_at: new Date(result.activated_at + expirationMs).toISOString()
                }), { headers: { 'content-type': 'application/json' } });
            }

            // 4. [Sad Path] 失败原因排查
            const check = await env.DB.prepare('SELECT * FROM licenses WHERE uuid = ?').bind(uuid).first();

            if (!check) {
                return new Response(JSON.stringify({ valid: false, reason: 'UUID not found' }), { status: 404 });
            }

            // 动态检查过期
            if (check.activated_at && (now - check.activated_at > expirationMs)) {
                return new Response(JSON.stringify({ valid: false, reason: 'Expired' }), { status: 403 });
            }

            // 动态检查次数
            let currentCount = (check.last_reset_date === currentBeijingDate) ? check.daily_count : 0;
            if (currentCount >= dailyLimit) {
                return new Response(JSON.stringify({
                    valid: false,
                    reason: 'Daily limit reached',
                    limit: dailyLimit
                }), { status: 429 });
            }

            return new Response(JSON.stringify({ valid: false, reason: 'Unknown error' }), { status: 500 });
        }

        // ============================================================
        // 管理路由组
        // ============================================================
        if (path === '/admin/generate' && request.method === 'POST') {
            if (!checkAdmin()) return new Response('Forbidden', { status: 403 });

            const BATCH_SIZE = 50;
            let generatedCount = 0;
            for (let i = 0; i < 3000; i += BATCH_SIZE) {
                const statements = [];
                for (let j = 0; j < BATCH_SIZE; j++) {
                    const customUuid = "fenguois" + crypto.randomUUID().substring(8);
                    statements.push(env.DB.prepare('INSERT INTO licenses (uuid) VALUES (?)').bind(customUuid));
                }
                await env.DB.batch(statements);
                generatedCount += statements.length;
            }
            return new Response(JSON.stringify({ success: true, count: generatedCount }));
        }

        if (path === '/admin/add' && request.method === 'POST') {
            if (!checkAdmin()) return new Response('Forbidden', { status: 403 });
            const customUuid = "fenguois" + crypto.randomUUID().substring(8);
            const res = await env.DB.prepare('INSERT INTO licenses (uuid) VALUES (?) RETURNING id, uuid').bind(customUuid).first();
            return new Response(JSON.stringify({ success: true, data: res }));
        }

        if (path === '/admin/delete' && request.method === 'POST') {
            if (!checkAdmin()) return new Response('Forbidden', { status: 403 });
            const tUuid = url.searchParams.get('uuid');
            await env.DB.prepare('DELETE FROM licenses WHERE uuid = ?').bind(tUuid).run();
            return new Response(JSON.stringify({ success: true }));
        }

        return new Response('Running (Custom Rules Optimized)', { status: 200 });
    }
};