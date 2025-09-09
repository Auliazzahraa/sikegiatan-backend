import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import cron from "node-cron"

import admin from "firebase-admin";
import { readFileSync } from "fs";
import dayjs from "dayjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Endpoint delete image (khusus unsigned upload)
app.post('/delete-image', async (req, res) => {
  try {
    const { publicId } = req.body;
    console.log("🛠️ Delete request publicId:", publicId);
    console.log("🛠️ typeof publicId:", typeof publicId, "value:", publicId);
    if (!publicId || typeof publicId !== "string") {
      return res.status(400).json({ error: "publicId kosong / bukan string" });
    }

    const result = await cloudinary.uploader.destroy(publicId); // cukup string
    console.log("✅ Cloudinary delete result:", result);

    res.json({ message: 'Berhasil hapus foto', result });
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    res.status(500).json({ error: 'Gagal hapus foto', details: error.message });
  }
});

// Endpoint hapus user Firebase
app.delete("/delete-user/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    await admin.auth().deleteUser(uid);
    await db.collection("users").doc(uid).delete();
    res.json({ message: `User ${uid} berhasil dihapus` });
  } catch (error) {
    console.error("❌ Firebase delete user error:", error);
    res.status(500).json({ error: "Gagal hapus user", details: error.message });
  }
});

/* ----------------------- 🔹 Fungsi kirim notif personal ----------------------- */
async function sendNotifPersonal(uid) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      console.log(`⚠️ User ${uid} tidak ditemukan di Firestore`);
      return;
    }

    const { nip, fcmToken } = userDoc.data();
    if (!fcmToken) {
      console.log(`⚠️ User ${uid} tidak punya fcmToken`);
      return;
    }

    const today = dayjs().startOf("day");
    const tomorrow = dayjs().add(1, "day").startOf("day");
    const bulan = dayjs().format("MMMM-YYYY").toLowerCase();

    const snapshot = await db
      .collection("jadwal")
      .doc(bulan)
      .collection("entries")
      .where("tanggal", ">=", today.toDate())
      .where("tanggal", "<", tomorrow.toDate())
      .where("nipKegiatan", "array-contains", nip)
      .get();

    let notifBody = "";

    if (snapshot.empty) {
      // User tidak punya kegiatan hari ini
      notifBody = "Hari ini kamu tidak punya kegiatan terjadwal.";
      console.log(`ℹ️ Tidak ada kegiatan untuk ${uid} hari ini`);
    } else {
      // Ada kegiatan
      const kegiatan = snapshot.docs.map(doc => doc.data());
      const dalam = kegiatan.filter(k => k.jenisKegiatan === "Dalam Ruangan");
      const luar = kegiatan.filter(k => k.jenisKegiatan === "Luar Ruangan");

      if (dalam.length > 0) {
        notifBody = `Hari ini ada kegiatan ${dalam[0].namaKegiatan} (Dalam Ruangan) di ${dalam[0].lokasi}`;
      } else if (luar.length === 1) {
        notifBody = `Hari ini ada kegiatan ${luar[0].namaKegiatan} (Luar Ruangan) di ${luar[0].lokasi}`;
      } else {
        notifBody = `Hari ini kamu punya ${luar.length} kegiatan luar ruangan.`;
      }
    }

    const payload = {
      notification: {
        title: "Kegiatan Hari Ini!",
        body: notifBody,
        image: "https://res.cloudinary.com/dmdfgqk2h/image/upload/v1757337747/logo_pkm_oefjjj.png",
      },
      data: { uid },
    };

    // Kirim notif hanya ke 1 token
    try {
      const response = await admin.messaging().send({
        token: fcmToken,
        notification: payload.notification,
        data: payload.data,
      });
      console.log(`📨 Notif dikirim ke ${uid}:`, response);
    } catch (err) {
      console.error(`❌ Gagal kirim notif ke ${uid}:`, err.message);
      // Jika token invalid, bisa hapus dari Firestore
      if (err.code === "messaging/registration-token-not-registered") {
        await db.collection("users").doc(uid).update({ fcmToken: admin.firestore.FieldValue.delete() });
        console.log(`🗑️ Token FCM ${uid} dihapus karena tidak valid`);
      }
    }

  } catch (err) {
    console.error(`❌ Error sendNotifPersonal untuk ${uid}:`, err);
  }
}


/* ----------------------- 🔹 Endpoint manual ----------------------- */
app.post("/send-personal-notif/:uid", async (req, res) => {
  try {
    const { uid } = req.params;
    await sendNotifPersonal(uid);
    res.json({ success: true, message: "Notif diproses" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------- 🔹 Cron job 07:30 ----------------------- */
// testt * * *"
cron.schedule("40 15 * * *", async () => {
  console.log("⏰ Cron job jalan:", dayjs().format("YYYY-MM-DD HH:mm"));
  const usersSnapshot = await db.collection("users").get();
  for (const doc of usersSnapshot.docs) {
    await sendNotifPersonal(doc.id);
  }
}, {
  scheduled: true,
  timezone: "Asia/Jakarta"
});


app.get("/", (req, res) => {
  res.send("✅ Backend API is running on Railway");
});

app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
