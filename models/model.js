const mongoose = require('mongoose');

const referralCodeSchema = new mongoose.Schema({
    referralCode: {
        required: true,
        type: String,
        unique: true
    },
    evmAddress: {
        required: true,
        type: String,
    },
    solAddress: {
        required: true,
        type: String,
    },
    timestamp: {
        type: String,
        default: Date.now()
    }
})

const referralCodeData = mongoose.model('referralcode', referralCodeSchema)

module.exports = { referralCodeData }
