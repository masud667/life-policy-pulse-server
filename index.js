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
    origin: ["http://localhost:5173",
      "https://life-policy-pulse.web.app"
    ],
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
  });
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).send({ message: "Forbidden: Admins only" });
  }
  next();
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cdz9cop.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// MongoDB connection
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // await client.connect();
    const db = client.db("LifePolicyPulse");
    const usersCollection = db.collection("users");
    const policiesCollection = db.collection("policies");
    const applicationsCollection = db.collection("applications");
    const blogsCollection = db.collection("blogs");
    const transactionsCollection = db.collection("transactions");
    const testimonialsCollection = db.collection("testimonials");
    const newsletterCollection = db.collection("newsletter");
    const claimsCollection = db.collection("claims");

    app.post("/jwt", async (req, res) => {
      const { email } = req.body;

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.status(401).send({ message: "Unauthorized" });
      }

      const token = jwt.sign(
        { email, role: user.role },
        process.env.KEY_SECRET,
        { expiresIn: "1d" }
      );

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });

      res.send({ token });
    });

    //logout
    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
      });
      res.send({ message: "Logged out successfully" });
    });

    // Routes
    app.get("/", (req, res) => {
      res.send("Server is running");
    });

    app.post("/transactions", async (req, res) => {
      const transaction = req.body;
      transaction.date = new Date();
      const result = await transactionsCollection.insertOne(transaction);
      res.send(result);
    });

    // PUT or PATCH endpoint to approve an application
    app.patch("/applications/:id/approve", async (req, res) => {
      try {
        const { id } = req.params;
        const { frequency } = req.body;

        const updatedPolicy = {
          $set: {
            status: "Approved",
            frequency,
            paymentStatus: "Due",
          },
        };

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(id) },
          updatedPolicy
        );

        if (result.modifiedCount === 1) {
          res
            .status(200)
            .send({ message: "Application approved successfully" });
        } else {
          res
            .status(404)
            .send({ message: "Application not found or not updated" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    app.get("/approved-applications", async (req, res) => {
      const email = req.query.email;

      const result = await applicationsCollection
        .find({
          userEmail: email,
          status: "Approved",
        })
        .toArray();

      res.send(result);
    });

    app.patch("/applications/:id/pay", async (req, res) => {
      const { id } = req.params;

      const result = await applicationsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus: "Paid" } }
      );

      res.send(result);
    });

    // GET /users
    app.get("/users", async (req, res) => {
      try {
        const users = await db.collection("users").find().toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch users" });
      }
    });

    // GET all applications
    app.get("/applications", verifyToken, verifyAdmin, async (req, res) => {
      const applications = await applicationsCollection.find().toArray();
      res.send(applications);
    });

    // PATCH /users/promote/:id
    app.patch("/users/promote/:id", async (req, res) => {
      const id = req.params.id;
      const result = await db
        .collection("users")
        .updateOne({ _id: new ObjectId(id) }, { $set: { role: "agent" } });
      res.send(result);
    });

    // PATCH /users/demote/:id
    app.patch("/users/demote/:id", async (req, res) => {
      const id = req.params.id;
      const result = await db
        .collection("users")
        .updateOne({ _id: new ObjectId(id) }, { $set: { role: "user" } });
      res.send(result);
    });

    // DELETE /users/:id
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const result = await db
        .collection("users")
        .deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // PATCH: Update status (approve, reject)
    app.patch(
      "/applications/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { status, agentEmail } = req.body;
        const update = { $set: { status } };
        if (agentEmail) update.$set.agentEmail = agentEmail;

        const result = await applicationsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          update
        );
        res.send(result);
      }
    );

  app.post("/newsletterSubscribe", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).send({ message: "Name and email are required." });
    }
    const result = await db.collection("newsletter").insertOne({ name, email, subscribedAt: new Date() });
    res.send({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).send({ message: "Internal server error." });
  }
});

// GET /agents/featured
app.get("/agents/featured", async (req, res) => {
  try {
    const featuredAgents = await usersCollection
      .find({ role: "agent" })
      .limit(3)
      .toArray();

    res.send(featuredAgents);
  } catch (error) {
    console.error("Error fetching agents:", error);
    res.status(500).send({ message: "Internal server error" });
  }
});

 // POST /testimonials
    app.post("/testimonials", async (req, res) => {
      const review = req.body;
      const result = await db.collection("testimonials").insertOne(review);
      res.send(result);
    });
