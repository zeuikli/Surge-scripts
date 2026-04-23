const $ = new Env("Merlin");
const TARGET_COOKIE_NAME = "__Secure-authjs.session-token";
const REGISTER_URL = "https://merlin.2ac.io/register";

// 入口判斷
if (typeof $argument !== "undefined" && $argument.includes("panel=true")) {
    showPanel();
} else if (typeof $response !== "undefined") {
    captureRegisterResponse();
} else {
    captureCookie();
}

function captureCookie() {
    const cookieHeader = $request.headers['Cookie'] || $request.headers['cookie'];

    if (cookieHeader) {
        const regex = new RegExp(`${TARGET_COOKIE_NAME}=([^;]+)`);
        const match = cookieHeader.match(regex);

        if (match && match[1]) {
            const token = match[1];
            const oldToken = $.getdata("merlin_session_token");

            if (token !== oldToken) {
                $.setdata(token, "merlin_session_token");
                $.setdata("", "merlin_api_token");
                console.log("Merlin: Session Token 已更新，開始換取 API Token...");

                // 先嘗試背景複製（讓使用者有 Session Token 可用）
                let copySuccess = false;
                if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
                    try {
                        copySuccess = $utils.setClipboard(token);
                        console.log(`Merlin: 背景複製嘗試 -> ${copySuccess ? "成功" : "被系統攔截"}`);
                    } catch (e) {
                        console.log("Merlin: 背景複製異常 -", e.message);
                    }
                }

                $.msg("⚡️ Merlin", "Session Token 已捕獲，換取 API Token 中...",
                    `前段: ${token.substring(0, 10)}...`,
                    { action: "clipboard", text: token }
                );

                // 非同步換取 API Token，由內部呼叫 $.done({})
                autoRegister(token);
                return;
            } else {
                console.log("Merlin: Token 未變更");
            }
        }
    }
    $.done({});
}

function autoRegister(sessionToken) {
    $.post({
        url: REGISTER_URL,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://merlin.2ac.io",
            "Referer": "https://merlin.2ac.io/register",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8"
        },
        body: `token=${encodeURIComponent(sessionToken)}`
    }, (err, resp, data) => {
        if (err || !data) {
            console.log("Merlin: 換取失敗:", err);
            $.msg("⚠️ Merlin", "自動換取 API Token 失敗", "請手動前往 merlin.2ac.io/register");
            $.done({});
            return;
        }

        const apiToken = parseToken(data);
        if (apiToken) {
            $.setdata(apiToken, "merlin_api_token");
            tryClipboard(apiToken);
            $.msg(
                "✅ Merlin API Token 已取得",
                "👉 點擊此通知以複製",
                apiToken.substring(0, 20) + "...",
                { action: "clipboard", text: apiToken }
            );
        } else {
            const preview = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80);
            console.log("Merlin: 無法解析 API Token，HTTP狀態:", resp && resp.status, "原始回應:", data.substring(0, 200));
            $.msg("⚠️ Merlin 無法解析回應", `HTTP ${resp && resp.status}`, preview);
        }
        $.done({});
    });
}

// 備用：使用者手動開啟 merlin.2ac.io/register 時攔截回應
function captureRegisterResponse() {
    const body = $response.body;
    if (!body) { $.done({}); return; }

    const apiToken = parseToken(body);
    if (apiToken && apiToken !== $.getdata("merlin_api_token")) {
        $.setdata(apiToken, "merlin_api_token");
        tryClipboard(apiToken);
        $.msg(
            "✅ Merlin API Token 已捕獲",
            "👉 點擊複製",
            apiToken.substring(0, 20) + "...",
            { action: "clipboard", text: apiToken }
        );
    }
    $.done({});
}

function parseToken(raw) {
    if (!raw) return null;
    raw = raw.trim();

    try {
        const json = JSON.parse(raw);
        const keys = ["token", "api_token", "apiToken", "key", "api_key", "access_token", "accessToken"];
        for (const k of keys) {
            if (json[k] && typeof json[k] === "string" && json[k].length > 8) return json[k];
        }
        if (json.data) {
            for (const k of keys) {
                if (json.data[k] && typeof json.data[k] === "string") return json.data[k];
            }
        }
    } catch(e) {}

    // JWT
    const jwtMatch = raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (jwtMatch) return jwtMatch[0];

    // UUID
    const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) return uuidMatch[0];

    // HTML: input value= 屬性（含更多字元）
    const valueMatch = raw.match(/value="([A-Za-z0-9_\-\.+\/=:]{20,})"/);
    if (valueMatch) return valueMatch[1];

    // HTML: <code>, <pre>, <p>, <span>, <td> 內的 token 文字
    const htmlTagMatch = raw.match(/<(?:code|pre|p|span|td|div)[^>]*>\s*([A-Za-z0-9_\-\.+\/=:]{20,})\s*<\/(?:code|pre|p|span|td|div)>/);
    if (htmlTagMatch) return htmlTagMatch[1];

    // 純文字 token（放寬字元範圍）
    if (raw.length >= 16 && raw.length <= 512 && !/[\s<>{}\[\]]/.test(raw)) return raw;

    return null;
}

function tryClipboard(text) {
    try {
        if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
            $utils.setClipboard(text);
        }
    } catch(e) {}
}

function showPanel() {
    const apiToken = $.getdata("merlin_api_token");
    const sessionToken = $.getdata("merlin_session_token");

    if (apiToken) {
        tryClipboard(apiToken);
        $.done({
            title: "Merlin API Token ✅",
            content: `${apiToken}\n\n已複製到剪貼簿`,
            icon: "key.fill",
            "icon-color": "#34C759"
        });
    } else if (sessionToken) {
        tryClipboard(sessionToken);
        $.done({
            title: "Merlin Session Token",
            content: `${sessionToken.substring(0, 25)}...\n\n尚未換取 API Token`,
            icon: "doc.on.clipboard.fill",
            "icon-color": "#FF9500"
        });
    } else {
        $.done({
            title: "Merlin",
            content: "尚未取得任何 Token\n請使用瀏覽器登入並使用 Merlin",
            icon: "exclamationmark.triangle.fill",
            "icon-color": "#FF3B30"
        });
    }
}

// --- Env Helper ---
function Env(name) {
    return new (class {
        constructor(name) { this.name = name; }
        msg(title, subtitle, body, opts) {
            if (typeof $notification !== 'undefined') {
                $notification.post(title, subtitle, body, opts);
            } else {
                console.log(`${title} - ${subtitle}`);
            }
        }
        getdata(key) { return (typeof $persistentStore !== 'undefined') ? $persistentStore.read(key) : null; }
        setdata(val, key) { return (typeof $persistentStore !== 'undefined') ? $persistentStore.write(val, key) : false; }
        post(opts, cb) { if (typeof $httpClient !== 'undefined') $httpClient.post(opts, cb); }
        done(val) { $done(val); }
    })(name);
}
