import mongoose,{Schema} from 'mongoose';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'


const userSchema = new Schema({

    name:{
        type: String,
        required: [true, "User's name is required!"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Email is required!"],
        trim: true,
        unique: true,
        lowercase: true
    },
    password:{
        type: String,
        required: [true, "Password is required!"]
    },
    phone:{
        type: String,
    },
    role:{
        type: String,
        enum: ["SUPER_ADMIN", "MANAGER", "ACCOUNTANT", "DATA_ENTRY"],
        required: true
    },
    permissions:{
        type: [String],
        enum: ["CUSTOMER_VIEW", "CUSTOMER_MANAGE", "PRODUCT_MANAGE", "MOVEMENT_VIEW","MOVEMENT_MANAGE", "MOVEMENT_CANCEL", "PAYMENT_VIEW", "PAYMENT_MANAGE", "LOAN_VIEW", "LOAN_MANAGE", "BANK_MANAGE", "REPORT_VIEW", "USER_MANAGE"],
        default: []
    },
    isActive:{
        type: Boolean,
        default: true
    },
    lastLoginAt:{
        type: Date,
        default: null
    },
    createdBy:{
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    customer:{
        type: Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },
    refreshToken:{
        type: String
    }
}, { timestamps: true });

// password hashing
userSchema.pre("save", async function() {
    
    if(!this.isModified("password")) return

    this.password = await bcrypt.hash(this.password, 10)
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = async function() {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN
        }
    )
}

userSchema.methods.generateRefreshToken = async function() {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN
        }
    )
}

export const User = mongoose.model('User', userSchema);