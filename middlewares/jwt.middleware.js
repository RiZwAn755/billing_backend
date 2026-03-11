
import jwt from "jsonwebtoken";
import User from "../models/user.schema.js";

export const verifyToken = async(req, res, next) => {
    const token = req.cookies.accessToken;
    if(!token) return res.status(401).send("You are not authenticated!");
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET_KEY, (err, decodedUser) => {
        if(err){ // access token is expired 
            const refreshToken = req.cookies.refreshToken;

            if(!refreshToken) return res.status(401).send("You are not authenticated!"); // refresh token is not available  

            const refreshTokenSecretKey = process.env.REFRESH_TOKEN_SECRET_KEY;
             // verify refresh token    
            jwt.verify(refreshToken, refreshTokenSecretKey, async(err, decodedRefreshUser) => {
                if(err) return res.status(403).send("Token is not valid!"); // refresh token is expired
                
                try {
                    // Find user in database to update the token and check token legitimacy
                    const dbUser = await User.findOne({ businessName: decodedRefreshUser.businessName });
                    if(!dbUser || dbUser.refreshToken !== refreshToken) {
                        return res.status(403).send("Token is not valid or has been revoked!");
                    }

                    // generate new tokens
                    const accessTokenSecretKey = process.env.ACCESS_TOKEN_SECRET_KEY;
                    const refreshTokenSecretKey = process.env.REFRESH_TOKEN_SECRET_KEY;

                    const newAccessToken = jwt.sign({ businessName: dbUser.businessName, role: dbUser.role }, accessTokenSecretKey, { expiresIn: "1h" });
                    const newRefreshToken = jwt.sign({ businessName: dbUser.businessName, role: dbUser.role }, refreshTokenSecretKey, { expiresIn: "1d" });  
                    
                    dbUser.refreshToken = newRefreshToken;
                    await dbUser.save();  
                    
                    req.user = decodedRefreshUser;
                    res.cookie("accessToken", newAccessToken, { httpOnly: true});        
                    res.cookie("refreshToken", newRefreshToken, { httpOnly: true});        
                    next();
                } catch (dbError) {
                    return res.status(500).send("Internal Server Error");
                }
            });     
        } else {
            req.user = decodedUser;
            next();
        }
    });
};