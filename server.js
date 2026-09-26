import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Dynamic import for api routes to simulate vercel serverless functions
app.use('/api', async (req, res) => {
    try {
        const route = req.path.replace(/^\//, ''); // remove leading slash
        // handle query params in file names if needed, but usually just route
        const apiPath = path.join(__dirname, 'api', `${route}.js`);

        
        if (fs.existsSync(apiPath)) {
            const module = await import(`file://${apiPath}`);
            const handler = module.default;
            if (typeof handler === 'function') {
                return handler(req, res);
            }
        }
        res.status(404).json({ error: 'API endpoint not found' });
    } catch (err) {
        console.error("API Route Error:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running locally at http://localhost:${PORT}`);
});
