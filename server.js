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
// Fungsi kirim notif personal
async function sendNotifPersonal(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return;

    const { nip, fcmToken } = userDoc.data();
    if (!fcmToken) return;

    const today = dayjs().startOf('day');
    const tomorrow = dayjs().add(1, 'day').startOf('day');
    const bulan = dayjs().format('MMMM-YYYY').toLowerCase();

    const snapshot = await db
      .collection('jadwal')
      .doc(bulan)
      .collection('entries')
      .where('tanggal', '>=', today.toDate())
      .where('tanggal', '<', tomorrow.toDate())
      .where('nipKegiatan', 'array-contains', nip)
      .get();

    let notifBody = 'Hari ini kamu tidak punya kegiatan terjadwal.';
    if (!snapshot.empty) {
      const kegiatan = [];
      snapshot.forEach((doc) => kegiatan.push(doc.data()));

      const dalam = kegiatan.filter((k) => k.jenisKegiatan === 'Dalam Ruangan');
      const luar = kegiatan.filter((k) => k.jenisKegiatan === 'luar ruangan');

      if (dalam.length > 0) {
        notifBody = `Hari ini ada kegiatan ${dalam[0].namaKegiatan} (Dalam Ruangan) di ${dalam[0].lokasi}`;
      } else if (luar.length === 1) {
        notifBody = `Hari ini ada kegiatan ${luar[0].namaKegiatan} (Luar Ruangan) di ${luar[0].lokasi}`;
      } else if (luar.length > 1) {
        notifBody = `Hari ini kamu punya ${luar.length} kegiatan luar ruangan.`;
      }
    }

    const message = {
      token: fcmToken,
      notification: {
        title: 'Kegiatan Hari Ini!',
        body: notifBody,
        image: '/logopkm.png',
      },
      data: {
        url: '/home',
      },
    };

    await admin.messaging().send(message);
    console.log(`📨 Notif berhasil dikirim ke ${uid}`);
  } catch (err) {
    console.error(`❌ Gagal kirim notif ke ${uid}:`, err.message);
  }
}

// Endpoint manual
app.post('/send-personal-notif/:uid', async (req, res) => {
  const { uid } = req.params;
  await sendNotifPersonal(uid);
  res.json({ success: true });
});

/* ----------------------- 🔹 Cron job 07:30 ----------------------- */
// testt * * *"
cron.schedule("20 20 * * *", async () => {
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
