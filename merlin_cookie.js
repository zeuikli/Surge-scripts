/**
 * Merlin Token Panel Script (Best Practice Version)
 * 保存路徑: merlin_cookie.js
 * * 優化重點:
 * 1. 移除衝突的 URL Scheme，確保「點擊通知」必定觸發複製。
 * 2. 保留背景嘗試寫入 (雖然 iOS 限制嚴格，但有機會成功)。
 * 3. 面板刷新時強制寫入剪貼簿。
 */

const $ = new Env("Merlin");
const TARGET_COOKIE_NAME = "__Secure-authjs.session-token";

// 入口判斷
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
            
            // 只有 Token 變更時才執行後續動作
            if (token !== oldToken) {
                $.setdata(token, "merlin_session_token");
                console.log("Merlin: Token 已更新並儲存");
                
                // --- iOS 自動複製策略 ---
                let copySuccess = false;
                
                // 嘗試背景寫入 (iOS 在背景時通常會失敗，但值得一試)
                if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
                    try {
                        // 如果你剛好開著 Surge 或在特定狀態下，這行會生效
                        copySuccess = $utils.setClipboard(token); 
                        console.log(`Merlin: 背景自動複製嘗試 -> ${copySuccess ? "成功" : "被系統攔截"}`);
                    } catch (e) {
                        console.log("Merlin: 背景複製異常 -", e.message);
                    }
                }
                
                // --- 通知策略 ---
                // 關鍵修正：移除 url 參數，只保留 action: "clipboard"
                // 這樣點擊通知時，Surge 才會專注於執行複製動作
                const notificationOptions = {
                    "action": "clipboard",
                    "text": token
                };
                
                if (copySuccess) {
                    $.msg("✅ Merlin Token 已自動複製", "可直接貼上", `前段: ${token.substring(0, 10)}...`, notificationOptions);
                } else {
                    // 如果背景複製失敗，明確提示使用者「點擊」
                    $.msg("⚡️ Merlin Token 已捕獲", "👉 點擊此通知以複製", `前段: ${token.substring(0, 10)}...`, notificationOptions);
                }
            } else {
                console.log("Merlin: Token 未變更");
            }
        }
    }
    $.done({});
}

function showPanel() {
    const token = $.getdata("merlin_session_token");
    
    if (token) {
        // 當使用者打開 Surge 查看面板時，強制寫入剪貼簿
        // 這是在前台運行，成功率 100%
        if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
            $utils.setClipboard(token);
        }
        
        $.done({
            title: "Merlin Token (已複製)", // 標題提示已複製
            content: `${token.substring(0, 25)}...\n(打開 App 時已自動寫入剪貼簿)`,
            icon: "doc.on.clipboard.fill", // 換成剪貼簿圖示
            "icon-color": "#34C759" // 綠色代表成功
        });
    } else {
        $.done({
            title: "Merlin Token",
            content: "尚未獲取\n請使用瀏覽器登入 Merlin",
            icon: "exclamationmark.triangle.fill",
            "icon-color": "#FF9500"
        });
    }
}

// --- Env Helper (標準版) ---
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
        done(val) { $done(val); }
    })(name);
}
