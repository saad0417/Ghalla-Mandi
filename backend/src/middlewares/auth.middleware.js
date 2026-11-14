import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

// this middleware requires the user to be logged in.
export const verifyJWT = asyncHandler(async (req, _, next) => {

    try {
        // here we are accessing the token using cookies if not available in cookies then from header later we will use this access token to logout the user, actually we match the token with our database and logout the user. we are using access token for logging out because for register and login we take data from frontend and authenticate the user while in case of logout we can't take any data from frontend so we use access tokens and clear them to logout.
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if(!token)
        {
            throw new ApiError(401, "Unauthorized Request!")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        // here we are getting the user from decoded token 
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user)
        {
            throw new ApiError(401, "Invalid Access Token!")
        }
    
        // here we have access of 'req' so we are creating new object as req.user by refering it to user.
        req.user = user
        next()
    } 
    catch (error) 
    {
        throw new ApiError(401, error?.message || "Invalid Access Token!")
    }
})

export const checkPermission = (requiredPermission) => asyncHandler(async (req, res, next) => {

    if (!req.user) 
    {
        throw new ApiError(401, "Unauthorized Request!");
    }

    // SUPER_ADMIN has full access
    if (req.user.role === "SUPER_ADMIN") 
    {
        return next();
    }

    // Check whether user has the required permission
    if (!req.user.permissions.includes(requiredPermission)) 
    {
        throw new ApiError(403, "You don't have permission to perform this action!");
    }

    next();
});