/**
 * 共享 Supabase 客户端
 * 提供 REST API 封装和 WebSocket 实时订阅，前台和后台共用
 */
(function () {
  'use strict';

  // ==================== 配置 ====================

  var CONFIG = {
    supabaseUrl: window.__SUPABASE_URL__ || 'https://qlkmuluomqxdqoubcois.supabase.co',
    supabaseKey: window.__SUPABASE_ANON_KEY__ || 'sb_publishable_c5fdSNqyifdWhMX_dM_Zdg__4xFjQvf',
  };

  var isConfigured = CONFIG.supabaseUrl && CONFIG.supabaseKey && CONFIG.supabaseUrl !== 'YOUR_SUPABASE_URL';

  // ==================== REST API 封装 ====================

  function buildHeaders(extra) {
    var headers = {
      'Content-Type': 'application/json',
      'apikey': CONFIG.supabaseKey,
      'Authorization': 'Bearer ' + CONFIG.supabaseKey,
    };
    if (extra) Object.assign(headers, extra);
    return headers;
  }

  function restUrl(table, params) {
    var base = CONFIG.supabaseUrl + '/rest/v1/' + table;
    if (params) {
      var qs = typeof params === 'string' ? params : buildQueryString(params);
      base += '?' + qs;
    }
    return base;
  }

  function buildQueryString(params) {
    return Object.entries(params).map(function (e) {
      return encodeURIComponent(e[0]) + '=' + encodeURIComponent(e[1]);
    }).join('&');
  }

  function safeError(error) {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  async function restQuery(table, params) {
    if (!isConfigured) return [];
    var url = restUrl(table, params);
    var res = await fetch(url, { headers: buildHeaders() });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || '查询失败 HTTP ' + res.status);
    }
    return res.json();
  }

  async function restInsert(table, rows) {
    if (!isConfigured) return;
    var url = restUrl(table);
    var res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || '插入失败 HTTP ' + res.status);
    }
    return res.json();
  }

  async function restUpsert(table, rows) {
    if (!isConfigured) return;
    var url = restUrl(table);
    var res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders({
        'Prefer': 'return=representation,resolution=merge-duplicates',
      }),
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || 'Upsert 失败 HTTP ' + res.status);
    }
    return res.json();
  }

  async function restUpdate(table, id, data) {
    if (!isConfigured) return;
    var url = restUrl(table, 'id=eq.' + encodeURIComponent(id));
    var res = await fetch(url, {
      method: 'PATCH',
      headers: buildHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || '更新失败 HTTP ' + res.status);
    }
    return res.json();
  }

  async function restDelete(table, id) {
    if (!isConfigured) return;
    var url = restUrl(table, 'id=eq.' + encodeURIComponent(id));
    var res = await fetch(url, {
      method: 'DELETE',
      headers: buildHeaders({ 'Prefer': 'return=representation' }),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      throw new Error(err.message || '删除失败 HTTP ' + res.status);
    }
    return res.json();
  }

  // ==================== WebSocket 实时订阅 ====================

  function wsSubscribe(table, callback) {
    if (!isConfigured) return;

    var reconnectAttempts = 0;
    var maxDelay = 30000;

    function connect() {
      // Realtime 鉴权要求：apikey 与协议版本必须放在 URL 查询串，
      // 否则服务端直接拒绝连接（表现为 "HTTP Authentication failed"）。
      var wsUrl = CONFIG.supabaseUrl.replace('https://', 'wss://').replace('http://', 'ws://')
        + '/realtime/v1/websocket?apikey=' + encodeURIComponent(CONFIG.supabaseKey) + '&vsn=1.0.0';

      var ws = new WebSocket(wsUrl);
      var heartbeatTimer = null;

      ws.onopen = function () {
        reconnectAttempts = 0;
        // 订阅该表的所有变更；access_token 必带，供 RLS 鉴权
        ws.send(JSON.stringify({
          event: 'phx_join',
          topic: 'realtime:' + table,
          payload: {
            access_token: CONFIG.supabaseKey,
            config: {
              postgres_changes: [{
                event: '*',
                schema: 'public',
                table: table,
              }],
            },
          },
          ref: '1',
        }));
        // 心跳：每 25s 发一次，防止服务端因空闲（约 60s）主动断开
        heartbeatTimer = setInterval(function () {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }));
          }
        }, 25000);
      };

      ws.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          // 数据库变更事件：记录位于 payload.data.record（INSERT/UPDATE 为新行，
          // DELETE 时 record 为空、old_record 为旧行）。
          if (data.event === 'postgres_changes' && data.payload && data.payload.data) {
            callback(data.payload.data.record, data.payload.data);
          }
        } catch (e) {
          // 忽略非 JSON / 无关消息
        }
      };

      ws.onerror = function () {};

      ws.onclose = function () {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
        var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxDelay);
        reconnectAttempts++;
        setTimeout(connect, delay);
      };
    }

    connect();
  }

  // ==================== 公开 API ====================

  window.SupabaseClient = {
    getConfig: function () {
      return { supabaseUrl: CONFIG.supabaseUrl, supabaseKey: CONFIG.supabaseKey, isConfigured: isConfigured };
    },
    restQuery: restQuery,
    restInsert: restInsert,
    restUpsert: restUpsert,
    restUpdate: restUpdate,
    restDelete: restDelete,
    wsSubscribe: wsSubscribe,
    isConfigured: isConfigured,
  };
})();
