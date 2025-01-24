require("dotenv").config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Question = require('./models/Question'); // Import Question model

const app = express();
const PORT = process.env.PORT;

// Middleware
app.use(cors()); // Allow requests from other origins
app.use(express.json()); // Parse JSON bodies

// MongoDB connection
mongoose.connect(process.env.MONGO_URL, { // Update with your MongoDB URI if not local
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Routes
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await Question.find();
        console.log(questions);
        res.json(questions);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving questions' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
