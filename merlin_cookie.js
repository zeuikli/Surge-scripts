/**
 * Merlin Session Token Grabber
 * * 功能：
 * 1. 攔截 Merlin 請求並提取 Session Token
 * 2. 自動將 Token 複製到剪貼簿
 * 3. 彈出通知，點擊即可跳轉至註冊頁面
 */

const $ = new Env("Merlin Token Helper");
const TARGET_URL = "https://merlin.2ac.io/register";

// 執行主邏輯
captureCookie();

function captureCookie() {
    // 檢查請求標頭中的 Cookie
    const cookieHeader = $request.headers['Cookie'] || $request.headers['cookie'];
    
    if (cookieHeader) {
        // 使用正則表達式精準提取 __Secure-authjs.session-token
        const regex = /__Secure-authjs\.session-token=([^;]+)/;
        const match = cookieHeader.match(regex);

        if (match && match[1]) {
            const newToken = match[1];
            const oldToken = $.getdata("merlin_session_token");

            // 只有當 Token 改變或是第一次獲取時才通知，避免刷屏
            if (newToken !== oldToken) {
                $.setdata(newToken, "merlin_session_token");
                
                // 1. 自動寫入剪貼簿 (Surge 支援此操作)
                $.setClipboard(newToken);

                // 2. 發送通知
                // user-interaction: 1 代表點擊通知會執行動作
                // open-url: 點擊通知打開註冊網頁
                $.msg("Merlin Token 已捕獲 & 複製! ⚡️", 
                      "請點擊此通知前往網頁貼上", 
                      `Token 前段: ${newToken.substring(0, 15)}...`, 
                      {
                        "open-url": TARGET_URL,
                        "copy-text": newToken // 雙重保險：長按通知也可以複製
                      }
                );
                
                console.log(`[Merlin] Token captured and copied.`);
            }
        }
    }
    $.done({});
}

// --- 輔助函式 (兼容 Surge) ---
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
        setClipboard(text) {
             if (typeof $utils !== 'undefined' && $utils.setClipboard) {
                 // Surge 專用 API
                 $utils.setClipboard(text);
             } else if (typeof $pasteboard !== 'undefined') {
                 // Quantumult X 專用
                 $pasteboard.set(text);
             }
        }
        done(val) { $done(val); }
    })(name);
}
