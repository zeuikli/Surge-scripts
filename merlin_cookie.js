const $ = new Env("Merlin");
const SESSION_COOKIE = "__Secure-authjs.session-token";
const REGISTER_URL = "https://merlin.2ac.io/register";

if (typeof $argument !== "undefined" && $argument.includes("panel=true")) {
    showPanel();
} else if (typeof $response !== "undefined") {
    captureRegisterResponse();
} else {
    captureSession();
}

function captureSession() {
    const cookieHeader = $request.headers['Cookie'] || $request.headers['cookie'];
    if (!cookieHeader) { $.done({}); return; }

    const sessionToken = extractSessionToken(cookieHeader);
    if (!sessionToken) { $.done({}); return; }

    if (sessionToken === $.getdata("merlin_session_token")) {
        $.done({});
        return;
    }

    $.setdata(sessionToken, "merlin_session_token");
    $.setdata("", "merlin_api_token");
    console.log("Merlin: 新 Session Token 已儲存，開始向 merlin.2ac.io 換取 API Token...");

    autoRegister(sessionToken);
}

function extractSessionToken(cookieHeader) {
    const cookies = {};
    for (const pair of cookieHeader.split(';')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const name = pair.substring(0, eqIdx).trim();
        const value = pair.substring(eqIdx + 1).trim();
        cookies[name] = value;
    }

    // 直接匹配（未分割）
    if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];

    // 處理 NextAuth.js 分割的 chunked cookie：.0, .1, .2 ...
    const chunks = [];
    let i = 0;
    while (cookies[`${SESSION_COOKIE}.${i}`] !== undefined) {
        chunks.push(cookies[`${SESSION_COOKIE}.${i}`]);
        i++;
    }
    return chunks.length > 0 ? chunks.join('') : null;
}

function autoRegister(sessionToken) {
    $.post({
        url: REGISTER_URL,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0"
        },
        body: `token=${encodeURIComponent(sessionToken)}`
    }, (err, resp, data) => {
        if (err || !data) {
            console.log("Merlin: 自動換取失敗:", err);
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
            console.log("Merlin: 無法解析 API Token，原始回應:", data.substring(0, 100));
            $.msg("⚠️ Merlin", "無法解析 API Token 回應", "請手動前往 merlin.2ac.io/register");
        }
        $.done({});
    });
}

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

    // HTML value= attribute
    const valueMatch = raw.match(/value="([A-Za-z0-9_\-\.]{20,})"/);
    if (valueMatch) return valueMatch[1];

    // <code> or <pre> block
    const codeMatch = raw.match(/<(?:code|pre)[^>]*>\s*([A-Za-z0-9_\-\.]{20,})\s*<\/(?:code|pre)>/);
    if (codeMatch) return codeMatch[1];

    // Plain text token
    if (raw.length >= 16 && raw.length <= 512 && !/[\s<>{}\[\]]/.test(raw)) return raw;

    return null;
}

function tryClipboard(text) {
    try {
        if (typeof $utils !== "undefined" && typeof $utils.setClipboard === "function") {
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
        $.done({
            title: "Merlin",
            content: "Session Token 已取得\n但尚未換取 API Token\n\n請重新使用 Merlin 觸發換取",
            icon: "clock.fill",
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

function Env(name) {
    return new (class {
        constructor(name) { this.name = name; }
        msg(title, sub, body, opts) {
            if (typeof $notification !== "undefined") $notification.post(title, sub, body, opts);
        }
        getdata(key) { return typeof $persistentStore !== "undefined" ? $persistentStore.read(key) : null; }
        setdata(val, key) { return typeof $persistentStore !== "undefined" ? $persistentStore.write(val, key) : false; }
        post(opts, cb) { if (typeof $httpClient !== "undefined") $httpClient.post(opts, cb); }
        done(val) { $done(val); }
    })(name);
}
