import mongoose, {Schema} from 'mongoose'
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2"

const productSchema = new Schema({
    productName:{
        type: String,
        required: [true, "Product name is required!"],
        trim: true
    },
    unitOfMeasurement:{
        type: String,
        enum: ["MAUND", "KG", "BAG_40KG", "BAG_50KG", "BAG_100KG", "QUINTAL", "TON", "PIECE"],
        required: true
    },
    kgPerUnit:{
        type: Number,
    },
    isActive:{
        type: Boolean,
        default: true
    },
    createBy:{
        type: Schema.Types.ObjectId,
        ref: "User"
    }

}, {timestamps: true})

productSchema.index({productName: 1, unitOfMeasurement: 1}, {unique: true})

productSchema.plugin(mongooseAggregatePaginate)

export const Product = mongoose.model("Product", productSchema)