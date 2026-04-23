const $ = new Env("Merlin");
const TARGET_COOKIE_NAME = "__Secure-authjs.session-token";
const REGISTER_URL = "https://merlin.2ac.io/register";

// 入口判斷
if (typeof $argument !== "undefined" && $argument.includes("panel=true")) {
    showPanel();
} else if (typeof $response !== "undefined") {
    captureRegisterResponse();
} else if (typeof $request !== "undefined" && $request.url && $request.url.includes("merlin.2ac.io")) {
    captureCloudflare();
} else {
    captureCookie();
}

// 從 Merlin 請求捕獲 Session Token
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

                let copySuccess = false;
                if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
                    try {
                        copySuccess = $utils.setClipboard(token);
                    } catch (e) {}
                }

                $.msg("⚡️ Merlin", "Session Token 已捕獲，換取 API Token 中...",
                    `前段: ${token.substring(0, 10)}...`,
                    { action: "clipboard", text: token }
                );

                autoRegister(token);
                return;
            } else {
                console.log("Merlin: Token 未變更");
            }
        }
    }
    $.done({});
}

// 捕獲訪問 merlin.2ac.io 時的 Cloudflare cf_clearance cookie
function captureCloudflare() {
    const cookieHeader = $request.headers['Cookie'] || $request.headers['cookie'];
    if (cookieHeader) {
        const match = cookieHeader.match(/cf_clearance=([^;]+)/);
        if (match && match[1]) {
            $.setdata(match[1], "merlin_cf_clearance");
            console.log("Merlin: cf_clearance 已更新");
        }
    }
    $.done({});
}

// 向 merlin.2ac.io/register 換取專用 API Token
function autoRegister(sessionToken) {
    const cfClearance = $.getdata("merlin_cf_clearance");
    const headers = {
        "Content-Type": "application/json",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://merlin.2ac.io",
        "Referer": "https://merlin.2ac.io/register",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:151.0) Gecko/20100101 Firefox/151.0",
        "DNT": "1",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    };
    if (cfClearance) {
        headers["Cookie"] = `cf_clearance=${cfClearance}`;
    }

    $.post({
        url: REGISTER_URL,
        headers: headers,
        body: JSON.stringify({ sessionToken: sessionToken })
    }, (err, resp, data) => {
        if (err || !data) {
            console.log("Merlin: 換取失敗:", err);
            $.msg("⚠️ Merlin", "自動換取 API Token 失敗", cfClearance ? "請重試" : "請先在瀏覽器開啟 merlin.2ac.io");
            $.done({});
            return;
        }

        let apiToken = null;
        try {
            const json = JSON.parse(data);
            if (json.success && json.authToken) {
                apiToken = json.authToken;
            }
        } catch(e) {}

        if (!apiToken) apiToken = parseToken(data);

        if (apiToken) {
            $.setdata(apiToken, "merlin_api_token");
            tryClipboard(apiToken);
            $.msg(
                "✅ Merlin API Token 已取得",
                apiToken,
                "👉 點擊此通知以複製到剪貼簿",
                { action: "clipboard", text: apiToken }
            );
        } else {
            const preview = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80);
            console.log("Merlin: 無法解析回應 HTTP", resp && resp.status, data.substring(0, 200));
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
        const keys = ["authToken", "token", "api_token", "apiToken", "key", "api_key", "access_token", "accessToken"];
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

    // HTML value= 屬性
    const valueMatch = raw.match(/value="([A-Za-z0-9_\-\.+\/=:]{20,})"/);
    if (valueMatch) return valueMatch[1];

    // HTML <code>, <pre>, <p>, <span>, <td> 區塊
    const htmlTagMatch = raw.match(/<(?:code|pre|p|span|td|div)[^>]*>\s*([A-Za-z0-9_\-\.+\/=:]{20,})\s*<\/(?:code|pre|p|span|td|div)>/);
    if (htmlTagMatch) return htmlTagMatch[1];

    // 純文字 token
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
    const hasCF = !!$.getdata("merlin_cf_clearance");

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
            title: "Merlin Session Token",
            content: `${sessionToken.substring(0, 25)}...\n\n尚未換取 API Token\nCF Cookie: ${hasCF ? "✅" : "❌ 請先開啟 merlin.2ac.io"}`,
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
