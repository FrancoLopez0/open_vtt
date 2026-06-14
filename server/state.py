from server.ws_manager import ConnectionManager
from server.kernel import Kernel
import os

HOST_TOKEN = os.getenv("HOST_TOKEN", "default-host-token")
PLUGINS_DIR = os.path.join(os.path.dirname(__file__), "..", "plugins")

manager = ConnectionManager(HOST_TOKEN)
kernel = Kernel(PLUGINS_DIR)
kernel.send_message = manager.send_plugin_message  # type: ignore
