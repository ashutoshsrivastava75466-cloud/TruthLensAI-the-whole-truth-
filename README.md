TruthLensAI — One-Click Replit App (Light Mode)

How to run on Replit:
1. Create a new Replit (Node.js).
2. Upload/Import this ZIP into the Replit (Upload file -> select this zip -> Extract).
3. In Replit secrets (🔐), add:
   NEWSDATA_API_KEY = pub_2e973ddb22ea4131a8c1d41e7e04aee0
   OPENAI_API_KEY = (optional) your OpenAI key

4. Click Run. The app will install deps and start. Open the provided URL.

Local run:
1. unzip and cd into folder
2. npm install
3. create .env based on .env.example
4. npm start

Endpoints:
- GET /api/news
- POST /api/analyze (body: { title, summary, content, link })

UI:
- Swipe up = next, swipe down = previous
- Refresh button to fetch latest news
- Analytics opens only on analytics (chart) button

