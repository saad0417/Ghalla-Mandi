import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import mongoose, {isValidObjectId} from 'mongoose'
import { Bank } from '../models/bank.model.js'


const createBank = asyncHandler(async (req,res) => {
    
    const {bankName, shortName, branchName, branchCode} = req.body

    if(!bankName?.trim() || !branchCode?.trim())
    {
        throw new ApiError(400, "bankName or branchCode is missing!")
    }

    const existedBank = await Bank.findOne({ bankName, branchCode })

    if(existedBank)
    {
        throw new ApiError(409, "Bank name with this branch code already exists!")
    }

    const bank = await Bank.create(
        {
            bankName,
            shortName,
            branchName,
            branchCode,
            // createdBy: req.user._id
        }
    )

    if(!bank)
    {
        throw new ApiError(500, "Interanl server error while creating bank!")
    }

    return res
    .status(201)
    .json(
        new ApiResponse(
            201,
            bank,
            "Bank created sucessfully!"
        )
    )
})

export { createBank }