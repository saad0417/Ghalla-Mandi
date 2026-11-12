import Router from "express"
import { createProduct,
         deactivateProduct, 
         deleteProduct, 
         getAllProducts, 
         getProductById, 
         updateProduct } from "../controllers/product.controller.js"


const router = Router()

router.route("/create-product").post(createProduct)
router.route("/").get(getAllProducts)
router.route("/getProductById/:productId").get(getProductById)
router.route("/update-product/:productId").patch(updateProduct)
router.route("/deactivate-product/:productId").patch(deactivateProduct)
router.route("/delete-product/:productId").delete(deleteProduct)


export default router