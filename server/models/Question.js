const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    questionText: String, // Example field, update as needed
    choices: [String],    // Example field for multiple choice options
    answer: String,       // Example field for the correct answer
}, { collection: "Data" });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;