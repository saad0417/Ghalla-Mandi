import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import mongoose, {isValidObjectId} from 'mongoose'
import { Bank } from '../models/bank.model.js'
import { json } from 'express'


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

const getAllBanks = asyncHandler(async (req, res) => {

    const allBanks = await Bank.find().sort({ createdAt: -1 })

    if(allBanks.length === 0)
    {
        throw new ApiError(404, "No Banks Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            allBanks,
            "All banks fetched sucessfully!"
        )
    )
})

const getBankbyId = asyncHandler(async (req, res) => {
    const { bankId } = req.params

    if(!isValidObjectId(bankId))
    {
        throw new ApiError(400, "Invalid bank Id!")
    }

    if(!bankId)
    {
        throw new ApiError(400, "Bank Id is missing!")
    }

    const bank = await Bank.findById(bankId)

    if(!bankId)
    {
        throw new ApiError(404, "No bank with this id found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            bank,
            "bank fetched sucessfully!"
        )
    )

})

const updateBank = asyncHandler(async (req, res) => {

    const { bankId } = req.params

    if(!isValidObjectId(bankId))
    {
        throw new ApiError(400, "Invalid bank Id!")
    }

    if(!bankId)
    {
        throw new ApiError(400, "Bank Id is missing!")
    }

    const {bankName, shortName, branchName, branchCode, isActive} = req.body

    const updateBankData = {}

    if(bankName !== undefined) updateBankData.bankName = bankName
    if(shortName !== undefined) updateBankData.shortName = shortName
    if(branchName !== undefined) updateBankData.branchName = branchName
    if(branchCode !== undefined) updateBankData.branchCode = branchCode
    if(isActive !== undefined) updateBankData.isActive = isActive


    const updateBank = await Bank.findByIdAndUpdate(
        bankId,
        {
            $set: updateBankData    
        },
        {
            new: true,
            // This ensures that updated values follow your Bank schema validations.
            runValidators: true
        }
    )

    if(!updateBank)
    {
        throw new ApiError(404, "Bank not found!")
    }

    if (Object.keys(updateBankData).length === 0) 
    {
        throw new ApiError(400, "No fields provided for update!");
    }
    
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updateBank,
            "Bank Details Updated Sucessfully!"
        )
    )
})

const deactivateBank = asyncHandler(async (req, res) => {
    const {bankId} = req.params

    if(!isValidObjectId(bankId))
    {
        throw new ApiError(400, "Invalid bank Id!")
    }

    if(!bankId)
    {
        throw new ApiError(400, "Bank Id is missing!")
    }

    const deactivateBank = await Bank.findByIdAndUpdate(
        bankId,
        {
            $set:{
                isActive: false
            }
        },
        {
            new: true
        }
    )

    if(!deactivateBank)
    {
        throw new ApiError(500, "Internal server error whhile deactivating bank!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            "Bank deactivated sucessfully!"
        )
    )
})

const deleteBank = asyncHandler(async (req, res) => {

    const { bankId } = req.params;

    if (!bankId) 
    {
        throw new ApiError(400, "Bank Id is missing!");
    }

    if (!isValidObjectId(bankId)) 
    {
        throw new ApiError(400, "Invalid bank Id!");
    }

    const deletedBank = await Bank.findByIdAndDelete(bankId);

    if (!deletedBank) 
    {
        throw new ApiError(404, "Bank not found!");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Bank Deleted Successfully!"
        )
    );
});

export { createBank, getAllBanks, getBankbyId, updateBank, deactivateBank, deleteBank }