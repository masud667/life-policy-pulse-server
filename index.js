const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
const uri =`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdz9cop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// MongoDB connection
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});



async function run() {
  try {
    await client.connect();
    const db = client.db("LifePolicyPulse");
    const usersCollection = db.collection("users");


    // jwt token related
app.post('/jwt',async (req, res) =>{
  const {email} = req.body;
  const user = {email}
  const token = jwt.sign(user, process.env.KEY_SECRET, {expiresIn: '1h'})
  res.send({token})
})

    // Routes
    app.get("/", (req, res) => {
      res.send("Server is running");
    });

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.post("/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

  } catch (error) {
    console.error(error);
  }
}

run();

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
