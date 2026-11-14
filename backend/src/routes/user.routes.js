import Router from "express";
import { checkPermission } from "../middlewares/auth.middleware.js";
import { 
    deactivateUser,
    deleteUser, 
    reactivateUser, 
    registerUser, 
    updateAccountDetails 
} from "../controllers/user.controller.js";


const router = Router()

router.route("/register").post(checkPermission("USER_MANAGE"), registerUser)
router.route("/update-details/:userId").patch(checkPermission("USER_MANAGE"), updateAccountDetails)
router.route("/deactivate-user/:userId").patch(checkPermission("USER_MANAGE"), deactivateUser)
router.route("/reactivate-user/:userId").patch(checkPermission("USER_MANAGE"), reactivateUser)
router.route("/delete-user/:userId").delete(checkPermission("USER_MANAGE"), deleteUser)

export default router