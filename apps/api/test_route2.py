from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user, get_current_workspace_member
from app.models.models import User

fake_user = User(id="user123", email="test@test.com")
app.dependency_overrides[get_current_user] = lambda: fake_user
app.dependency_overrides[get_current_workspace_member] = lambda: None

client = TestClient(app)
response = client.post('/api/workspaces/1/connectors/youtube/sync', json={'youtube_url': 'https://www.youtube.com/watch?v=123'})
print("Status Code:", response.status_code)
print("Response JSON:", response.json())
