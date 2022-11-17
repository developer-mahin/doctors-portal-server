const express = require("express")
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require("jsonwebtoken")
const cors = require("cors")
require("dotenv").config()
const port = process.env.PORT || 5000


// middlewares
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.od5bye5.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send("Unauthorized Access")
    }
    const token = authHeader.split(" ")[1]
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: "Forbidden access" })
        }
        req.decoded = decoded
    })
    next()
}

async function run() {

    try {
        const appointmentOptionCollection = client.db("doctors-portal").collection("appointment-option")
        const bookingsCollection = client.db("doctors-portal").collection("bookings")
        const userCollection = client.db("doctors-portal").collection("users")



        app.get("/appointmentOption", async (req, res) => {
            const date = req.query.date
            const query = {}
            const options = await appointmentOptionCollection.find(query).toArray()
            const bookingQuery = { date: date }
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray()
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(booked => booked.treatment === option.name)
                const bookSlots = optionBooked.map(book => book.slot)
                const remaining = option.slots.filter(slot => !bookSlots.includes(slot))
                option.slots = remaining;
            })
            res.send(options)
        })

        // app.get("/v2/appointmentOption", async (req, res)=>{
        //     const date = req.query.date;
        //     const options = await appointmentOptionCollection.aggregate([
        //         {
        //             $lookup:{
        //                 from:"$bookings", 
        //                 localField: "name", 
        //                 foreignField: "treatment", 
        //                 pipeline:[
        //                     {
        //                         $match:{
        //                             $expr: {
        //                                 $eq:["$date", date]
        //                             }
        //                         }
        //                     }
        //                 ], 
        //                 as: "booked"
        //             }
        //         }
        //     ])
        // })

        /***
         * API naming convention
         * app.get("/bookings")
         * app.get("/bookings/:id")
         * app.post("/bookings")
         * app.patch("/bookings/:id")
         * app.delete("/bookings/:id")  
         */

        app.get("/bookings", verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedToken = req.decoded
            if (!decodedToken) {
                return res.status(403).send({ message: "Forbidden Access" })
            }
            const query = { email: email }
            const result = await bookingsCollection.find(query).toArray()
            res.send(result)
        })

        app.get("/jwt", async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "1d" })
            return res.send({ accessToken: token })
        })

        app.post("/bookings", async (req, res) => {
            const booking = req.body;

            const query = {
                date: booking.date,
                treatment: booking.treatment
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray()
            if (alreadyBooked.length) {
                const message = `You already have an appointment on ${booking.date}`
                return res.send({ acknowledge: false, message })
            }

            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })

        app.get("/users", async (req, res) => {
            const query = {}
            const users = await userCollection.find(query).toArray()
            res.send(users)
        })

        app.post("/user", async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.put("/users/admin/:id", verifyJWT, async (req, res) => {

            const decodedEmail = req.decoded.email
            const query = { email: decodedEmail }
            const user = await userCollection.findOne(query)
            if (user?.role !== "admin") {
                return res.status(403).send({ message: "Forbidden access" })
            }
            else{
                res.send({message: "Admin Make successful"})
            }

            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true }
            const updatedDoc = {
                $set: {
                    role: "admin"
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc, option)
            res.send(result)
        })



    } catch (error) {
        console.log(error.message)
    }

}

run().catch((error) => console.log(error))





app.get("/", (req, res) => {
    res.send("Server is running")
})

app.listen(port, () => {
    console.log(`App running on port ${port}`)
})