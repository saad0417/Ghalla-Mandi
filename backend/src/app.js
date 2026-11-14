import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorHandler } from './middlewares/error.middleware.js';

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
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}))


app.use(express.json({limit: "16kb"})) // to accept json...
app.use(express.urlencoded({extended: true, limit: "16kb"})) 
app.use(express.static("public"))
app.use(cookieParser())




// Routes goes here...
// Import Routes
import healthCheckRouter from './routes/healthcheck.routes.js';
import bankRouter from './routes/bank.routes.js'
import productRouter from './routes/product.routes.js'
import userRouter from './routes/user.routes.js'
import authRouter from './routes/auth.routes.js'
import { verifyJWT } from './middlewares/auth.middleware.js';


app.use("/api/v1/auth", authRouter)

app.use(verifyJWT)


// Routes Decleration
app.use("/api/v1/healthcheck", healthCheckRouter)
app.use("/api/v1/bank", bankRouter)
app.use("/api/v1/product", productRouter)
app.use("/api/v1/user", userRouter)







// error handler must be LAST, after every route, it shows errors in JSON format instaed on tradional HTML format.
app.use(errorHandler);

export { app }