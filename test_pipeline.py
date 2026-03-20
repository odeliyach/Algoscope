from dotenv import load_dotenv
load_dotenv()

from app.ingestion import fetch_posts
from app.model import ToxicityClassifier
from app.database import save_post, get_recent_posts

classifier = ToxicityClassifier()
posts = fetch_posts('toxic', limit=5)

for text in posts:
    result = classifier.predict(text)
    save_post(text, result['label'], result['score'], 'bluesky')
    print(f"{result['label']} ({result['score']:.2f}) — {text[:60]}")

print('---')
print(f'Total in DB: {len(get_recent_posts())}')