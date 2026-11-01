import express from 'express';
import 'dotenv/config'
import { MongoClient } from 'mongodb';
import cors from 'cors';
import multer from "multer";


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


app.get('/books', async (req, res) => {
  const result = await booksCollection
  .find()
  .sort({ dateAdded: -1 })
    .limit(8)
    .toArray();
    console.log(result);
    res.send(result);
  });
  
  
  const upload = multer({ storage: multer.memoryStorage() });
  
  app.post("/upload-image", upload.single("image"), async (req, res) => {
  try {
    const formData = new FormData();

    formData.append(
      "image",
      req.file.buffer.toString("base64")
    );

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    res.send({
      success: true,
      imageUrl: data.data.url,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Image upload failed",
    });
  }
});
  
  //http://localhost:8000/add-book
  app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
})
