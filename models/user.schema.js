import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    businessId: {
        type: String,
        required: true,
        unique: true
    },

    businessName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    dueDate: {
        type: Date,
        required: true,
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    isActive:{
        type:Boolean,
        default:true
    },
    refreshToken: {
        type: String,
        default: null
    }   
    
}, { timestamps: true  });

const User = mongoose.model("User", userSchema);

export default User;