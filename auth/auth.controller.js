import User from "../models/user.schema.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const login = async(req , resp) => {

    const {businessName,  password} = req.body;

    if(!businessName || ! password){
        return resp.status(401).send("enter all the required fields");
    }

    const user = await User.findOne({businessName});
    if(!user){
        return resp.status(401).send("user not found");
    }
    if(user.password !== password){
        return resp.status(401).send("invalid password");
    }

    if(user.isActive === false){
        return resp.status(401).send("Your plan has expired, please renew your plan");
    }       

    const accessTokenSecretKey = process.env.ACCESS_TOKEN_SECRET_KEY;
    const refreshTokenSecretKey = process.env.REFRESH_TOKEN_SECRET_KEY;

    const accessToken = jwt.sign({businessName:user.businessName, role:user.role, businessId: user.businessId, dueDate: user.dueDate}, accessTokenSecretKey, {expiresIn: "1h"});
    const refreshToken = jwt.sign({businessName:user.businessName, role:user.role, businessId: user.businessId, dueDate: user.dueDate}, refreshTokenSecretKey, {expiresIn: "1d"});

    resp.cookie("accessToken", accessToken, { httpOnly: true, sameSite: 'none', secure: true });
    resp.cookie("refreshToken", refreshToken, { httpOnly: true, sameSite: 'none', secure: true });
    user.refreshToken = refreshToken;
    await user.save();      

    resp.status(200).json({message:"user logged in successfully", accessToken});
}

export const signup = async(req , resp) => {

    const {businessName,  password, email, phoneNumber, role} = req.body;

    if(!businessName || ! password){
        return resp.status(401).send("enter all the required fields");
    }

    const user = await User.findOne({businessName});
    if(user){
        return resp.status(401).send("user already exists");
    }
    const dueDate = new Date();
    dueDate.setFullYear(dueDate.getFullYear() + 1);

    const businessId = crypto.randomUUID();

    const newUser = new User({
        businessId,
        businessName: businessName, 
        password,
        email,
        phoneNumber,
        dueDate,
        isActive:true,
        role 
    });
    await newUser.save();
    resp.status(200).send("user created successfully");
}

export const updateuser = async (req, resp) => {
    const data = req.body;
    let user;

    // Support legacy update by businessname or update by _id
    if (data._id) {
        user = await User.findById(data._id);
    } else {
        user = await User.findOne({ businessName: data.businessname });
    }

    if (!user) {
        return resp.status(404).send("user not found");    
    }

    user.dueDate = data.dueDate;
    user.email = data.email;
    user.businessName = data.businessname || data.businessName;  
    
    // Only update password if provided
    if (data.password && data.password.trim() !== "") {
        user.password = data.password;
    }
    
    user.phoneNumber = data.phoneNumber;
    user.isActive = data.isActive;
    user.role = data.role;
    await user.save();
    resp.status(200).send("user updated successfully");
}

export const deleteUser = async (req, resp) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        
        if (!deletedUser) {
            return resp.status(404).send("User not found");
        }
        
        resp.status(200).send("User deleted successfully");
    } catch (error) {
        resp.status(500).send("Failed to delete user");
    }
}

export const getAllUsers = async (req, resp) => {
    try {
        // Fetch all users but exclude passwords
        const users = await User.find({}, '-password').sort({ createdAt: -1 });
        resp.status(200).json(users);
    } catch (error) {
        resp.status(500).send("Failed to fetch users");
    }
}