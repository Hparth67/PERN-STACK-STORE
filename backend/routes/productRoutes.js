import expres from "express";
import { getAllProducts,createProduct } from "../controllers/productContorller.js"

const router = expres.Router();

router.get("/", getAllProducts);
router.post("/", createProduct);


export default router;