// get testimonial 
app.get('/testimonials', async (req, res) => {
  try {
    const testimonials = await db.collection('testimonials').find().toArray();
    res.send(testimonials);
  } catch (err) {
    res.status(500).send({ error: 'Failed to fetch testimonials' });
  }
});

    // GET /my-policies (with user filtering)
    app.get("/my-policies", async (req, res) => {
      const email = req.query.email;
      const result = await db
        .collection("applications")
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    });

    app.get("/dashboard", verifyToken, async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.user.email });
        if (!user) return res.status(404).send({ error: "User not found" });

        res.send({ role: user.role });
      } catch (error) {
        res.status(500).send({ error: "Server Error" });
      }
    });

// Backend (Express)
app.post("/claims", async (req, res) => {
  try {
    const { policyId, policyName, email, reason } = req.body;
    const file = req.file;

    // Optional: Check for existing pending claim
    const existing = await db.collection("claims").findOne({
      policyId,
      email,
      status: "Pending",
    });

  } catch (err) {
    console.error("Claim POST error:", err);
    res.status(500).json({ message: "Failed to submit claim" });
  }
});


    app.get("/policies", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 9;
      const skip = (page - 1) * limit;

      const result = await policiesCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();
      const total = await policiesCollection.estimatedDocumentCount();

      res.send({ result, total });
    });

    //  GET all blogs (with role-based filtering)
    app.get("/blogs", async (req, res) => {
      try {
        const { email, role } = req.query;

        let filter = {};
        if (role !== "admin") {
          filter = { authorEmail: email };
        }

        const blogs = await blogsCollection
          .find(filter)
          .sort({ date: -1 })
          .toArray();
        res.json(blogs);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch blogs", error });
      }
    });

   
  // POST /blogs
app.post("/blogs", async (req, res) => {
  try {
    const blog = req.body;
    blog.createdAt = new Date(); 

    const result = await blogsCollection.insertOne(blog);
    res.send(result);
  } catch (err) {
    console.error("Failed to create blog:", err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});


    // PUT blog
    app.put("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const update = req.body;
      const result = await blogsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );
      res.send(result);
    });

    // DELETE blog
    app.delete("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await blogsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!id) {
          return res.status(400).json({ message: "Invalid blog ID" });
        }
        const blog = await blogsCollection.findOne({ _id: id });
        res.json(blog);
      } catch (error) {
        res.status(500).json({ message: "Error fetching blog", error });
      }
    });
    app.patch("/blogs/:id", async (req, res) => {
      const id = req.params.id;
      const { visits } = req.body;
      const result = await blogsCollection.updateOne(
        { _id: id },
        { $set: { visits } }
      );

      res.json(result);
    });

    app.get("/policies/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      try {
        const policy = await policiesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!policy) {
          return res.status(404).json({ message: "Policy not found" });
        }

        res.send(policy);
      } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });
    
// Update policy by ID (string _id)
app.patch("/policies/:id", async (req, res) => {
  const { id } = req.params;
  const updatedPolicy = req.body;

  try {
    // Ensure _id is not included in $set
    const { _id, ...dataToUpdate } = updatedPolicy;

    const result = await db.collection("policies").updateOne(
      { _id: id },       // string id
      { $set: dataToUpdate }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Policy not found" });
    }

    res.json({ message: "Policy updated successfully", result });
  } catch (error) {
    console.error("Error updating policy:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


    // POST /policies
    app.post("/policies", async (req, res) => {
      const newPolicy = req.body;
      newPolicy.createdAt = new Date();
      const result = await db.collection("policies").insertOne(newPolicy);
      res.send(result);
    });

    // PATCH /policies/:id/purchase
app.patch("/policies/:id/purchase", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await policiesCollection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { purchaseCount: 1 } }
    );

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Failed to increment purchase count" });
  }
});

    // PATCH /applications/:id/status
    app.patch("/applications/:id/status", async (req, res) => {
      const { id } = req.params;
      const { status, policyId } = req.body;

      try {
        const result = await db
          .collection("applications")
          .updateOne({ _id: new ObjectId(id) }, { $set: { status } });

        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Application not found" });
        }

        res.status(200).send({ message: "Status updated successfully" });
      } catch (error) {
        console.error("Error updating status:", error);
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    // GET /agent/applications/:agentEmail
    app.get("/agent/applications/:userEmail", async (req, res) => {
      const { agentEmail } = req.params;

      try {
        const applications = await db
          .collection("applications")
          .find({ userEmail: agentEmail })
          .toArray();

        res.status(200).send(applications);
      } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).send({ message: "Server error", error: error.message });
      }
    });

    app.post("/applications", async (req, res) => {
      const application = req.body;
      application.status = "pending"; // auto-set
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
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

    // DELETE /policies/:id
    app.delete("/policies/:id", async (req, res) => {
      const result = await db
        .collection("policies")
        .deleteOne({ _id: new ObjectId(req.params.id) });
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
