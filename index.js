import express from 'express';
import 'dotenv/config'
import { MongoClient, ObjectId } from 'mongodb';
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
const borrowsCollection = db.collection('borrows');



app.post('/add-book', async(req, res) => {
  const data = req.body;
  data.dateAdded = new Date();
  const result = await booksCollection.insertOne(data);
  console.log(result);
  res.send(result);
});


app.get('/books', async (req, res) => {
  const limit = Number(req.query.limit);

  const cursor = booksCollection
    .find()
    .sort({ dateAdded: -1 });

  if (limit) {
    cursor.limit(limit);
  }
  const result = await cursor.toArray();
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


app.get('/books/:id', async (req, res) => {
  const id = req.params.id;

  const result = await booksCollection.findOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});



// Update book
app.patch("/books/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const {
      title,
      author,
      category,
      copies,
      description,
      image,
    } = req.body;

    const result = await booksCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          title,
          author,
          category,
          copies: Number(copies),
          description,
          image,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Book not found",
      });
    }

    res.send({
      success: true,
      message: "Book updated successfully",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to update book",
    });
  }
});


// Delete book
app.delete("/books/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const result = await booksCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Book not found",
      });
    }

    res.send({
      success: true,
      message: "Book deleted successfully",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to delete book",
    });
  }
});









// Create borrow
app.post("/borrows", async (req, res) => {
  try {
    const {
      bookId,
      userEmail,
    } = req.body;

    if (!bookId || !userEmail) {
      return res.status(400).send({
        success: false,
        message: "Book ID and user email are required",
      });
    }

    // Find book
    const book = await booksCollection.findOne({
      _id: new ObjectId(bookId),
    });

    if (!book) {
      return res.status(404).send({
        success: false,
        message: "Book not found",
      });
    }

    // Check available copies
    if (book.copies <= 0) {
      return res.status(400).send({
        success: false,
        message: "No copies available",
      });
    }

    // Prevent double borrow
    const existingBorrow = await borrowsCollection.findOne({
      bookId,
      userEmail,
    });

    if (existingBorrow) {
      return res.status(400).send({
        success: false,
        message: "You have already borrowed this book",
      });
    }

    const borrowDate = new Date();

    const returnDate = new Date(borrowDate);
    returnDate.setDate(returnDate.getDate() + 7);

    // Decrease copies
    const updateResult = await booksCollection.updateOne(
      {
        _id: new ObjectId(bookId),
        copies: { $gt: 0 },
      },
      {
        $inc: { copies: -1 },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).send({
        success: false,
        message: "No copies available",
      });
    }

    // Create borrow record
    const borrowData = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail,
      borrowDate,
      returnDate,
    };

    const result = await borrowsCollection.insertOne(borrowData);

    res.send({
      success: true,
      message: "Book borrowed successfully",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to borrow book",
    });
  }
});


// Get user's borrowed books
app.get("/borrows", async (req, res) => {
  try {
    const userEmail = req.query.email;

    if (!userEmail) {
      return res.status(400).send({
        success: false,
        message: "User email is required",
      });
    }

    const result = await borrowsCollection
      .find({ userEmail })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch borrowed books",
    });
  }
});


// Return book
app.delete("/borrows/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const borrow = await borrowsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!borrow) {
      return res.status(404).send({
        success: false,
        message: "Borrow record not found",
      });
    }

    // Increase book copies
    await booksCollection.updateOne(
      {
        _id: new ObjectId(borrow.bookId),
      },
      {
        $inc: { copies: 1 },
      }
    );

    // Remove borrow record
    const result = await borrowsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send({
      success: true,
      message: "Book returned successfully",
      result,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to return book",
    });
  }
});

  
  //http://localhost:8000/add-book
  app.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`);
})
