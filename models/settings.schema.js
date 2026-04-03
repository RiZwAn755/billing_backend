import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
    businessId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        default: ""
    },
    address: {
        type: String,
        default: ""
    },
    gstin: {
        type: String,
        default: ""
    },
    footerMessage: {
        type: String,
        default: ""
    },
    logo: {
        type: String,
        default: ""
    }
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);

export default Settings;
