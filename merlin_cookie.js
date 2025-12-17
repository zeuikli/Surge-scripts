/**
 * Merlin Token Panel Script (Auto-Copy Version - Fixed)
 * 保存路徑: merlin_cookie.js
 * 
 * 修正內容:
 * 1. 修復正則表達式語法錯誤
 * 2. 改進 iOS 自動複製邏輯
 * 3. 優化通知機制
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
        // 修正正則表達式語法
        const regex = new RegExp(`${TARGET_COOKIE_NAME}=([^;]+)`);
        const match = cookieHeader.match(regex);
        
        if (match && match[1]) {
            const token = match[1];
            const oldToken = $.getdata("merlin_session_token");
            
            if (token !== oldToken) {
                // 儲存 token
                $.setdata(token, "merlin_session_token");
                console.log("Merlin: Token 已更新並儲存");
                
                // iOS 自動複製策略
                let copySuccess = false;
                
                // 方法 1: 使用 Surge 的 setClipboard (iOS 14+)
                if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
                    try {
                        $utils.setClipboard(token);
                        copySuccess = true;
                        console.log("Merlin: 已自動複製到剪貼簿 (方法1)");
                    } catch (e) {
                        console.log("Merlin: 方法1複製失敗 -", e.message);
                    }
                }
                
                // 方法 2: 使用 Surge 4.0+ 的 clipboard
                if (!copySuccess && typeof $surge !== 'undefined' && typeof $surge.setClipboard === 'function') {
                    try {
                        $surge.setClipboard(token);
                        copySuccess = true;
                        console.log("Merlin: 已自動複製到剪貼簿 (方法2)");
                    } catch (e) {
                        console.log("Merlin: 方法2複製失敗 -", e.message);
                    }
                }
                
                // 發送通知
                const notificationOptions = {
                    "url": "surge:///copy?text=" + encodeURIComponent(token),
                    "action": "clipboard",
                    "text": token
                };
                
                if (copySuccess) {
                    // 成功自動複製
                    $.msg(
                        "✅ Merlin Token 已更新",
                        "已自動複製到剪貼簿",
                        `前10位: ${token.substring(0, 10)}...`,
                        notificationOptions
                    );
                } else {
                    // 未能自動複製,提示用戶點擊通知
                    $.msg(
                        "🔑 Merlin Token 已更新",
                        "👆 點擊此通知複製到剪貼簿",
                        `前10位: ${token.substring(0, 10)}...`,
                        notificationOptions
                    );
                }
            } else {
                console.log("Merlin: Token 未變更,無需更新");
            }
        } else {
            console.log("Merlin: 未找到目標 Cookie");
        }
    } else {
        console.log("Merlin: 請求中無 Cookie Header");
    }
    
    $.done({});
}

function showPanel() {
    const token = $.getdata("merlin_session_token");
    
    if (token) {
        // 從面板觸發時,嘗試靜默複製
        if (typeof $utils !== 'undefined' && typeof $utils.setClipboard === 'function') {
            try {
                $utils.setClipboard(token);
                console.log("Merlin Panel: 已複製完整 Token");
            } catch (e) {
                console.log("Merlin Panel: 複製失敗 -", e.message);
            }
        }
        
        $.done({
            title: "🔑 Merlin Session Token",
            content: `${token.substring(0, 30)}...\n\n長按可複製完整內容`,
            icon: "key.icloud.fill",
            "icon-color": "#5D3FD3"
        });
    } else {
        $.done({
            title: "⚠️ Merlin Token",
            content: "尚未獲取\n請訪問 Merlin 官網以觸發抓取",
            icon: "exclamationmark.triangle.fill",
            "icon-color": "#FF9500"
        });
    }
}

// --- Env Helper ---
function Env(name) {
    return new (class {
        constructor(name) {
            this.name = name;
        }
        
        msg(title, subtitle, body, opts) {
            if (typeof $notification !== 'undefined') {
                $notification.post(title, subtitle, body, opts);
            } else {
                console.log(`${title}\n${subtitle}\n${body}`);
            }
        }
        
        getdata(key) {
            if (typeof $persistentStore !== 'undefined') {
                return $persistentStore.read(key);
            }
            return null;
        }
        
        setdata(val, key) {
            if (typeof $persistentStore !== 'undefined') {
                return $persistentStore.write(val, key);
            }
            return false;
        }
        
        done(val) {
            if (typeof $done !== 'undefined') {
                $done(val);
            }
        }
    })(name);
}
