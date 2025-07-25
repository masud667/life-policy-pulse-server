const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// verify Token middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.KEY_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden" });
    req.user = decoded;
    next();

    //    const userEmail = req.user.email;
    // const queryEmail = req.query.email;
    // if (userEmail !== queryEmail) {
    //   return res.status(403).send({ message: "Forbidden" });
    // }
  });
};
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdz9cop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
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
    const policiesCollection = db.collection("policies");

    // jwt token related
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      const user = { email };
      const token = jwt.sign(user, process.env.KEY_SECRET, { expiresIn: "1d" });

      res.cookie("token", token, {
        httpOnly: true,
        secure: false,
      });
      res.send({ token });
    });

    //logout
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
      });
      res.send({ message: "Logged out successfully" });
    });

    // Routes
    app.get("/", (req, res) => {
      res.send("Server is running");
    });

   app.get("/policies", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 9;
  const skip = (page - 1) * limit;

  const result = await policiesCollection.find().skip(skip).limit(limit).toArray();
  const total = await policiesCollection.estimatedDocumentCount();

  res.send({ result, total });
});


app.get("/policies/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const policy = await policiesCollection.findOne({ _id: new ObjectId(id) });
    if (!policy) return res.status(404).json({ message: "Policy not found" });
    res.send(policy);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch policy" });
  }
});

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };

      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
  } finally {
  }
}

run();

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
