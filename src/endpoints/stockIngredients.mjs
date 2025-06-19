import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

const router = Router();


// Adaugă un ingredient necesar nouă (doar admin)
router.post('/addStockIngredient', userAuthMiddleware, async (req, res) => {

    try {

        const { name, unit } = req.body;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        if (!name || !unit) {
            return sendJsonResponse(res, false, 400, "Numele și unitatea sunt obligatorii!", []);
        }

        const [id] = await db('ingredients').insert({ name, stock_quantity: 0, unit, admin_id: userId });
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
        const { name, stock_quantity, unit } = req.body;
        const userId = req.user.id;


        if (!name || !unit) {
            return sendJsonResponse(res, false, 400, "Numele și unitatea sunt obligatorii!", []);
        }

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
            stock_quantity: stock_quantity || ingredients.stock_quantity,
            unit: unit || ingredients.unit
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
                'ingredients.unit'
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

        const ingredients = await db('ingredients')
            // .join('cake_ingredients', 'ingredients.id', 'cake_ingredients.ingredient_id')

            .select('*')
        // .groupBy('ingredients.id')

        console.log('ingredients', ingredients);



        if (!ingredients) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});




router.get('/getIngredientsWhereNotInCake/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const userId = req.user.id;
        const { cakeId } = req.params;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients')

            .whereNotIn('ingredients.id', db('cake_ingredients').select('ingredient_id').where('cake_id', cakeId))
            .select('*')

        console.log('ingredients', ingredients);



        if (!ingredients) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});

router.get('/getIngredientsWhereInCake/:cakeId', userAuthMiddleware, async (req, res) => {

    try {

        const userId = req.user.id;
        const { cakeId } = req.params;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const ingredients = await db('ingredients')

            .whereIn('ingredients.id', db('cake_ingredients').select('ingredient_id').where('cake_id', cakeId))
            .select('*')

        console.log('ingredients', ingredients);



        if (!ingredients) {
            return sendJsonResponse(res, false, 404, 'Ingredientul nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Ingredientul a fost găsit!', ingredients);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea ingredientului!', { details: error.message });
    }
});

router.post('/increaseQuantity/:ingredientId', userAuthMiddleware, async (req, res) => {

    try {

        const { quantity } = req.body;
        const { ingredientId } = req.params;

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        if (!quantity) {
            return sendJsonResponse(res, false, 400, "Cantitatea este obligatorie!", []);
        }


        const ingredients = await db('ingredients').where({ id: ingredientId }).first();

        const totalQuantity = Number(ingredients.stock_quantity) + Number(quantity);

        console.log('totalQuantity', totalQuantity);
        const updated = await db('ingredients').where({ id: ingredientId }).update({ stock_quantity: totalQuantity });
        return sendJsonResponse(res, true, 201, "Ingredientul a fost adăugat cu succes!", { ingredients });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea ingredientului!", { details: error.message });
    }
});
export default router; 