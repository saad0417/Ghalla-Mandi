import {Router} from 'express'
import {createBank,
        deactivateBank, 
        deleteBank, 
        getAllBanks, 
        getBankbyId, 
        updateBank } from '../controllers/bank.controller.js'

const router = Router()

router.route("/create-bank").post(createBank)
router.route("/get-all-banks").get(getAllBanks)
router.route("/getBankById/:bankId").get(getBankbyId)
router.route("/update-bank/:bankId").patch(updateBank)
router.route("/deactivate-bank/:bankId").patch(deactivateBank)
router.route("/delete-bank/:bankId").delete(deleteBank)


export default router
