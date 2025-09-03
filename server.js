import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

import admin from "firebase-admin";
import { readFileSync } from "fs";

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

// 🔹 Firebase Admin Config
const serviceAccount = JSON.parse(
  readFileSync("./serviceAccountKey.json", "utf8")
);

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


app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

// ✅ Endpoint hapus user Firebase
app.delete("/delete-user/:uid", async (req, res) => {
  const { uid } = req.params;
  try {
    // hapus user dari Authentication
    await admin.auth().deleteUser(uid);

    // hapus user dari Firestore (opsional kalau kamu simpan data user)
    await db.collection("users").doc(uid).delete();

    res.json({ message: `User ${uid} berhasil dihapus` });
  } catch (error) {
    console.error("❌ Firebase delete user error:", error);
    res.status(500).json({ error: "Gagal hapus user", details: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend API is running on Railway");
});


app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
