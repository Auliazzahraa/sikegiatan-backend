import admin from "firebase-admin";
import { getMessaging, send } from "firebase-admin/messaging";

// Ambil service account dari ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function testFCM() {
  const testToken = "f_fBmu4LrMlABYfuE26OSC:APA91bHGP4QJm3ZqSz8suSsfHuznePv3BPsviM29FWzU0iRLPtfgUop-rjmcFT4KH9TJIpLCaKX59MJsW3yfm29HrkeJMrnCqRy7uoqiTwBJ7JmnBMGJYJM";

  const message = {
    token: testToken,
    notification: {
      title: "Test Notifikasi",
      body: "Ini notif test dari server Railway",
    },
  };

  try {
    const response = await send(getMessaging(), message);
    console.log("✅ FCM berhasil:", response);
  } catch (err) {
    console.error("❌ FCM gagal:", err);
  }
}

testFCM();
