import mongoose, {isValidObjectId} from 'mongoose';
import {Customer} from '../models/customer.model.js';
import {Bank} from "../models/bank.model.js";
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
            throw new ApiError(400, "Phone numbers must be an array(or is empty)!")   
        }

        if (!guarantor || typeof guarantor !== "object") 
        {
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
            if(!Array.isArray(securityChecks) || securityChecks.length === 0)
            {
                throw new ApiError(400, "Security check must be an array(or is empty)!")
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
                    throw new ApiError(400, "Cheque amount is missing or is not valid!")
                }

                if(check.chequeDate ===  undefined || typeof check.chequeDate !== "string" || isNaN(Date.parse(check.chequeDate)))
                {
                    throw new ApiError(400, "Cheque date is missing or is invalid!")
                }

                if(!check.status?.trim() || typeof check.status !== "string" )
                {
                    throw new ApiError(400, "Cheque Status is missing or not a string!")
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

const getCustomerById = asyncHandler(async (req, res) => {
    
    const {customerId} = req.params

    if(!customerId.trim())
    {
        throw new ApiError(400, "Customer Id is missing!")
    }

    if(!isValidObjectId(customerId))
    {
        throw new ApiError(400, "Invalid Customer Id!")
    }

    const customer = await Customer.findById(customerId)

    if(!customer)
    {
        throw new ApiError(404, "Customer not found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            customer,
            "Customer details fetched sucessfully!"
        )
    )
})

const getAllCustomers = asyncHandler(async (req, res) => {

    const {customerType} = req.query || "BOTH"
    const {isActive} = req.query
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 10

    const skip = (page - 1) * limit

    const totalCustomers = await Customer.countDocuments()
    const totalPages = Math.ceil(totalCustomers / limit)

    const filter = {}

    if(customerType) filter.customerType = customerType
    if(isActive) filter.isActive = isActive

    const allCustomers = await Customer.find(filter)
                                       .skip(skip)
                                       .limit(limit)
                                       .sort({createdAt: -1})

    if(!allCustomers)
    {
        throw new ApiError(404, "No Customers Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                customers: allCustomers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCustomers,
                    limit
                }
            },
            "All Customers Fetched Successfully!"
        )
    )
})

const updateCustomer = asyncHandler(async (req, res) => {

    const {name, fatherName, securityChecks, guarantor, cnicNumber, phoneNumbers, address, customerType, creditLimit} = req.body

    const {customerId} = req.params

    if(!customerId?.trim())
    {
        throw new ApiError(400, "Customer Id is missing!")
    }

    if(!isValidObjectId(customerId))
    {
        throw new ApiError(400, "Invalid Customer Id!")
    }

    const existingCheck = await Customer.findById(customerId);

    if (!existingCheck) 
    {
        throw new ApiError(404, "Customer not found!");
    }

    const updateCustomer = {}

    if(name !== undefined) updateCustomer.name = name;
    if(fatherName !== undefined) updateCustomer.fatherName = fatherName;
    if(cnicNumber !== undefined) updateCustomer.cnicNumber = cnicNumber;
    if (phoneNumbers !== undefined) 
    {
        if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) 
        {
            throw new ApiError(400, "Invalid phone numbers!");
        }

        updateCustomer.phoneNumbers = phoneNumbers;
    }
    if(address !== undefined) updateCustomer.address = address;
    if(customerType !== undefined) updateCustomer.customerType = customerType;

    if (creditLimit !== undefined) 
    {
        const value = Number(creditLimit);

        if (!Number.isFinite(value) || value < 0) {
            throw new ApiError(400, "Invalid credit limit!");
        }

        updateCustomer.creditLimit = value;
    }

    if (guarantor !== undefined) 
    {
        if ( !guarantor || typeof guarantor !== "object" || Array.isArray(guarantor) || !isValidObjectId(guarantor.customer))
        {
            throw new ApiError(400, "Invalid Guarantor Details!");
        }

        if (guarantor.customer === customerId) 
        {
            throw new ApiError(400, "Customer cannot be their own guarantor!");
        }

        const existingGuarantor = await Customer.findById(guarantor.customer);

        if (!existingGuarantor)
        {
            throw new ApiError(404, "Guarantor customer not found!");
        }

        updateCustomer.guarantor = {
            ...existingCheck.guarantor.toObject(),
            ...guarantor
        };
    }

    if(securityChecks !== undefined)
    {
        if(!Array.isArray(securityChecks))
        {
            throw new ApiError(400, "Security check must be an array!")
        }
        
        for(const check of securityChecks)
        {
            if (!check || typeof check !== "object" || Array.isArray(check)) 
                {
                    throw new ApiError(400, "Invalid security check details!");
                }

            if (!isValidObjectId(check._id)) 
            {
                throw new ApiError(400, "Invalid Security Check Id!");
            }

            const cheque = existingCheck.securityChecks.id(check._id);

            if (!cheque) 
            {
                throw new ApiError(404, "Security Check not found!");
            }

            if(check.chequeNumber !== undefined)
            {
                if(typeof check.chequeNumber !== "string" || !check.chequeNumber?.trim())
                {
                    throw new ApiError(400, "Invalid Cheque Number!")
                }

                cheque.chequeNumber = check.chequeNumber
            }

            if(check.bank !== undefined)
            {
                if(!check.bank?.trim() || !isValidObjectId(check.bank))
                {
                    throw new ApiError(400, "Invalid bank id")
                }
                const existingBank = await Bank.findById(check.bank)
                
                if(!existingBank)
                {
                    throw new ApiError(404, "No Bank Found!")
                }

                cheque.bank = check.bank
            }

            if(check.accountHolderName !== undefined)
            {
                if(typeof check.accountHolderName !== "string" || !check.accountHolderName?.trim())
                {
                    throw new ApiError(400, "Account Holder Name is missing or not a string!")
                }

                cheque.accountHolderName = check.accountHolderName
            }

            if (check.amount !== undefined) 
            {
                if (typeof check.amount !== "number" || !Number.isFinite(check.amount) || check.amount <= 0) 
                {
                    throw new ApiError(400, "Invalid cheque amount!");
                }

                cheque.amount = check.amount;
            }

            if(check.chequeDate !==  undefined)
            {
                if(typeof check.chequeDate !== "string" || !check?.chequeDate.trim() || isNaN(Date.parse(check.chequeDate)))
                {
                    throw new ApiError(400, "Cheque date is missing or is invalid!")
                }

                cheque.chequeDate = check.chequeDate
            }

            if(check.status !== undefined)
            {
                if(typeof check.status !== "string" || !check.status?.trim())
                {
                    throw new ApiError(400, "Cheque Status is missing or not a string!")
                }

                cheque.status = check.status
            }
        }
    }

    Object.assign(existingCheck, updateCustomer);

    existingCheck.updatedBy = req.user._id;
    console.log("Received:", req.body.guarantor);

console.log("Before save:", existingCheck.guarantor);

await existingCheck.save();

console.log("After save:", existingCheck.guarantor);

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            existingCheck,
            "Customer Details Updated Sucessfully!"
        )
    )
})

