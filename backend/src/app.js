import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express()

const allowedOrigins = [
    process.env.CORS_ORIGIN,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === "*") {
            return callback(null, true);
        }
        return callback(null, true); // fallback allow in dev
    },
    credentials: true
}))


app.use(express.json({limit: "16kb"})) // to accept json...


app.use(express.urlencoded({extended: true, limit: "16kb"})) 


app.use(express.static("public"))


app.use(cookieParser())







export { app }