import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

const router = Router();


// Adaugă un ingredient necesar nouă (doar admin)
router.post('/addStockIngredient', userAuthMiddleware, async (req, res) => {

    try {

        const { name, stock_quantity } = req.body;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const [id] = await db('ingredients').insert({ name, stock_quantity, admin_id: userId });
        const ingredients = await db('ingredients').where({ id }).first();
        return sendJsonResponse(res, true, 201, "Ingredientul a fost adăugat cu succes!", { ingredients });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea ingredientului!", { details: error.message });
    }
});

// Actualizează un ingredient
router.put('/updateStockIngredient/:stockIngredientId', userAuthMiddleware, async (req, res) => {

    try {

        const { stockIngredientId } = req.params;
        const { name, stock_quantity } = req.body;
        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients').where({ id: stockIngredientId }).first();

        if (!ingredients) return sendJsonResponse(res, false, 404, "Ingredientul nu există!", []);

        await db('ingredients').where({ id: stockIngredientId }).update({
            name: name || ingredients.name,
            stock_quantity: stock_quantity || ingredients.stock_quantity
        });
        const updated = await db('ingredients').where({ id: stockIngredientId }).first();
        return sendJsonResponse(res, true, 200, "Ingredientul a fost actualizat cu succes!", { ingredients: updated });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la actualizarea ingredientului!", { details: error.message });
    }
});

// Șterge un ingredient
router.delete('/deleteStockIngredient/:stockIngredientId', userAuthMiddleware, async (req, res) => {
    try {

        const { stockIngredientId } = req.params;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients').where({ id: stockIngredientId }).first();
        if (!ingredients) return sendJsonResponse(res, false, 404, "Ingredientul nu există!", []);
        await db('ingredients').where({ id: stockIngredientId }).del();
        return sendJsonResponse(res, true, 200, "Ingredientul a fost șters cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea ingredientului!", { details: error.message });
    }
});

// Obține un ingredient după id
router.get('/getStockIngredientById/:stockIngredientId', userAuthMiddleware, async (req, res) => {

    try {

        const { stockIngredientId } = req.params;
        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients')
            .where('ingredients.id', stockIngredientId)
            .select(
                'ingredients.id',
                'ingredients.name',
                'ingredients.stock_quantity',
            )
            .first();
        if (!ingredients) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});


router.get('/getStockIngredients', userAuthMiddleware, async (req, res) => {

    try {

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients').select('*')

        console.log('ingredients', ingredients);



        if (!ingredients) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});

export default router; 