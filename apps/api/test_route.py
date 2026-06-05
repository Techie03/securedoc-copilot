from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
response = client.post('/api/workspaces/1/connectors/youtube/sync', json={'youtube_url': 'https://www.youtube.com/watch?v=123'})
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
