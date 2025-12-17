/**
 * Merlin Token Panel Script (Auto-Copy Version)
 * 保存路徑: merlin_cookie.js
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

            if (token !== oldToken) {
                $.setdata(token, "merlin_session_token");
                
                // 1. 【嘗試自動複製】
                // 嘗試直接寫入剪貼簿 (如果在前台或系統允許時會生效)
                if (typeof $utils !== 'undefined' && $utils.setClipboard) {
                    $utils.setClipboard(token);
                    console.log("Merlin: 嘗試自動寫入剪貼簿");
                }

                // 2. 【發送通知】
                // action: "clipboard" 是雙重保險，如果上面失敗，點這個一定成功
                $.msg("Merlin Token 已更新", "若未自動複製，請點擊此通知", token.substring(0, 10) + "...", {
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
    
    // 如果從面板觸發，也順便嘗試複製一下 (方便手動觸發)
    // 但為了避免每次刷新面板都彈通知干擾，這裡我們只做靜默複製或不動作
    // 若要長按面板複製，Surge 面板原生就支援 "Copy Content"
    
    if (token) {
        $.done({
            title: "Merlin Session Token",
            content: token.substring(0, 20) + "...", 
            icon: "key.icloud.fill",
            "icon-color": "#5D3FD3"
        });
    } else {
        $.done({
            title: "Merlin Token",
            content: "未獲取 (請瀏覽 Merlin 官網)",
            icon: "exclamationmark.triangle.fill",
            "icon-color": "#FF9500"
        });
    }
}

// --- Env Helper ---
function Env(name) {
    return new (class {
        constructor(name) { this.name = name; }
        msg(title, subtitle, body, opts) { if (typeof $notification !== 'undefined') $notification.post(title, subtitle, body, opts); }
        getdata(key) { if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key); }
        setdata(val, key) { if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key); }
        done(val) { $done(val); }
    })(name);
}
