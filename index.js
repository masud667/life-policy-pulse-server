const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdz9cop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});


async function run() {
  try {
    await client.connect();
    const db = client.db("LifePolicyPulse");
    const userCollection = db.collection("users");
    console.log("✅ MongoDB connected");
await userCollection.insertOne({
  name: "Admin",
  email: "admin@example.com",
});
    app.get("/users", async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
}

run();

app.get("/", (req, res) => {
  res.send({ msg: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
