import { Router } from "express";
import users from '../endpoints/users.mjs'
import rights from '../endpoints/rights.mjs'
import cakes from '../endpoints/cakes.mjs'
import reservations from '../endpoints/reservations.mjs'
import cakeIngredients from '../endpoints/cakeIngredients.mjs'
import stockIngredients from '../endpoints/stockIngredients.mjs'

const router = Router();

router.use('/users/', users)
router.use('/rights/', rights)
router.use('/cakes/', cakes)
router.use('/reservations/', reservations)
router.use('/cakeIngredients/', cakeIngredients)
router.use('/stockIngredients/', stockIngredients)


export default router;

