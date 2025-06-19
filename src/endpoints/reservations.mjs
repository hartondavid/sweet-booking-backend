import { Router } from "express";
import db from "../utils/database.mjs";
import { sendJsonResponse } from "../utils/utilFunctions.mjs";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

const router = Router();

// Adaugă o rezervare nouă (doar admin)
router.post('/addReservation', userAuthMiddleware, async (req, res) => {

    try {

        const { quantity, cake_id } = req.body;
        const userId = req.user?.id;

        console.log('quantity', quantity);


        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const currentRemainingQuantity = await db('remaining_cakes')
            .where({ 'remaining_cakes.cake_id': cake_id })
            .first();




        if (!currentRemainingQuantity) {
            return sendJsonResponse(res, false, 404, "Nu există rezervări!", []);
        }

        const remainingQuantity = currentRemainingQuantity.remaining_quantity - quantity;

        if (remainingQuantity <= 0) {
            return sendJsonResponse(res, false, 404, "Nu există prajituri!", []);
        }

        console.log('remainingQuantity', remainingQuantity);
        await db('remaining_cakes')
            .where({ 'remaining_cakes.cake_id': cake_id })
            .update({ remaining_quantity: remainingQuantity })


        const [id] = await db('reservations').insert({ quantity, status: 'placed', cake_id, customer_id: userId });
        const reservation = await db('reservations').where({ id }).first();
        return sendJsonResponse(res, true, 201, "Rezervarea a fost adăugată cu succes!", { reservation });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la adăugarea rezervării!", { details: error.message });
    }
});

// Actualizează o rezervare
router.put('/updateReservationStatus/:reservationId', userAuthMiddleware, async (req, res) => {

    try {
        const { reservationId } = req.params;
        const { status } = req.body;
        const userId = req.user?.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const reservation = await db('reservations')
            .where({ id: reservationId }).first();

        if (!reservation) return sendJsonResponse(res, false, 404, "Rezervarea nu există!", []);
        await db('reservations').where({ id: reservationId }).update({
            status: status || reservation.status,
        });
        const updated = await db('reservations').where({ id: reservationId }).first();
        return sendJsonResponse(res, true, 200, "Rezervarea a fost actualizată cu succes!", { reservation: updated });
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la actualizarea rezervării!", { details: error.message });
    }
});

// //Șterge o rezervare
router.delete('/deleteReservation/:reservationId', userAuthMiddleware, async (req, res) => {

    try {
        const { reservationId } = req.params;
        const userId = req.user?.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const reservation = await db('reservations')
            .where({ id: reservationId }).first();
        if (!reservation) return sendJsonResponse(res, false, 404, "Rezervarea nu există!", []);
        await db('reservations').where({ id: reservationId }).update({ status: 'cancelled' });
        return sendJsonResponse(res, true, 200, "Rezervarea a fost ștearsă cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea prăjiturii!", { details: error.message });
    }
});

// Obține o prăjitură după id
// router.get('/getCake/:cakeId', userAuthMiddleware, async (req, res) => {
//     const { cakeId } = req.params;
//     try {
//         const cake = await db('cakes')
//             .where('cakes.id', cakeId)
//             .select(
//                 'cakes.id',
//                 'cakes.name',
//                 'cakes.price',
//                 'cakes.description',
//                 'cakes.image',
//                 'cakes.total_quantity',
//                 'cakes.kcal'
//             )
//             .first();
//         if (!cake) {
//             return sendJsonResponse(res, false, 404, 'Prăjitura nu există!', []);
//         }
//         return sendJsonResponse(res, true, 200, 'Prăjitura a fost găsită!', cake);
//     } catch (error) {
//         return sendJsonResponse(res, false, 500, 'Eroare la preluarea prăjiturii!', { details: error.message });
//     }
// });

router.get('/getReservationsByAdminId', userAuthMiddleware, async (req, res) => {
    try {

        const userId = req.user?.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const reservations = await db('reservations')
            .join('cakes', 'reservations.cake_id', 'cakes.id')
            .join('users', 'reservations.customer_id', 'users.id')
            .select(
                'reservations.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.kcal',
                'reservations.quantity',
                'reservations.date',
                'reservations.status',
                'reservations.updated_at',
                'users.name as customer_name',
            )
            .orderBy('reservations.updated_at', 'desc')
        if (reservations.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există rezervări!', []);
        }
        return sendJsonResponse(res, true, 200, 'Rezervări a fost găsite!', reservations);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea rezervărilor!', { details: error.message });
    }
});

router.get('/getReservationsByCustomerId', userAuthMiddleware, async (req, res) => {
    try {

        const userId = req.user?.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 2)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const reservations = await db('reservations')
            .join('cakes', 'reservations.cake_id', 'cakes.id')
            .join('users', 'reservations.customer_id', 'users.id')
            .where('reservations.customer_id', userId)
            .select(
                'cakes.id',
                'cakes.name',
                'cakes.price',
                'cakes.description',
                'cakes.photo',
                'cakes.kcal',
                'reservations.quantity',
                'reservations.date',
                'reservations.status',
                'reservations.updated_at',
                'users.name as customer_name',
            )
            .orderBy('reservations.updated_at', 'desc')
        if (reservations.length === 0) {
            return sendJsonResponse(res, false, 404, 'Nu există rezervări!', []);
        }
        return sendJsonResponse(res, true, 200, 'Rezervări a fost găsite!', reservations);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea rezervărilor!', { details: error.message });
    }
});


export default router; 