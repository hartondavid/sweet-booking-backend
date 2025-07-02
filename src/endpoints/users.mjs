import { Router } from "express";
import { userAuthMiddleware } from "../utils/middlewares/userAuthMiddleware.mjs";

import { getAuthToken, md5Hash, sendJsonResponse } from "../utils/utilFunctions.mjs";
import db from "../utils/database.mjs";

const router = Router();

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate request
        if (!email || !password) {
            return sendJsonResponse(res, false, 400, "Email and password are required", []);
        }
        // Fetch user from database
        const user = await db('users').where({ email }).first();

        if (!user) {
            return sendJsonResponse(res, false, 401, "Invalid credentials", []);
        }

        // Compare passwords (hashed with MD5)
        const hashedPassword = md5Hash(password);

        if (hashedPassword !== user.password) {
            return sendJsonResponse(res, false, 401, "Invalid credentials", []);
        }

        // Generate JWT token
        const token = getAuthToken(user.id, user.email, false, '1d', true)

        await db('users')
            .where({ id: user.id })
            .update({ last_login: parseInt(Date.now() / 1000) });

        // Set custom header
        res.set('X-Auth-Token', token);

        return sendJsonResponse(res, true, 200, "Successfully logged in!", { user });
    } catch (error) {
        console.error("Login error:", error);
        return sendJsonResponse(res, false, 500, "Internal server error", []);
    }
});


router.get('/checkLogin', userAuthMiddleware, async (req, res) => {
    return sendJsonResponse(res, true, 200, "User is logged in", req.user);
})

router.post('/register', async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            confirm_password
        } = req.body;

        if (password.length < 6) {
            return sendJsonResponse(res, false, 400, "Parola trebuie sa aiba minim 6 caractere", null);
        }

        // Fields that are allowed to be added for a new user
        const validFields = [
            'name', 'email', 'password', 'phone', 'confirm_password'
        ];

        // Build the new user data from the request, only including valid fields
        const userData = {};
        for (const key in req.body) {
            if (validFields.includes(key)) {
                userData[key] = key === "password" ? md5Hash(req.body[key]) : userData[key] = key === "confirm_password" ? md5Hash(req.body[key]) : req.body[key];
            }
        }


        // Ensure required fields are present
        if (!userData.name || !userData.email || !userData.password || !userData.phone || !userData.confirm_password) {
            return sendJsonResponse(res, false, 400, "Missing required fields", null);
        }
        if (userData.password !== userData.confirm_password) {
            return sendJsonResponse(res, false, 400, "Parolele nu coincid!", []);
        }

        const phoneRegex = /^07[0-9]{8}$/;
        if (!phoneRegex.test(userData.phone)) {
            return sendJsonResponse(res, false, 400, "Numărul de telefon trebuie să înceapă cu 07 și să aibă 10 cifre.", null);
        }


        if (userData.name.length < 3) {
            return sendJsonResponse(res, false, 400, "Numele trebuie sa aiba minim 3 caractere", null);
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(userData.email)) {
            return sendJsonResponse(res, false, 400, "Emailul nu este valid", null);
        }

        const phoneExists = await db('users').where('phone', userData.phone).first();
        if (phoneExists) {
            return sendJsonResponse(res, false, 400, "Numărul de telefon este deja înregistrat", null);
        }



        let newUserId;
        // let rightCode;
        const userEmail = await db('users').where('email', email).first();
        if (!userEmail) {
            // Insert the new user into the database
            [newUserId] = await db('users')
                .insert(userData)
                .returning('id');

            const rightCode = await db('rights').where('right_code', 2).first();

            await db('user_rights')

                .where({ user_id: newUserId })
                .insert({
                    user_id: newUserId,
                    right_id: rightCode.id
                });

            sendJsonResponse(res, true, 201, "Utilizatorul a fost creat cu succes", { id: newUserId });
        } else {
            sendJsonResponse(res, false, 400, "Utilizatorul exista deja", null);
        }


    } catch (error) {
        console.error("Error creating user:", error);
        sendJsonResponse(res, false, 500, "Internal server error", null);
    }
});

