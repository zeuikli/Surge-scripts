$persistentStore.write(null, 'request_id')
let url = $request.url
let key = url.replace(/(.*accounts\/)(.*)(\/apps)/, '$2')
let session_id = $request.headers['x-session-id']
let session_digest = $request.headers['x-session-digest']
let request_id = $request.headers['x-request-id']
$persistentStore.write(key, 'key')
$persistentStore.write(session_id, 'session_id')
$persistentStore.write(session_digest, 'session_digest')
$persistentStore.write(request_id, 'request_id')
if ($persistentStore.read('request_id') !== null) {
  $notification.post('請關閉本腳本', '資訊讀取成功','')
} else {
  $notification.post('資訊讀取失敗','請開啟MITM H2設定並新增testflight.apple.com','')
}
$done({})