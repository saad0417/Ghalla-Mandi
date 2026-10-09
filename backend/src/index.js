import express from "express"
import dotenv from 'dotenv'
import connectDB from "./db/index.js"
import {app} from './app.js'

dotenv.config({path: './.env'})


connectDB()
.then(() => {
    // app.on and more here checks if express app is running or not, if not then it will throw an error.
    app.on("error", (error) => {
            console.log("ERRR:", error);
            throw error;
        })

    app.listen(process.env.PORT || 4000, () => {
        console.log(`⚙️  Server is running at port : ${process.env.PORT}`);
    })
})
.catch((error) => {
    console.error("MongoDB connection failed!!", error);
})
