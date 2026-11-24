import {Router} from "express";
import {
        createCustomer, 
        getAllCustomers, 
        getCustomerById, 
        toggleCustomerActivation, 
        updateCnicImages, 
        updateCustomer,
        updateSecurityCheckImage} from '../controllers/customer.controller.js'
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
        createCustomer
    );

    router.route("/getCustomerById/:customerId").get(checkPermission("CUSTOMER_VIEW"), getCustomerById)
    router.route("/getAllCustomers").get(checkPermission("CUSTOMER_VIEW"), getAllCustomers)
    router.route("/update-customer/:customerId/:checkId").patch(checkPermission("CUSTOMER_MANAGE"), updateCustomer)
    
    router.route("/toggle-customer-activation/:customerId").patch(checkPermission("CUSTOMER_MANAGE"), toggleCustomerActivation)
    
    router.route("/update-cnic-images/:customerId").patch(
        upload.fields([
            { name: "cnicFrontImage", maxCount: 1 },
            { name: "cnicBackImage", maxCount: 1 },
        ]),
        checkPermission("CUSTOMER_MANAGE"), 
        updateCnicImages)

    router.route("/update-security-cheque-image/:customerId/:checkId").patch(
        upload.fields([
            { name: "securityChequeImage", maxCount: 1 }
        ]),
        checkPermission("CUSTOMER_MANAGE"), 
        updateSecurityCheckImage)

export default router;