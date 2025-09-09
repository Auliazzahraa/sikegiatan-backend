import admin from "firebase-admin";

// Ambil service account dari ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function testFCM() {
  const testToken = "MASUKKAN_FCM_TOKEN_YANG_VALID_DI_SINI";

  try {
    const response = await admin.messaging().sendToDevice(testToken, {
      notification: {
        title: "Test Notifikasi",
        body: "Ini notif test dari server Railway"
      },
    });
    console.log("✅ FCM berhasil dikirim:", response);
  } catch (err) {
    console.error("❌ FCM gagal:", err);
  }
}

// Jalankan test
testFCM();
