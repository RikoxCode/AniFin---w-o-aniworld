import { JellyfinAuth } from '../auth/JellyfinAuth';

export const jellyfinAuth = new JellyfinAuth({
  serverUrl: 'http://localhost:8096'
});

export const authMiddleware = async (req: any, res: any, next: any) => {
  const token = req.headers['x-emby-token'] || req.headers['authorization']?.replace('Bearer ', '');
  
  // if (!token) {
  //   return res.status(401).json({ error: 'No token provided' });
  // }

  // const isValid = await jellyfinAuth.validateToken(token);
  // if (!isValid) {
  //   return res.status(401).json({ error: 'Invalid token' });
  // }

  // req.jellyfinToken = token;
  next();
};
