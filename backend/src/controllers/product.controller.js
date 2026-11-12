import mongoose, {isValidObjectId} from 'mongoose'
import { Product } from "../models/product.model.js";
import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {ApiResponse} from '../utils/ApiResponse.js'

const createProduct = asyncHandler(async (req, res) => {

    const {productName, unitOfMeasurement, kgPerUnit} = req.body

    if(!productName?.trim() || !unitOfMeasurement?.trim())
    {
        throw new ApiError(400, "product name of unit of measurement is missing!")
    }

    const productDetails = {}

    productDetails.productName = productName
    productDetails.unitOfMeasurement = unitOfMeasurement
    
    if(kgPerUnit !== undefined)
    {
        productDetails.kgPerUnit = kgPerUnit
    }

    const duplicateProduct = await Product.findOne({productName, unitOfMeasurement})

    if(duplicateProduct)
    {
        throw new ApiError(409, "Product with this unit already exists!")
    }

    const product = await Product.create(productDetails)

    if(!product)
    {
        throw new ApiError(500, "Internal server error while creating product!")
    }

    return res
    .status(201)
    .json(
        new ApiResponse(
            201,
            product,
            "Product Created Sucessfully!"
        )
    )

})

const getAllProducts = asyncHandler(async (req, res) => {

    const page = Number(req.query.page) || 1
    const limit = 10

    const skip = (page -1) * limit

    // it just tells the frontend that after totalProducts/limit there are total 10 pages so how products will fit on it according to 10 product limit per page
    const totalProducts = await Product.countDocuments()

    const totalPages = Math.ceil(totalProducts / limit)

    const allProducts = await Product.find()
                                     .skip(skip)
                                     .limit(limit)
                                     .sort({createdAt: -1});


    if(!allProducts)
    {
        throw new ApiError(404, "No product found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                products: allProducts,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalProducts,
                    limit
                }
            },
            "Product details fetched sucessfully!"
        )
    )
})

const getProductById = asyncHandler(async(req, res) => {
    const { productId } = req.params
    
    if(!productId?.trim())
    {
        throw new ApiError(400, "Product Id is missing!")
    }

    if(!isValidObjectId(productId))
    {
        throw new ApiError(400, "Invalid Product Id!")
    }

    const product = await Product.findById(productId)

    if(!product)
    {
        throw new ApiError(404, "No Product Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            product,
            "Product Fetched Sucessfully!"
        )
    )
})

const updateProduct = asyncHandler(async(req, res) => {

    const {productId} = req.params

    if(!productId?.trim())
    {
        throw new ApiError(400, "Product is is missing!")
    }

    if(!isValidObjectId(productId))
    {
        throw new ApiError(400, "Invalid Product Id!")
    }

    const {productName, unitOfMeasurement, kgPerUnit, isActive} = req.body

    const productDetails = {}

    if(productName !== undefined) productDetails.productName = productName
    if(unitOfMeasurement !== undefined) productDetails.unitOfMeasurement = unitOfMeasurement
    if(kgPerUnit !== undefined) productDetails.kgPerUnit = kgPerUnit
    if(isActive !== undefined) productDetails.isActive = isActive

    const updateProduct = await Product.findByIdAndUpdate(
        productId,
        {
            $set: productDetails
        },
        {
            new: true,
            runValidators: true
        }
    )

    if(!updateProduct)
    {
        throw new ApiError(500, "Internal server error while updating product")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updateProduct,
            "Product Upadated Sucessfully!"
        )
    )
})

const deactivateProduct = asyncHandler(async (req, res) => {

    const {productId} = req.params

    if(!productId?.trim())
    {
        throw new ApiError(400, "Product is is missing!")
    }

    if(!isValidObjectId(productId))
    {
        throw new ApiError(400, "Invalid Product Id!")
    }

    const deactivate = await Product.findByIdAndUpdate(
        productId,
        {
            $set:{
                isActive: false
            }
        },
        {new: true}
    )

    if(!deactivate)
    {
        throw new ApiError(500, "Internal server error while deactivating product!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            "Product deactivated sucessfully!"
        )
    )

})

const deleteProduct = asyncHandler(async (req, res) => {

    const {productId} = req.params

    if(!productId?.trim())
    {
        throw new ApiError(400, "Product is is missing!")
    }

    if(!isValidObjectId(productId))
    {
        throw new ApiError(400, "Invalid Product Id!")
    }

    const deleteProduct = await Product.findByIdAndDelete(productId)

    if(!deleteProduct)
    {
        throw new ApiError(404, "No Product Found!")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "Product deleted sucessfully!"
        )
    )
})

export {createProduct, getAllProducts, getProductById, updateProduct, deactivateProduct, deleteProduct}