import mongoose, {isValidObjectId} from 'mongoose';
import {Customer} from '../models/customer.model.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/ApiError.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import generateCode from '../utils/generateCode.js'
import {uploadOnCloudinary, deleteFromCloudinary} from '../utils/cloudinary.js'
import fs from "fs/promises";

const createCustomer = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession();
    const uploadedImages = [];

    try 
    {
        // Convert JSON strings from form-data into JS values
        const securityChecks = JSON.parse(req.body.securityChecks || "[]");
        const guarantor = JSON.parse(req.body.guarantor || "null");
        const phoneNumbers = JSON.parse(req.body.phoneNumbers || "[]");
        const openingBalance = Number(req.body.openingBalance);
        const creditLimit = Number(req.body.creditLimit);


        const {name, fatherName, cnicNumber, address, customerType, isEmployee, openingBalanceDate} = req.body

        if([name, cnicNumber, address, customerType].some(field => typeof field !== "string" || field.trim() === ""))
        {
            throw new ApiError(400, "Required fields are missing!")
        }
        
        if(!Array.isArray(phoneNumbers) || phoneNumbers.length === 0)
        {
            throw new ApiError(400, "Phone numbers must be an array!")   
        }

        if (!guarantor || typeof guarantor !== "object") {
        throw new ApiError(400, "Guarantor must be a valid object!");
        }

        if (!guarantor.customer || !isValidObjectId(guarantor.customer)) {
            throw new ApiError(400, "Guarantor customer ID is invalid!");
        }

        if(req.body.openingBalance === undefined || req.body.openingBalance.trim() === "" || req.body.creditLimit === undefined || req.body.creditLimit.trim() === "" || !Number.isFinite(openingBalance) || !Number.isFinite(creditLimit)) {
            throw new ApiError(400, "Opening balance and credit limit must be valid numbers!");
        }
           

        if(typeof openingBalanceDate !== "string" || !openingBalanceDate.trim() || isNaN(Date.parse(openingBalanceDate)))
        {
            throw new ApiError(400, "Valid opening balance date is required!")
        }

        if(securityChecks !== undefined)
        {
            if(!Array.isArray(securityChecks))
            {
                throw new ApiError(400, "Security check must be an array!")
            }

            for(const check of securityChecks)
            {
                if(!check.chequeNumber?.trim() || typeof check.chequeNumber !== "string")
                {
                    throw new ApiError(400, "Cheque numnber is missing or not a string!")
                }

                if(!check.bank || !isValidObjectId(check.bank))
                {
                    throw new ApiError(400, "Bank Id is missing or not a valid Bank Id!")
                }

                if(!check.accountHolderName?.trim() || typeof check.accountHolderName !== "string")
                {
                    throw new ApiError(400, "Account Holder Name is missing or not a string!")
                }

                if(!check.amount || typeof check.amount !== "number" || check.amount <= 0)
                {
                    throw new ApiError(400, "Check amount is missing or is not valid!")
                }

                if(check.chequeDate ===  undefined || typeof check.chequeDate !== "string" || isNaN(Date.parse(check.chequeDate)))
                {
                    throw new ApiError(400, "Cheque date is missing or is invalid!")
                }

                if(!check.status?.trim() || typeof check.status !== "string" )
                {
                    throw new ApiError(400, "Check Status is missing or not a string!")
                }
            }
        }
        
        const currentBalance = openingBalance
    
        session.startTransaction();

        if (securityChecks?.length > 0) 
        {
            let securityChequeImage = null;

            if (req.files?.securityChequeImage?.[0]) 
            {
                securityChequeImage = await uploadOnCloudinary(
                    req.files.securityChequeImage[0].path,
                    "security cheque images"
                );
            }

            if(securityChequeImage) 
            {
                uploadedImages.push(securityChequeImage)
                securityChecks[0].securityChequeImage = securityChequeImage.secure_url;
            }
        }

        const cnicFrontLocalPath = req.files?.cnicFrontImage?.[0]?.path;
        const cnicBackLocalPath = req.files?.cnicBackImage?.[0]?.path;

        if(!cnicFrontLocalPath)
        {
            throw new ApiError(400, "Cnic Front Image is required!")
        }
        if(!cnicBackLocalPath)
        {
            throw new ApiError(400, "Cnic Back Image is required!")
        }

        const cnicFrontImage = await uploadOnCloudinary(cnicFrontLocalPath, "Cnic Images")
        const cnicBackImage = await uploadOnCloudinary(cnicBackLocalPath, "Cnic Images")
        
        if(!cnicFrontImage)
        {
            throw new ApiError(409, "Cnic Front Image is required-2!")
        }
            
        if(!cnicBackImage)
        {
            throw new ApiError(409, "Cnic Back Image is required-2!")
        }

        uploadedImages.push(cnicFrontImage)
        uploadedImages.push(cnicBackImage)
                
        // Generating customer code
        const customerCode = await generateCode("customer", "CUST", session)

        // Creating Customer...
        const customer = await Customer({
            customerCode,
            name,
            fatherName,
            securityChecks,
            guarantor,
            cnicNumber,
            cnicFrontImage: cnicFrontImage.secure_url,
            cnicBackImage: cnicBackImage.secure_url,
            phoneNumbers,
            address,
            customerType,
            isEmployee,
            openingBalance,
            openingBalanceDate,
            currentBalance,
            creditLimit,
            createdBy: req.user._id,
            updatedBy: req.user._id
        })

        await customer.save({session})

        if(!customer)
        {
            throw new ApiError(500, "Internal Server error while creating customer!")
        }

        await session.commitTransaction();

        return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                customer,
                "Customer created sucessfully!"
            )
        )
    } 
    catch (error) 
    {

        if (session.inTransaction()) 
            {
            await session.abortTransaction();
        }

        for (const image of uploadedImages) 
        {
            await deleteFromCloudinary(image.public_id, image.resource_type);
        }
        throw error;
    }
    finally 
    {

        for (const files of Object.values(req.files || {})) {
            for (const file of files) {
                await fs.unlink(file.path).catch(() => {});
            }
        }

        await session.endSession();
    }
})


export {createCustomer}