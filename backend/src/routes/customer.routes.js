import {Router} from "express";
import {createCustomer} from '../controllers/customer.controller.js'
import {checkPermission} from '../middlewares/auth.middleware.js'
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/create-customer")
    .post(
        upload.fields([
            { name: "cnicFrontImage", maxCount: 1 },
            { name: "cnicBackImage", maxCount: 1 },
            { name: "securityChequeImage", maxCount: 1 }
        ]),
        checkPermission("CUSTOMER_MANAGE"),
        (req, res, next) => {
            console.log("BODY:", req.body);
            console.log("FILES:", req.files);
            next();
        },
        createCustomer
    );

export default router;