router.delete('/deleteUser/:userId', userAuthMiddleware, async (req, res) => {
    try {

        const { userId } = req.params;

        const loggedUserId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', loggedUserId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        const user = await db('users').where({ id: userId }).first();
        if (!user) return sendJsonResponse(res, false, 404, "Utilizatorul nu există!", []);
        await db('users').where({ id: userId }).del();
        return sendJsonResponse(res, true, 200, "Utilizatorul a fost șters cu succes!", []);
    } catch (error) {
        return sendJsonResponse(res, false, 500, "Eroare la ștergerea ingredientului!", { details: error.message });
    }
});

router.post('/addUser', userAuthMiddleware, async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            confirm_password
        } = req.body;

        if (password.length < 6) {
            return sendJsonResponse(res, false, 400, "Parola trebuie sa aiba minim 6 caractere", null);
        }

        const userId = req.user.id;

        const userRights = await db('user_rights')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .where('rights.right_code', 1)
            .where('user_rights.user_id', userId)
            .first();

        if (!userRights) {
            return sendJsonResponse(res, false, 403, "Nu sunteti autorizat!", []);
        }

        // Fields that are allowed to be added for a new user
        const validFields = [
            'name', 'email', 'password', 'phone', 'confirm_password'
        ];

        // Build the new user data from the request, only including valid fields
        const userData = {};
        for (const key in req.body) {
            if (validFields.includes(key)) {
                userData[key] = key === "password" ? md5Hash(req.body[key]) : userData[key] = key === "confirm_password" ? md5Hash(req.body[key]) : req.body[key];
            }
        }


        // Ensure required fields are present
        if (!userData.name || !userData.email || !userData.password || !userData.phone || !userData.confirm_password) {
            return sendJsonResponse(res, false, 400, "Numele, emailul, parola, numarul de telefon si confirmarea parolei sunt obligatorii!", null);
        }
        if (userData.password !== userData.confirm_password) {
            return sendJsonResponse(res, false, 400, "Parolele nu coincid!", []);
        }

        const phoneRegex = /^07[0-9]{8}$/;
        if (!phoneRegex.test(userData.phone)) {
            return sendJsonResponse(res, false, 400, "Numărul de telefon trebuie să înceapă cu 07 și să aibă 10 cifre.", null);
        }


        if (userData.name.length < 3) {
            return sendJsonResponse(res, false, 400, "Numele trebuie sa aiba minim 3 caractere", null);
        }

        if (userData.email.length < 3) {
            return sendJsonResponse(res, false, 400, "Emailul trebuie sa aiba minim 3 caractere", null);
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(userData.email)) {
            return sendJsonResponse(res, false, 400, "Emailul nu este valid", null);
        }

        let newUserId;
        // let rightCode;
        const userEmail = await db('users').where('email', email).first();
        if (!userEmail) {
            // Insert the new user into the database
            [newUserId] = await db('users')
                .insert(userData)
                .returning('id');

            const rightCode = await db('rights').where('right_code', 1).first();

            await db('user_rights')

                .where({ user_id: newUserId })
                .insert({
                    user_id: newUserId,
                    right_id: rightCode.id
                });

            sendJsonResponse(res, true, 201, "Utilizatorul a fost creat cu succes", { id: newUserId });
        } else {
            sendJsonResponse(res, false, 400, "Utilizatorul exista deja", null);
        }


    } catch (error) {
        console.error("Error creating user:", error);
        sendJsonResponse(res, false, 500, "Internal server error", null);
    }
});

router.get('/getUsers', userAuthMiddleware, async (req, res) => {

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

        const users = await db('users').
            join('user_rights', 'users.id', 'user_rights.user_id')
            .join('rights', 'user_rights.right_id', 'rights.id')
            .whereNot('users.id', userId)
            .where('rights.right_code', 1)
            .select('users.*', 'rights.name as right_name');


        if (!users) {
            return sendJsonResponse(res, false, 404, 'Utilizatorii nu există!', []);
        }
        return sendJsonResponse(res, true, 200, 'Utilizatorii au fost găsiți!', users);
    } catch (error) {
        return sendJsonResponse(res, false, 500, 'Eroare la preluarea utilizatorilor!', { details: error.message });
    }
});

export default router;