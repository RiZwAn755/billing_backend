import express from "express";
import { login, signup, updateuser, getAllUsers } from "./auth.controller.js";
import { verifyToken } from "../middlewares/jwt.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/signup", signup);
router.post("/updateuser", verifyToken, updateuser);
router.get("/users", verifyToken, getAllUsers);

export default router;