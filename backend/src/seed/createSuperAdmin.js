import dotenv from "dotenv";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";

dotenv.config();

const createSuperAdmin = async () => {
    try {
        // Connect to database using existing function
        await connectDB();
        console.log("STEP 1: Database connected");

        const existingAdmin = await User.findOne({
            role: "SUPER_ADMIN"
        });

        console.log("STEP 2: Admin checked");

        if (existingAdmin) {
            console.log("Super Admin already exists!");
            return;
        }

        // Create Super Admin
        const superAdmin = await User.create({
            name: process.env.ADMIN_NAME,
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD,
            role: "SUPER_ADMIN",
            permissions: []
        });

        console.log("Super Admin created successfully!");
        console.log("Email:", superAdmin.email);

    } catch (error) {
        console.error("Error creating Super Admin:", error.message);
    } finally {
        await mongoose.disconnect();
    }
};

createSuperAdmin();
