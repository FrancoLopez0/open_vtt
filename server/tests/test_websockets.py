import pytest
from fastapi.testclient import TestClient

import os
# Override HOST_TOKEN before main and state are imported to ensure consistency
os.environ["HOST_TOKEN"] = "test-host-token"

from server.main import app, HOST_TOKEN
from server.state import manager

@pytest.fixture(autouse=True)
def reset_manager():
    """Reset the connection manager before each test."""
    manager.players.clear()
    manager.host_connection = None
    manager.host_token = HOST_TOKEN
    yield

@pytest.fixture
def client():
    return TestClient(app)

def test_dm_connection(client):
    """Test that the DM can connect with the correct token."""
    with client.websocket_connect(f"/ws/host?token={HOST_TOKEN}") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "host_connected"

def test_dm_invalid_token(client):
    """Test that the DM connection fails with an invalid token."""
    from starlette.websockets import WebSocketDisconnect
    with client.websocket_connect("/ws/host?token=invalid") as websocket:
        msg = websocket.receive_json()
        assert msg == {"type": "error", "code": 4001, "message": "Unauthorized"}
        with pytest.raises(WebSocketDisconnect):
            websocket.receive_json()

def test_player_registration_and_connection(client):
    """Test DM creating a player and player connecting."""
    # DM creates player
    response = client.post(
        "/api/players",
        json={"name": "Alice"},
        headers={"X-Host-Token": HOST_TOKEN}
    )
    assert response.status_code in (200, 201)
    player_token = response.json()["token"]

    # DM connects
    with client.websocket_connect(f"/ws/host?token={HOST_TOKEN}") as dm_ws:
        dm_ws.receive_json() # host_connected

        # Player connects
        with client.websocket_connect(f"/ws/player?token={player_token}") as player_ws:
            # Player receives welcome and its own connect broadcast
            data = player_ws.receive_json()
            assert data["type"] == "welcome"
            assert data["name"] == "Alice"
            
            dm_ws.receive_json() # player_connected
            data = player_ws.receive_json()
            assert data["type"] == "player_connected"
            assert data["name"] == "Alice"

def test_chat_transmission(client):
    """Test that chat messages from DM and players are broadcasted."""
    response = client.post(
        "/api/players",
        json={"name": "Bob"},
        headers={"X-Host-Token": HOST_TOKEN}
    )
    player_token = response.json()["token"]

    with client.websocket_connect(f"/ws/host?token={HOST_TOKEN}") as dm_ws:
        dm_ws.receive_json() # host_connected

        with client.websocket_connect(f"/ws/player?token={player_token}") as player_ws:
            player_ws.receive_json() # welcome
            dm_ws.receive_json() # player_connected
            player_ws.receive_json() # player_connected

            # DM sends chat
            dm_ws.send_json({"type": "chat", "message": "Hello from DM!"})
            
            # DM receives own chat (broadcast)
            assert dm_ws.receive_json() == {"type": "chat", "sender": "DM", "message": "Hello from DM!"}
            # Player receives DM chat
            assert player_ws.receive_json() == {"type": "chat", "sender": "DM", "message": "Hello from DM!"}

            # Player sends chat
            player_ws.send_json({"type": "chat", "message": "Hello from Bob!"})

            # DM receives Player chat
            assert dm_ws.receive_json() == {"type": "chat", "sender": "Bob", "message": "Hello from Bob!"}
            # Player receives own chat
            assert player_ws.receive_json() == {"type": "chat", "sender": "Bob", "message": "Hello from Bob!"}

def test_dice_roll_events(client):
    """Test that public and secret dice rolls are handled correctly."""
    response = client.post(
        "/api/players",
        json={"name": "Charlie"},
        headers={"X-Host-Token": HOST_TOKEN}
    )
    player_token = response.json()["token"]

    with client.websocket_connect(f"/ws/host?token={HOST_TOKEN}") as dm_ws:
        dm_ws.receive_json()

        with client.websocket_connect(f"/ws/player?token={player_token}") as player_ws:
            player_ws.receive_json() # welcome
            dm_ws.receive_json() # player_connected
            player_ws.receive_json() # player_connected

            # Player rolls dice (public)
            player_ws.send_json({"type": "dice_roll", "result": 20})

            # DM receives roll
            assert dm_ws.receive_json() == {"type": "dice_roll", "roller": "Charlie", "result": 20, "secret": False}
            # Player receives roll
            assert player_ws.receive_json() == {"type": "dice_roll", "roller": "Charlie", "result": 20, "secret": False}

            # DM rolls dice (secret)
            dm_ws.send_json({"type": "dice_roll", "result": 15, "secret": True})

            # DM receives secret roll
            assert dm_ws.receive_json() == {"type": "dice_roll", "roller": "DM", "result": 15, "secret": True}
            
            # Player should NOT receive the secret roll.
            # We can test this by sending another public message and ensuring the player receives that next, not the secret roll.
            dm_ws.send_json({"type": "chat", "message": "Ping"})
            dm_ws.receive_json() # DM receives ping
            
            player_msg = player_ws.receive_json()
            assert player_msg["type"] == "chat"
            assert player_msg["message"] == "Ping"

def test_plugin_message_routing(client):
    """Test that plugin messages are routed correctly."""
    response = client.post(
        "/api/players",
        json={"name": "Dave"},
        headers={"X-Host-Token": HOST_TOKEN}
    )
    player_token = response.json()["token"]

    with client.websocket_connect(f"/ws/host?token={HOST_TOKEN}") as dm_ws:
        dm_ws.receive_json()

        with client.websocket_connect(f"/ws/player?token={player_token}") as player_ws:
            player_ws.receive_json() # welcome
            dm_ws.receive_json() # player_connected
            player_ws.receive_json() # player_connected

            # The kernel events will trigger plugin messages internally, but we can just test 
            # the ws manager's handling of plugin_message type from clients.
            # When a client sends plugin_message, it fires the kernel event, but the kernel
            # may not have plugins loaded. We can at least test the backend accepts the event
            # without crashing.
            
            dm_ws.send_json({"type": "plugin_message", "plugin": "test_plugin", "payload": {"action": "test"}})
            player_ws.send_json({"type": "plugin_message", "plugin": "test_plugin", "payload": {"action": "test2"}})
            
            # Send a ping to flush the queue and ensure no crash happened
            dm_ws.send_json({"type": "chat", "message": "Flush"})
            dm_ws.receive_json()
            msg = player_ws.receive_json()
            assert msg.get("type") == "chat" and msg.get("message") == "Flush"
                    
            assert True # if we reach here, it didn't crash
