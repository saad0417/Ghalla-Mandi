import mongoose, {Schema} from 'mongoose';

const securityCheckSchema = new Schema({
    chequeNumber:{
        type: String,
        required: [true, "Cheque no is required!"]
    },
    bank:{
        type: Schema.Types.ObjectId,
        ref: "Bank",
        required: true
    },
    accountHolderName: {
        type: String,
        required: true
    },
    amount:{
        type: Number,
        required: true
    },
    chequeDate:{
        type: Date,
        required: true
    },
    image:{
        type: String    // URL from cloudinary
    },
    status:{
        type: String,
        enum:["HELD", "RETURNED", "DEPOSITED", "CLEARED", "BOUNCED"],
        required: true
    },
    notes:{
        type: String
    }

}, {_id: false})

const guarantorInfoSchema = new Schema({
    customer:{
        type: Schema.Types.ObjectId,
        ref: "Customer",
        required: true,
    },
    relation:{
        type: String,
        enum: ["FATHER", "BROTHER", "UNCLE", "FRIEND", "BUSINESS_PARTNER", "OTHER"]
    }
}, {_id: false})


const customerSchema = new Schema({
    customerCode:{
        type: String,
        unique: true,
        required: true
    },
    name:{
        type: String,
        required: true,
        trim: true
    },
    fatherName:{
        type: String
    },
    securityChecks:[
        securityCheckSchema
    ],

    guarantor:{
        type: guarantorInfoSchema,
        required: true
    },

    cnicNumber:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    cnicFrontImage:{
        type: String,
        required: true
    },
    cnicBackImage:{
        type: String,
        required: true
    },
    phoneNumbers:{
        type: [String],
        required: true,
        validate:{
            validator: value => value.length > 0,
            message: "Atleast 1 phone no is required!"
        }
    },
    address:{
        type: String,
        required: true,
        trim: true
    },
    customerType:{
        type: String,
        required: true,
        enum: ["BUYER", "SELLER", "BOTH"]   
    },
    isEmployee:{
        type: Boolean,
        default: false
    },
    openingBalance:{
        type: Number,
        required: true
    },
    openingBalanceDate:{
        type: Date,
        required: true
    },
    currentBalance:{
        type: Number,
        required: true
    },
    creditLimit:{
        type: Number
    },
    isActive:{
        type: Boolean,
        default: true
    },
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    updatedBy:{
        type: Schema.Types.ObjectId,
        ref: "User"
    }

}, {timestamps: true})

customerSchema.index({name: 1})

export const Customer = mongoose.model("Customer", customerSchema)