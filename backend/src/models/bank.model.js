import mongoose, {Schema} from 'mongoose'

const bankSchema = new Schema({
    
    bankName:{
        type: String,
        required: [true, "Bank name is required!"]
    },
    shortName:{
        type: String,
    },
    branchName:{
        type: String
    },
    branchCode:{
        type: String,
        required: true,
        match: [/^\d{4}$/, "Branch code must be exactly 4 digits"]
    },
    isActive:{
        type: Boolean,
        default: true,
        required: true
    },
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: "User"
    }

},{timestamps: true})

// bankName can repeat: HBL appears many times ✓
// branchCode can repeat: UBL and HBL could both have a branch coded 0123 ✓
// The pair together must be new each time
bankSchema.index({bankName: 1, branchCode: 1}, {unique: true})

export const Bank = mongoose.model("Bank", bankSchema)