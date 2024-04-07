const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.8cnv71c.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "Unauthorized Access" })
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "Unauthorized Access" })
        }
        req.decoded = decoded;
        next()
    })
}


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        const usersCollection = client.db("alumniAssociation").collection("users");
        const jobsCollection = client.db("alumniAssociation").collection("jobs");
        const committeeCollection = client.db("alumniAssociation").collection("committee");
        const applicationCollection = client.db("alumniAssociation").collection("application");
        const eventCollection = client.db("alumniAssociation").collection("events");
        const blogCollection = client.db("alumniAssociation").collection("blogs");

        // JWT
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "4h" })
            res.send({ token })
        })

        //Verify Admin

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            if (result?.role !== "admin") {
                // return res.status(403).send({ error: true, message: "Forbidden access" })
                const result = { admin: false }
                return res.send(result);
            }
            next()
        }

        const verifyAlumni = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query)
            if (result?.role !== "alumni") {
                // return res.status(403).send({ error: true, message: "Forbidden access" })
                const result = { alumni: false }
                return res.send(result);
            }
            next()
        }


        // users api
        app.post("/users", async (req, res) => {
            const newUser = req.body;
            const email = { email: newUser.email };
            const existUser = await usersCollection.findOne(email);
            if (existUser) {
                return res.json("User Exist!")
            } else {
                const result = await usersCollection.insertOne(newUser);
                return res.send(result);
            }
        })

        app.get("/user", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            if (query) {
                const result = await usersCollection.findOne(query);
                res.send(result)
            }
        })

        app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === "admin" }
            res.send(result);
        })


        app.get("/users/alumni/:email", verifyJWT, verifyAlumni, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { alumni: user?.role === "alumni" }
            res.send(result);
        })

        app.patch("/edit-user-profile/:id", verifyJWT, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: data?.name,
                    email: data?.email,
                    phone: data?.phone,
                    batch: data?.batch,
                    department: data?.department,
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            return res.send(result)
        })

        app.patch("/update-user-profile-picture/:id", verifyJWT, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    photo: data?.photo
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            return res.send(result)
        })

        // Jobs
        app.get("/all-job-post", async (req, res) => {
            const result = await jobsCollection.find({}).toArray();
            return res.send(result)
        })
        app.get("/all-blog-post", async (req, res) => {
            const result = await blogCollection.find({}).toArray();
            return res.send(result)
        })

        app.get("/job-post/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(filter);
            return res.send(result)
        })
        app.post("/create-job-application", verifyJWT, async (req, res) => {
            const newData = req.body;
            const result = await applicationCollection.insertOne(newData);
            return res.send(result)
        })

        app.get("/applied-jobs", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email };
            if (query) {
                const result = await applicationCollection.find(query).toArray();
                res.send(result)
            }
        })

        app.patch("/create-new-alumni/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const newData = req.body;
            const updateDoc = {
                $set: {
                    ...filter,
                    role: "alumni",
                    name: newData?.name,
                    email: newData?.email,
                    phone: newData?.email,
                    photo: newData?.photo,
                    position: newData?.position,
                    company: newData?.company,
                    academicYear: newData?.academicYear,
                    about: newData?.about
                }
            }
            const updateRes = await usersCollection.updateOne(filter, updateDoc);
            if (updateRes?.modifiedCount > 0) {
                res.send({ modifiedCount: updateRes?.modifiedCount })
            }

        })

        app.get("/alumni-info", verifyJWT, verifyAlumni, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            if (query) {
                const result = await usersCollection.findOne(query);
                res.send(result)
            }
        })

        app.patch("/update-alumni-profile-picture/:id", verifyJWT, verifyAlumni, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    photo: data?.image
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            return res.send(result)
        })

        app.patch("/edit-alumni-profile/:id", verifyJWT, verifyAlumni, async (req, res) => {
            const data = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: data?.name,
                    email: data?.email,
                    position: data?.position,
                    company: data?.company,
                    academicYear: data?.academicYear,
                    about: data?.about,
                    phone: data?.phone
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            return res.send(result)
        })

        app.post("/create-job-post", verifyJWT, verifyAlumni, async (req, res) => {
            const data = req.body;
            const result = await jobsCollection.insertOne(data);
            return res.send(result)
        })

        app.get("/alumni-hiring-post/:email", verifyJWT, verifyAlumni, async (req, res) => {
            const email = req.params.email;
            const filter = { contact_email: email }
            const result = await jobsCollection.find(filter).toArray();
            return res.send(result)
        })

        app.get("/job-applications/:email", verifyJWT, verifyAlumni, async (req, res) => {
            const email = req.params.email;
            const filter = { author: email }
            const result = await applicationCollection.find(filter).toArray();
            return res.send(result)
        })

        app.get("/all-committee", async (req, res) => {
            const result = await usersCollection.find({ "committeeRule": { $exists: true } }).toArray();
            return res.send(result)
        })
        app.get("/all-alumni", async (req, res) => {
            const result = await usersCollection.find({ role: "alumni" }).toArray();
            return res.send(result)
        })

        app.post("/create-event", verifyJWT, verifyAlumni, async (req, res) => {
            const data = req.body;
            const result = await eventCollection.insertOne(data);
            return res.send(result)
        })
        app.get("/all-events", async (req, res) => {
            const result = await eventCollection.find({}).toArray();
            return res.send(result)
        })


        app.get("/alumni-events/:email", verifyJWT, verifyAlumni, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const result = await eventCollection.find(filter).toArray();
            return res.send(result)
        })
        app.delete("/alumni-events-delete/:id", verifyJWT, verifyAlumni, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await eventCollection.deleteOne(filter);
            return res.send(result)
        })

        app.post("/create-new-blogs", verifyJWT, verifyAlumni, async (req, res) => {
            const data = req.body;
            const result = await blogCollection.insertOne(data);
            return res.send(result)

        })

        // admin
        app.get("/get-all-user", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find({}).toArray();
            return res.send(result)
        })

        app.delete("/user-delete/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })

        app.get("/users/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);

            const result = { admin: user?.role === "admin" }
            res.send(result);
        })

        app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const userUpdate = {
                $set: {
                    role: "admin"
                }
            };
            const result = await usersCollection.updateOne(filter, userUpdate);
            res.send(result);
        })

        app.patch("/users/update-committee/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const rule = req.body;
            const filter = { _id: new ObjectId(id) }
            const userUpdate = {
                $set: {
                    committeeRule: rule?.committeeRule
                }
            };
            const result = await usersCollection.updateOne(filter, userUpdate);
            res.send(result);
        })

        app.patch("/users/remove/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const userUpdate = {
                $set: {
                    role: "alumni"
                }
            };
            const result = await usersCollection.updateOne(filter, userUpdate);
            res.send(result);
        })

        app.get("/get-all-blog", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await blogCollection.find({}).toArray();
            return res.send(result)
        })

        app.delete("/delete-single-blog/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await blogCollection.deleteOne(filter);
            return res.send(result)
        })
        app.get("/get-all-events", verifyJWT, verifyAdmin, async (req, res) => {
            const result = await eventCollection.find({}).toArray();
            return res.send(result)
        })

        app.delete("/delete-single-event/:id", verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const result = await eventCollection.deleteOne(filter);
            return res.send(result)
        })

        // Connect the client to the server	(optional starting in v4.7)
        //   await client.connect();
        // Send a ping to confirm a successful connection
        //   await client.db("admin").command({ ping: 1 });
        console.log("You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //   await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("Alumni server is running")
})

app.listen(port, () => {
    console.log(`Server running at port ${port}`);
})