import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import {User} from '../models/user.model.js'
import jwt from "jsonwebtoken";
import { application } from 'express';
import { isValidObjectId } from 'mongoose';

const generateAccessRefreshToken = async (userId) => {
    try {
        
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken

        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } 
    catch (error) 
    {
        throw new ApiError(500, 'Something went worng while generating access and refresh token!')    
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // 1. get details from Frontend
    // 2. validation - email, password more (must not be empty)
    // 3. check if user already exists: username, email
    // 4. create user object - create entry in db
    // 5. remove password and refresh token field from response
    // 6. check for user creation
    // 7. return responese

    const {name, email, password, phone, role, permissions} = req.body

   if(!name?.trim() || !email?.trim() || !password?.trim() || !role?.trim()) 
    {
        throw new ApiError(400, "Required fields are missing!");
    }

    const existedUser = await User.findOne({email})

    if(existedUser)
    {
        throw new ApiError(400, "User with this email already exists!")
    }

   const userData = {
        name,
        email,
        password,
        role,
        createdBy: req.user._id
    };

    if(phone?.trim() !== "") userData.phone = phone
    // permissions is an array so we can trim it.
    if(permissions) userData.permissions = permissions


    const user = await User.create(userData)

    const checkUserCreated = await User.findById(user._id).select("-password -refreshToken")

    if(!checkUserCreated)
    {
        throw new ApiError(500, "Internal server error while regitering user!")
    }

    return res
    .status(201)
    .json(
        new ApiResponse(
            201,
            checkUserCreated,
            "User Regitered Sucessfully!"
        )
    )
})

const loginUser = asyncHandler(async (req, res) => {

    // 1. req body --> data
    // 2. username or email (check empty)
    // 3. find user
    // 4. password (if exists)
    // 5. generate access and refresh token
    // 6. send them in secure cookies

    const {email, password} = req.body

    if(!email?.trim() || !password?.trim())
    {
        throw new ApiError(400, "Email & Password is required!")
    }

    const user = await User.findOne({email})

    if(!user)
    {
        throw new ApiError(404, "User not found!")
    }

    const checkPassword = await user.isPasswordCorrect(password)

    if(!checkPassword)
    {
        throw new ApiError(400, "Password is incorrect!")
    }

    const {accessToken, refreshToken} = await generateAccessRefreshToken(user._id)

    const loggedInUser = await User.findByIdAndUpdate(
        user._id,
        {
            $set:{
                lastLoginAt: Date.now()
            }
        },{ new: true }
    ).select("-password -refreshToken")



    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser
            },
            "User LoggedIn Sucessfully!"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken: 1
            }
        },{new: true}
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200,
            {},
            "User Logged Out Sucessfully!"
        )
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken)
    {
        throw new ApiError(401, "Unauthorized Request!")
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    } 
    catch (error) 
    {
        throw new ApiError(401, error?.message || "Invalid Refresh Token!")
    }


    const user = await User.findById(decodedToken?._id)

    if(!user)
    {
        throw new ApiError(400, "Invalid Refresh Token!")
    }

    if(incomingRefreshToken !== user?.refreshToken)
    {
        throw new ApiError(401, "Refresh token is used or expired!")
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateAccessRefreshToken(user?._id)

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
        new ApiResponse(
            200,
            {},
            "Access Token Refreshed Sucessfully!"
        )
    )
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    
    const {oldPassword, newPassword} = req.body

    if(!oldPassword?.trim() || !newPassword?.trim())
    {
        throw new ApiError(400, "Please fill all the detils!")
    }

    const user = await User.findById(req.user._id)

    if (!user) 
    {
        throw new ApiError(404, "User not found!");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect)
    {
        throw new ApiError(400, "Wrong Old Password!")
    }

    user.password = newPassword.trim()
    await user.save()

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Passowrd Changed Sucessfully!"
        )
    )
})

const getCurrentUser = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user._id).select("-password -refreshToken")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Current user fetched sucessfully!"
        )
    )
})

const updateAccountDetails = asyncHandler(async (req, res) => {

    const {userId} = req.params

    if(!userId)
    {
        throw new ApiError(400, "User Id is missing!")
    }

    if(!isValidObjectId(userId))
    {
        throw new ApiError(400, "Invalid User Id!")
    }

    const findUser = await User.findById(userId);

    if (!findUser) 
    {
        throw new ApiError(404, "User not found!");
    }


    const {name, email, phone, role, permissions, isActive} = req.body

    const updatedUser = {}

    if(name?.trim()) updatedUser.name = name.trim()
    if(email?.trim()) updatedUser.email = email.trim()
    if(phone?.trim()) updatedUser.phone = phone.trim()
    if(role !== undefined) updatedUser.role = role
    if(isActive !== undefined) updatedUser.isActive = isActive
    
    if (permissions !== undefined) 
    {
        if (!Array.isArray(permissions)) 
        {
            throw new ApiError(400, "Permissions must be an array!");
        }

        updatedUser.permissions = [...new Set(permissions)];
    }

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $set: updatedUser
        },
        {new: true}
    ).select("-password -refreshToken")

    if(!user)
    {
        throw new ApiError(500, "Internal server error while updating user details!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "User details updated sucessfully!"
        )
    )
})

const deactivateUser = asyncHandler(async (req, res) => {
    
    const {userId} = req.params

    if(!userId)
    {
        throw new ApiError(400, "User Id is missing!")
    }

    if(!isValidObjectId(userId))
    {
        throw new ApiError(400, "Invalid User Id!")
    }

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $set:{
                isActive: false
            }
        },{new: true}
    )

    if(!user)
    {
        throw new ApiError(400, "User Not Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "User Deactivated Sucessfully!"
        )
    )
})

const reactivateUser = asyncHandler(async (req, res) => {
    
    const {userId} = req.params

    if(!userId)
    {
        throw new ApiError(400, "User Id is missing!")
    }

    if(!isValidObjectId(userId))
    {
        throw new ApiError(400, "Invalid User Id!")
    }

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $set:{
                isActive: true
            }
        },{new: true}
    )

    if(!user)
    {
        throw new ApiError(400, "User Not Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "User Reactivated Sucessfully!"
        )
    )
})

const deleteUser = asyncHandler(async (req, res) => {

    const {userId} = req.params

    if(!userId)
    {
        throw new ApiError(400, "User Id is missing!")
    }

    if(!isValidObjectId(userId))
    {
        throw new ApiError(400, "Invalid User Id!")
    }

    const user = await User.findByIdAndDelete(userId)

    if(!user)
    {
        throw new ApiError(400, "User Not Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "User Deleted Sucessfully!"
        )
    )
})


export {
    registerUser,
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser,
    updateAccountDetails,
    deactivateUser,
    reactivateUser,
    deleteUser
}