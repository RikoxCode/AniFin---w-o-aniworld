import { Router } from "express";
import { jellyfinAuth } from "../middleware/AuthMiddleware";

const authRouter = Router();

authRouter.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            const auth = await jellyfinAuth.authenticateByName(username, password);
            res.json(auth);
        } catch (error) {
            res.status(401).json({ error: 'Authentication failed' });
        }
    });

export default authRouter;