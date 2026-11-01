import {Router} from 'express'
import { createBank } from '../controllers/bank.controller.js'

const router = Router()

router.route("/create-bank").get(createBank)

export default router