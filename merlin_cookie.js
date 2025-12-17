/**
 * Merlin Session Token Grabber
 * * 功能：
 * 1. 訪問 Merlin 官網時自動提取 Session Token
 * 2. 透過通知顯示並寫入 Surge 持久化存儲
 * 3. 點擊通知可直接複製 Token (需配合 BoxJS 或簡單的剪貼簿邏輯)
 */

const $ = new Env("Merlin Token");
const TARGET_COOKIE_NAME = "__Secure-authjs.session-token";

// 判斷是否為面板模式
if (typeof $argument !== "undefined" && $argument.includes("panel=true")) {
    showPanel();
} else {
    captureCookie();
}

function captureCookie() {
    // 檢查是否有 Cookie 標頭
    const cookieHeader = $request.headers['Cookie'] || $request.headers['cookie'];
    
    if (cookieHeader) {
        // 使用正則表達式提取特定的 Token
        // 格式通常為: __Secure-authjs.session-token=eyJhbGciOi...;
        const regex = new RegExp(`${TARGET_COOKIE_NAME}=([^;]+)`);
        const match = cookieHeader.match(regex);

        if (match && match[1]) {
            const token = match[1];
            const oldToken = $.getdata("merlin_session_token");

            // 如果 Token 不同，則更新並通知
            if (token !== oldToken) {
                $.setdata(token, "merlin_session_token");
                $.msg("Merlin Token 已捕獲! 🎉", "點擊複製 Token", token, {
                    "open-url": "https://merlin.2ac.io/register", // 點擊通知直接打開註冊網頁
                    "copy-text": token // 支援 Surge 的複製功能
                });
                console.log(`[Merlin] Token captured: ${token.substring(0, 10)}...`);
            }
        }
    }
    $.done({});
}

function showPanel() {
    const token = $.getdata("merlin_session_token");
    let content = "";
    
    if (token) {
        content = `Token: ${token.substring(0, 10)}... (已保存)\n請至 2ac.io 註冊`;
    } else {
        content = "尚未捕獲 Token，請用瀏覽器登入 Merlin";
    }

    $.done({
        title: "Merlin Token 助手",
        content: content,
        icon: "key.icloud",
        "icon-color": "#5D3FD3"
    });
}

// --- Helper Functions (兼容 Surge/Loon/QX) ---
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
