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

            // 2. [核心优化] 获取最新状态并同时尝试更新
            // 采用直接利用 DB 表中内置的 max_daily_count 和 term_ms
            // 注意：绑定的参数必须与 SQL 中的 ? 序号完美对应
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
          AND (activated_at IS NULL OR (?1 - activated_at) <= term_ms)
          AND (last_reset_date != ?2 OR daily_count < max_daily_count)
        RETURNING id, uuid, daily_count, activated_at, max_daily_count, term_ms
      `).bind(now, currentBeijingDate, uuid).first();

            // 3. [Happy Path] 验证成功
            if (result) {
                return new Response(JSON.stringify({
                    valid: true,
                    id: result.id,
                    uuid: result.uuid,
                    remaining_today: result.max_daily_count - result.daily_count,
                    uu: env.UU_VALUE || "aHR0cHM6Ly9kb3V5aW4tdmVyc2lvbi5wYWdlcy5kZXYvdXBkYXRhL2luc2lnYXBpa2V5Lmpzb24=",
                    expires_at: new Date(result.activated_at + result.term_ms).toISOString()
                }), { headers: { 'content-type': 'application/json' } });
            }

            // 4. [Sad Path] 失败原因排查 (走到这里证明 UPDATE 失效了，需要查明原因是过期、死码还是次数用尽)
            const check = await env.DB.prepare('SELECT * FROM licenses WHERE uuid = ?').bind(uuid).first();

            if (!check) {
                return new Response(JSON.stringify({ valid: false, reason: 'UUID not found' }), { status: 404 });
            }

            // 检查过期 (使用 DB 内的 term_ms)
            if (check.activated_at && (now - check.activated_at > check.term_ms)) {
                return new Response(JSON.stringify({ valid: false, reason: 'Expired' }), { status: 403 });
            }

            // 检查次数 (使用 DB 内的 max_daily_count)
            let currentCount = (check.last_reset_date === currentBeijingDate) ? check.daily_count : 0;
            if (currentCount >= check.max_daily_count) {
                return new Response(JSON.stringify({
                    valid: false,
                    reason: 'Daily limit reached',
                    limit: check.max_daily_count
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