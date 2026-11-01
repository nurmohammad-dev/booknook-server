import express from 'express';
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from 'cors';

const app = express();
const PORT = 8000;
app.use(cors());   
app.use(express.json());


const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('booknook');
const booksCollection = db.collection('books');

app.post('/add-book', async(req, res) => {
    const data = req.body;
   data.dateAdded = new Date();
    const result = await booksCollection.insertOne(data);
    console.log(result);
    res.send(result);
});

//http://localhost:8000/add-book
app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
})