const updateCnicImages = asyncHandler(async (req, res) => {
    const {customerId} = req.params

    if(!customerId.trim())
    {
        throw new ApiError(400, "Customer Id is missing!")
    }

    if(!isValidObjectId(customerId))
    {
        throw new ApiError(400, "Invalid Customer Id!")
    } 

    const cnicFrontLocalPath = req.files?.cnicFrontImage?.[0]?.path;

    if(!cnicFrontLocalPath)
    {
        throw new ApiError(400, "Cnic Front Image is Missing!")
    }

    const cnicBackLocalPath = req.files?.cnicBackImage?.[0]?.path;

    if(!cnicBackLocalPath)
    {
        throw new ApiError(400, "Cnic Back Image is Missing!")
    }

    const customer = await Customer.findById(customerId)

    if(!customer)
    {
        throw new ApiError(404, "Customer not found!")
    }

    const frontOldPublicId = decodeURIComponent(
    customer.cnicFrontImage
        ?.split("/upload/")[1]
        ?.replace(/^v\d+\//, "")
        ?.replace(/\.[^/.]+$/, "")
    );

    const backOldPublicId = decodeURIComponent(
    customer.cnicBackImage
        ?.split("/upload/")[1]
        ?.replace(/^v\d+\//, "")
        ?.replace(/\.[^/.]+$/, "")
    );

    const newCnicFrontImage = await uploadOnCloudinary(cnicFrontLocalPath, "Cnic Images")

    if(!newCnicFrontImage?.secure_url)
    {
        throw new ApiError(400, "Error while uploading cnic front image on cloudinary!")
    }

    const newCnicBackImage = await uploadOnCloudinary(cnicBackLocalPath, "Cnic Images")

    if(!newCnicBackImage?.secure_url)
    {
        throw new ApiError(400, "Error while uploading cnic back image on cloudinary!")
    }

    if(frontOldPublicId)
    {
        await deleteFromCloudinary(frontOldPublicId)
    }

    if(backOldPublicId)
    {
        await deleteFromCloudinary(backOldPublicId)
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
        customerId,
        {
            $set:{
                cnicFrontImage: newCnicFrontImage.secure_url,
                cnicBackImage: newCnicBackImage.secure_url,
                updatedBy: req.user._id
            }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedCustomer,
            "Cnic images updated successfully!"
        )
    )
})

const updateSecurityCheckImage = asyncHandler(async (req, res) => {

    const { customerId, checkId } = req.params;

    if (!customerId?.trim()) {
        throw new ApiError(400, "Customer Id is missing!");
    }

    if (!isValidObjectId(customerId)) {
        throw new ApiError(400, "Invalid Customer Id!");
    }

    if (!checkId?.trim()) {
        throw new ApiError(400, "Security Check Id is missing!");
    }

    if (!isValidObjectId(checkId)) {
        throw new ApiError(400, "Invalid Security Check Id!");
    }

    const securityChequeImageLocalPath = req.files?.securityChequeImage?.[0]?.path;

    if (!securityChequeImageLocalPath) {
        throw new ApiError(400, "Security Cheque Image is Missing!");
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
        throw new ApiError(404, "Customer not found!");
    }

    const securityCheck = customer.securityChecks.id(checkId);

    if (!securityCheck) {
        throw new ApiError(404, "Security Check not found!");
    }

    // Extract old Cloudinary Public ID
    const oldImageUrl = securityCheck.securityChequeImage;

    const oldPublicId = oldImageUrl
        ? decodeURIComponent(
            oldImageUrl
                .split("/upload/")[1]
                ?.replace(/^v\d+\//, "")
                ?.replace(/\.[^/.]+$/, "")
        )
        : null;

    // Upload new image
    const newSecurityChequeImage = await uploadOnCloudinary(securityChequeImageLocalPath, "security cheque images");

    if (!newSecurityChequeImage?.secure_url) {
        throw new ApiError(400,"Error while uploading security cheque image to Cloudinary!");
    }

    // Update specific security check
    securityCheck.securityChequeImage = newSecurityChequeImage.secure_url;

    customer.updatedBy = req.user._id;

    try {
        await customer.save();
    } catch (error) {
        // Delete newly uploaded image if database update fails
        await deleteFromCloudinary(newSecurityChequeImage.public_id);
        throw error;
    }

    // Delete old image after successful database update
    if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                customer,
                "Security cheque image updated successfully!"
            )
        );

});

const toggleCustomerActivation = asyncHandler(async (req, res) => {

    const {customerId} = req.params

    if(!customerId.trim())
    {
        throw new ApiError(400, "Customer Id is missing!")
    }

    if(!isValidObjectId(customerId))
    {
        throw new ApiError(400, "Invalid Customer Id!")
    }

    const customer = await Customer.findById(customerId);

    if (!customer) {
        throw new ApiError(404, "Customer not found!");
    }

    const toggle = await Customer.findByIdAndUpdate(
        customerId,
        {
            $set: {
                isActive: !customer.isActive,
                updatedBy: req.user._id
            }
        },
        { new: true }
    );

    if(!toggle)
    {
        throw new ApiError(404, "Customer not found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            toggle,
            `Customer ${toggle.isActive ? "Activated" : "Deactivated"} Sucessfully!`
        )
    )
    
})


const searchCustomer = asyncHandler(async (req, res) => {

    const search = req.query.search?.trim();
    const normalizedSearch = search?.replace(/-/g, "");

    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 10, 1);

    const skip = (page - 1) * limit;


    const filter = search
    ? {
        $or: [
            { name: { $regex: search, $options: "i" } },
            { phoneNumbers: { $regex: normalizedSearch, $options: "i" } },
            {
                $expr: {
                    $regexMatch: {
                        input: {
                            $replaceAll: {
                                input: "$cnicNumber",
                                find: "-",
                                replacement: ""
                            }
                        },
                        regex: normalizedSearch,
                        options: "i"
                    }
                }
            },
            {
                $expr: {
                    $regexMatch: {
                        input: {
                            $replaceAll: {
                                input: { $ifNull: ["$customerCode", ""] },
                                find: "-",
                                replacement: ""
                            }
                        },
                        regex: normalizedSearch,
                        options: "i"
                    }
                }
            }
        ]
    }
    : {};

    const totalCustomers = await Customer.countDocuments(filter);

    const totalPages = Math.ceil(totalCustomers / limit);

    const customers = await Customer.find(filter)
        .skip(skip)
        .limit(limit);

    if (!customers.length) {
        throw new ApiError(404, "No Customer Found!");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                customers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCustomers,
                    limit
                }
            },
            "Customers Fetched Successfully!"
        )
    );
});



export {
    createCustomer, 
    getCustomerById, 
    getAllCustomers, 
    updateCustomer, 
    toggleCustomerActivation, 
    updateCnicImages, 
    updateSecurityCheckImage,
    searchCustomer}