from server.ws_manager import ConnectionManager
from server.kernel import Kernel
from pathlib import Path
import os

HOST_TOKEN = os.getenv("HOST_TOKEN", "default-host-token")
PLUGINS_DIR = Path(__file__).parent.parent / "plugins"

manager = ConnectionManager(HOST_TOKEN)
kernel = Kernel(PLUGINS_DIR)
kernel.send_message = manager.send_plugin_message  # type: ignore
