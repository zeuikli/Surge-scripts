/**
 * Merlin Session Token Grabber (Surge Fixed)
 * * 使用方式：
 * 1. 登入 Merlin 官網
 * 2. 收到通知時 -> 「點擊通知」即可複製 Token
 * 3. 前往 merlin.2ac.io 貼上
 */

const $ = new Env("Merlin Token");
const TARGET_COOKIE_NAME = "__Secure-authjs.session-token";

// 判斷是「面板模式」還是「抓取模式」
if (typeof $argument !== "undefined" && $argument.includes("panel=true")) {
    showPanel();
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
                
                // --- 關鍵修正 ---
                // Surge 必須使用 action: "clipboard" 才能在點擊通知時複製
                $.msg("Merlin Token 已捕獲! ⚡️", "👉 點擊此通知複製 Token", `Token: ${token.substring(0, 10)}...`, {
                    "action": "clipboard", 
                    "text": token 
                });
            }
        }
    }
    $.done({});
}

function showPanel() {
    const token = $.getdata("merlin_session_token");
    if (token) {
        $.done({
            title: "Merlin Token (點擊複製)",
            content: token.substring(0, 20) + "...",
            icon: "key.icloud",
            "icon-color": "#5D3FD3"
        });
    } else {
        $.done({
            title: "Merlin Token",
            content: "尚未捕獲，請去瀏覽器登入",
            icon: "exclamationmark.triangle",
            "icon-color": "#FF9500"
        });
    }
}

// --- Helper Functions ---
function Env(name) {
    return new (class {
        constructor(name) { this.name = name; }
        msg(title, subtitle, body, opts) {
            if (typeof $notification !== 'undefined') {
                $notification.post(title, subtitle, body, opts);
            }
        }
        getdata(key) {
            if (typeof $persistentStore !== 'undefined') {
                return $persistentStore.read(key);
            }
        }
        setdata(val, key) {
            if (typeof $persistentStore !== 'undefined') {
                return $persistentStore.write(val, key);
            }
        }
        done(val) { $done(val); }
    })(name);
}
